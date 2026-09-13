import XCTest
import CryptoKit
@testable import PocketAI

@MainActor
private final class FixtureTransport: ModelTransport {
    var payload = Data("hello".utf8)
    var cancelAfterWrite = false
    var urls: [URL] = []
    func download(_ url: URL, to destination: URL, allowCellular: Bool,
                  onProgress: @escaping @MainActor @Sendable (Int64) -> Void) async throws {
        urls.append(url)
        try payload.write(to: destination)
        onProgress(Int64(payload.count))
        if cancelAfterWrite { throw CancellationError() }
    }
}
final class ModelLibraryTests: XCTestCase {
    private var folder: URL!
    override func setUpWithError() throws {
        folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    }
    override func tearDownWithError() throws { try FileManager.default.removeItem(at: folder) }
    private func model(name: String = "model.safetensors") -> DownloadableModel {
        let hash = SHA256.hash(data: Data("hello".utf8)).map { String(format: "%02x", $0) }.joined()
        return DownloadableModel(id: "test/small", name: "Fixture", revision: String(repeating: "a", count: 40),
            files: [ModelFile(name: name, bytes: 5, hash: hash, hashKind: .sha256)])
    }
    func testManifestRejectsTraversalAndReservedReceipt() {
        for path in ["../outside", "nested/file", "..", "receipt.json", "\\outside"] {
            XCTAssertThrowsError(try model(name: path).validate())
        }
    }
    func testURLsUsePinnedRevision() throws {
        let model = model()
        let url = try model.url(for: model.files[0])
        XCTAssertEqual(url.host, "huggingface.co")
        XCTAssertTrue(url.path.contains("/resolve/" + model.revision + "/"))
        XCTAssertFalse(url.path.contains("/main/"))
    }
    func testSameSizeCorruptionIsRejected() throws {
        let path = folder.appendingPathComponent("weights")
        try Data("wrong".utf8).write(to: path)
        XCTAssertThrowsError(try ModelIntegrity.verify(model().files[0], at: path))
    }
    func testGitBlobHashIncludesHeader() throws {
        let payload = Data("hello".utf8)
        var hash = Insecure.SHA1()
        hash.update(data: Data("blob 5\0".utf8)); hash.update(data: payload)
        let file = ModelFile(name: "config.json", bytes: 5,
            hash: hash.finalize().map { String(format: "%02x", $0) }.joined(), hashKind: .gitSHA1)
        let path = folder.appendingPathComponent(file.name)
        try payload.write(to: path)
        XCTAssertNoThrow(try ModelIntegrity.verify(file, at: path))
    }
    @MainActor
    func testVerifiedInstallSurvivesRelaunchAndDeletesOnlyModelFiles() async throws {
        let transport = FixtureTransport()
        let fixture = model()
        let unrelated = folder.appendingPathComponent("conversation.json")
        try Data("saved chat".utf8).write(to: unrelated)
        let library = ModelLibrary(root: folder, catalog: [fixture], transport: transport)
        try await library.install(fixture)
        XCTAssertTrue(library.installedIDs.contains(fixture.id))
        let reopened = ModelLibrary(root: folder, catalog: [fixture], transport: transport)
        XCTAssertTrue(reopened.installedIDs.contains(fixture.id))
        _ = try await reopened.verifiedDirectory(for: fixture)
        try reopened.delete(fixture)
        XCTAssertFalse(reopened.installedIDs.contains(fixture.id))
        XCTAssertEqual(try Data(contentsOf: unrelated), Data("saved chat".utf8))
    }
    @MainActor
    func testCancelledInstallLeavesNoReadyModelAndRetryWorks() async throws {
        let transport = FixtureTransport()
        transport.cancelAfterWrite = true
        let fixture = model()
        let library = ModelLibrary(root: folder, catalog: [fixture], transport: transport)
        do { try await library.install(fixture); XCTFail("Expected cancellation") }
        catch is CancellationError {} catch { XCTFail("Wrong error: \(error)") }
        XCTAssertFalse(library.installedIDs.contains(fixture.id))
        XCTAssertFalse(FileManager.default.fileExists(atPath: library.directory(for: fixture).path))
        XCTAssertFalse(try FileManager.default.contentsOfDirectory(atPath: folder.path).contains { $0.hasPrefix("partial-") })
        transport.cancelAfterWrite = false
        try await library.install(fixture)
        XCTAssertTrue(library.installedIDs.contains(fixture.id))
    }
    @MainActor
    func testBadHashNeverProducesInstallReceipt() async throws {
        let transport = FixtureTransport()
        transport.payload = Data("wrong".utf8)
        let fixture = model()
        let library = ModelLibrary(root: folder, catalog: [fixture], transport: transport)
        do { try await library.install(fixture); XCTFail("Expected hash failure") }
        catch is ModelError {} catch { XCTFail("Wrong error: \(error)") }
        XCTAssertFalse(library.installedIDs.contains(fixture.id))
        XCTAssertFalse(FileManager.default.fileExists(atPath: library.directory(for: fixture).appendingPathComponent("receipt.json").path))
    }
}
