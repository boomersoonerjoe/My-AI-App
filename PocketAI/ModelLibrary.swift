import Foundation
import Combine
import CryptoKit

struct ModelFile: Codable, Equatable, Sendable {
    enum HashKind: String, Codable, Sendable { case sha256, gitSHA1 }
    let name: String
    let bytes: Int64
    let hash: String
    let hashKind: HashKind
}
struct DownloadableModel: Codable, Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let revision: String
    let files: [ModelFile]
    var downloadBytes: Int64 { files.reduce(0) { $0 + $1.bytes } }
    var directoryName: String { id.replacingOccurrences(of: "/", with: "--") + "-" + revision }
    var sizeLabel: String { ByteCountFormatter.string(fromByteCount: downloadBytes, countStyle: .file) }
    func validate() throws {
        let safe: (String) -> Bool = { value in
            !value.isEmpty && value != "." && value != ".." && !value.contains("/") && !value.contains("\\")
        }
        let parts = id.split(separator: "/", omittingEmptySubsequences: false)
        guard parts.count == 2, parts.allSatisfy({ safe(String($0)) }),
              revision.count == 40, revision.allSatisfy(\.isHexDigit), !files.isEmpty,
              Set(files.map(\.name)).count == files.count else { throw ModelError.invalidManifest }
        guard files.allSatisfy({ safe($0.name) && !$0.name.hasPrefix(".") && $0.name != "receipt.json" && $0.bytes > 0
            && $0.bytes < 8_000_000_000 && $0.hash.allSatisfy(\.isHexDigit)
            && $0.hash.count == ($0.hashKind == .sha256 ? 64 : 40) }) else { throw ModelError.invalidManifest }
    }
    func url(for file: ModelFile) throws -> URL {
        try validate()
        guard files.contains(file), let base = URL(string: "https://huggingface.co") else { throw ModelError.invalidManifest }
        return base.appendingPathComponent(id).appendingPathComponent("resolve")
            .appendingPathComponent(revision).appendingPathComponent(file.name)
    }
}
enum ModelError: LocalizedError {
    case invalidManifest, busy, notInstalled, invalidFile(String), http(Int), storage
    var errorDescription: String? {
        switch self {
        case .invalidManifest: return "The model file list is invalid."
        case .busy: return "Finish or cancel the current model operation first."
        case .notInstalled: return "Download this model before selecting it."
        case .invalidFile(let name): return "File verification failed for \(name). Delete and download the model again."
        case .http(let code): return "The model server returned HTTP \(code). Try again later."
        case .storage: return "There is not enough free storage for this download and its temporary files."
        }
    }
}
struct ModelIntegrity {
    static func verify(_ file: ModelFile, at url: URL) throws {
        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        guard attributes[.type] as? FileAttributeType == .typeRegular,
              (attributes[.size] as? NSNumber)?.int64Value == file.bytes else { throw ModelError.invalidFile(file.name) }
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var sha256 = SHA256()
        var gitSHA1 = Insecure.SHA1()
        // Git's SHA-1 is over the blob header plus bytes, not just the file bytes.
        gitSHA1.update(data: Data("blob \(file.bytes)\0".utf8))
        while let chunk = try handle.read(upToCount: 1_048_576), !chunk.isEmpty {
            try Task.checkCancellation()
            switch file.hashKind {
            case .sha256: sha256.update(data: chunk)
            case .gitSHA1: gitSHA1.update(data: chunk)
            }
        }
        let digest: String
        switch file.hashKind {
        case .sha256: digest = sha256.finalize().map { String(format: "%02x", $0) }.joined()
        case .gitSHA1: digest = gitSHA1.finalize().map { String(format: "%02x", $0) }.joined()
        }
        guard digest == file.hash.lowercased() else { throw ModelError.invalidFile(file.name) }
    }
    static func verifyAsync(_ model: DownloadableModel, at directory: URL) async throws {
        let worker = Task.detached(priority: .utility) {
            for file in model.files { try verify(file, at: directory.appendingPathComponent(file.name)) }
        }
        try await withTaskCancellationHandler(operation: { try await worker.value }, onCancel: { worker.cancel() })
    }
}

@MainActor
protocol ModelTransport {
    func download(_ url: URL, to destination: URL, allowCellular: Bool,
                  onProgress: @escaping @MainActor @Sendable (Int64) -> Void) async throws
}
private final class DownloadProgress: NSObject, URLSessionDownloadDelegate, @unchecked Sendable {
    let update: @MainActor @Sendable (Int64) -> Void
    init(update: @escaping @MainActor @Sendable (Int64) -> Void) { self.update = update }
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {}
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64,
                    totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        Task { @MainActor in self.update(totalBytesWritten) }
    }
}
@MainActor
final class HTTPModelTransport: ModelTransport {
    func download(_ url: URL, to destination: URL, allowCellular: Bool,
                  onProgress: @escaping @MainActor @Sendable (Int64) -> Void) async throws {
        let config = URLSessionConfiguration.ephemeral
        config.allowsCellularAccess = allowCellular
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 7200
        let session = URLSession(configuration: config)
        defer { session.invalidateAndCancel() }
        let delegate = DownloadProgress(update: onProgress)
        let (temporary, response) = try await session.download(for: URLRequest(url: url), delegate: delegate)
        try Task.checkCancellation()
        guard let http = response as? HTTPURLResponse else { throw ModelError.http(0) }
        guard (200...299).contains(http.statusCode) else { throw ModelError.http(http.statusCode) }
        try FileManager.default.moveItem(at: temporary, to: destination)
    }
}

