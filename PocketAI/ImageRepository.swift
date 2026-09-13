import Foundation

struct SavedImage: Codable, Identifiable, Equatable {
    var id = UUID()
    let prompt: String
    let negativePrompt: String
    let model: String
    let width: Int
    let height: Int
    var createdAt = Date()
    var filename: String { id.uuidString + ".png" }
}
private struct ImageIndex: Codable {
    var version = 1
    var images: [SavedImage]
}
struct ImageRepository {
    let root: URL
    private var indexURL: URL { root.appendingPathComponent("index.json") }
    func url(for image: SavedImage) -> URL { root.appendingPathComponent(image.filename) }
    func load() throws -> [SavedImage] {
        guard FileManager.default.fileExists(atPath: indexURL.path) else { return [] }
        let index = try JSONDecoder().decode(ImageIndex.self, from: Data(contentsOf: indexURL))
        guard index.version == 1 else { throw StorageError.unsupportedVersion }
        return index.images
    }
    func save(png: Data, record: SavedImage) throws -> [SavedImage] {
        // Read existing metadata before touching any images. Never replace an unreadable index.
        var images = try load()
        guard png.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let destination = url(for: record)
        guard !FileManager.default.fileExists(atPath: destination.path) else { throw CocoaError(.fileWriteFileExists) }
        try png.write(to: destination, options: [.atomic, .completeFileProtection])
        images.insert(record, at: 0)
        do { try writeIndex(images) }
        catch {
            try? FileManager.default.removeItem(at: destination)
            throw error
        }
        return images
    }
    func remove(_ record: SavedImage) throws -> [SavedImage] {
        let images = try load().filter { $0.id != record.id }
        // A failed index update leaves the original image and metadata intact.
        try writeIndex(images)
        // Removing from the gallery succeeds even if a later file cleanup must be retried.
        try? FileManager.default.removeItem(at: url(for: record))
        return images
    }
    private func writeIndex(_ images: [SavedImage]) throws {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try JSONEncoder().encode(ImageIndex(images: images)).write(to: indexURL, options: [.atomic, .completeFileProtection])
    }
}
