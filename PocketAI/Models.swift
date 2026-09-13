import Foundation

enum MessageRole: String, Codable { case user, assistant }
struct Message: Codable, Identifiable, Equatable {
    var id = UUID()
    var text: String
    var createdAt = Date()
    var role: MessageRole = .user
    init(text: String, role: MessageRole = .user) {
        self.text = text
        self.role = role
    }
    private enum CodingKeys: String, CodingKey { case id, text, createdAt, role }
    init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        id = try values.decode(UUID.self, forKey: .id)
        text = try values.decode(String.self, forKey: .text)
        createdAt = try values.decode(Date.self, forKey: .createdAt)
        // The saved 0.1 checkpoint had only user messages, without a role field.
        role = try values.decodeIfPresent(MessageRole.self, forKey: .role) ?? .user
    }
}
struct Conversation: Codable, Identifiable, Equatable {
    var id = UUID()
    var title = "New conversation"
    var messages: [Message] = []
}
struct MemoryNote: Codable, Identifiable, Equatable {
    var id = UUID()
    var text: String
}
struct ImageDraft: Codable, Identifiable, Equatable {
    var id = UUID()
    var prompt: String
    var negativePrompt: String
    var size: String
}
struct AppData: Codable, Equatable {
    var schemaVersion = 1
    var selectedModelID: String?
    var conversations: [Conversation] = []
    var memories: [MemoryNote] = []
    var imageDrafts: [ImageDraft] = []
}
enum StorageError: LocalizedError {
    case unsupportedVersion
    var errorDescription: String? { "This data was saved by a newer app version. Update the app before editing it." }
}
struct LocalRepository {
    let url: URL
    func load() throws -> AppData {
        guard FileManager.default.fileExists(atPath: url.path) else { return AppData() }
        let result = try JSONDecoder().decode(AppData.self, from: Data(contentsOf: url))
        guard result.schemaVersion == 1 else { throw StorageError.unsupportedVersion }
        return result
    }
    func save(_ data: AppData) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let bytes = try JSONEncoder().encode(data)
        #if os(iOS)
        try bytes.write(to: url, options: [.atomic, .completeFileProtection])
        #else
        try bytes.write(to: url, options: .atomic)
        #endif
    }
}