@MainActor
final class ModelLibrary: ObservableObject {
    @Published private(set) var installedIDs = Set<String>()
    @Published private(set) var activeModelID: String?
    @Published private(set) var progress = 0.0
    @Published private(set) var status = ""
    @Published var allowCellular = false
    private let root: URL
    private let transport: any ModelTransport
    private var task: Task<Void, Never>?
    let catalog: [DownloadableModel]
    var isBusy: Bool { activeModelID != nil || task != nil }

    init(root: URL, catalog: [DownloadableModel] = ModelCatalog.models, transport: any ModelTransport) {
        self.root = root
        self.catalog = catalog
        self.transport = transport
        refresh()
    }
    static func live() -> ModelLibrary {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return ModelLibrary(root: support.appendingPathComponent("PocketAI/Models"), transport: HTTPModelTransport())
    }
    func directory(for model: DownloadableModel) -> URL { root.appendingPathComponent(model.directoryName) }
    private func isInstalled(_ model: DownloadableModel) -> Bool {
        guard (try? model.validate()) != nil else { return false }
        let folder = directory(for: model)
        guard let bytes = try? Data(contentsOf: folder.appendingPathComponent("receipt.json")),
              let receipt = try? JSONDecoder().decode(DownloadableModel.self, from: bytes), receipt == model else { return false }
        return model.files.allSatisfy { file in
            guard let attrs = try? FileManager.default.attributesOfItem(atPath: folder.appendingPathComponent(file.name).path) else { return false }
            return attrs[.type] as? FileAttributeType == .typeRegular && (attrs[.size] as? NSNumber)?.int64Value == file.bytes
        }
    }
    func refresh() { installedIDs = Set(catalog.filter { isInstalled($0) }.map(\.id)) }
    func startDownload(_ model: DownloadableModel) {
        guard task == nil, !isBusy else { return }
        task = Task { [weak self] in
            guard let self else { return }
            defer { self.task = nil }
            do { try await self.install(model) }
            catch { self.status = Task.isCancelled ? "Download cancelled. Tap Download to restart." : error.localizedDescription }
        }
    }
    func cancel() { task?.cancel() }

    // Exposed internally for deterministic tests using an injected transport.
    func install(_ model: DownloadableModel) async throws {
        guard activeModelID == nil, catalog.contains(model) else { throw ModelError.busy }
        try model.validate()
        guard !isInstalled(model) else { return }
        activeModelID = model.id
        progress = 0
        defer { activeModelID = nil; refresh() }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        var folderURL = root
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try folderURL.setResourceValues(values)
        if let available = try root.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]).volumeAvailableCapacityForImportantUsage {
            guard available > model.downloadBytes * 2 + 268_435_456 else { throw ModelError.storage }
        }
        // Downloads are private staging directories. No partial state is ever marked installed.
        let stage = root.appendingPathComponent("partial-" + model.directoryName)
        if FileManager.default.fileExists(atPath: stage.path) { try FileManager.default.removeItem(at: stage) }
        try FileManager.default.createDirectory(at: stage, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: stage) }
        var complete: Int64 = 0
        let cellular = allowCellular
        for file in model.files {
            try Task.checkCancellation()
            status = "Downloading \(file.name)"
            let base = complete
            try await transport.download(try model.url(for: file), to: stage.appendingPathComponent(file.name), allowCellular: cellular) { [weak self] received in
                guard let self, self.activeModelID == model.id else { return }
                let fraction = Double(base + min(file.bytes, received)) / Double(model.downloadBytes)
                self.progress = max(self.progress, min(1, fraction))
            }
            complete += file.bytes
        }
        status = "Verifying downloaded files…"
        try await ModelIntegrity.verifyAsync(model, at: stage)
        try Task.checkCancellation()
        try JSONEncoder().encode(model).write(to: stage.appendingPathComponent("receipt.json"), options: .atomic)
        let destination = directory(for: model)
        if FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.removeItem(at: destination) }
        try FileManager.default.moveItem(at: stage, to: destination)
        progress = 1
        status = "Downloaded and verified. Select the model to load it."
    }
    func verifiedDirectory(for model: DownloadableModel) async throws -> URL {
        guard !isBusy else { throw ModelError.busy }
        guard catalog.contains(model), isInstalled(model) else { throw ModelError.notInstalled }
        activeModelID = model.id
        status = "Verifying local model files…"
        defer { activeModelID = nil }
        let directory = directory(for: model)
        // Verify again before model loading; receipt and size alone do not detect same-size corruption.
        try await ModelIntegrity.verifyAsync(model, at: directory)
        try Task.checkCancellation()
        return directory
    }
    func delete(_ model: DownloadableModel) throws {
        guard !isBusy, catalog.contains(model) else { throw ModelError.busy }
        try model.validate()
        let folder = directory(for: model)
        if FileManager.default.fileExists(atPath: folder.path) { try FileManager.default.removeItem(at: folder) }
        let partial = root.appendingPathComponent("partial-" + model.directoryName)
        if FileManager.default.fileExists(atPath: partial.path) { try FileManager.default.removeItem(at: partial) }
        refresh()
        status = "Model files deleted. Conversations remain saved."
    }
}
