import XCTest
import Combine
@testable import PocketAI

final class PersistenceTests: XCTestCase {
    private var folder: URL!
    override func setUpWithError() throws {
        folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    }
    override func tearDownWithError() throws { try FileManager.default.removeItem(at: folder) }
    private var repository: LocalRepository { LocalRepository(url: folder.appendingPathComponent("state.json")) }

    func testSavedDataSurvivesRelaunch() throws {
        var data = AppData()
        var chat = Conversation()
        chat.messages = [Message(text: "Hello"), Message(text: "Hi Joe", role: .assistant)]
        data.conversations = [chat]
        data.memories = [MemoryNote(text: "Prefer concise answers")]
        data.imageDrafts = [ImageDraft(prompt: "A farm", negativePrompt: "text", size: "512 × 512")]
        try repository.save(data)
        XCTAssertEqual(try LocalRepository(url: repository.url).load(), data)
    }
    func testOldMessagesWithoutRolesRemainReadable() throws {
        let bytes = try JSONEncoder().encode(Message(text: "Legacy message"))
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: bytes) as? [String: Any])
        json.removeValue(forKey: "role")
        let decoded = try JSONDecoder().decode(Message.self, from: JSONSerialization.data(withJSONObject: json))
        XCTAssertEqual(decoded.role, .user)
        XCTAssertEqual(decoded.text, "Legacy message")
    }
    func testUnknownSchemaCannotLoad() throws {
        var data = AppData()
        data.schemaVersion = 999
        try repository.save(data)
        XCTAssertThrowsError(try repository.load())
    }
    @MainActor
    func testCorruptedDataIsNeverOverwrittenByApp() throws {
        let corrupt = Data("broken json".utf8)
        try corrupt.write(to: repository.url)
        let store = AppStore(repository: repository, engine: TestEngine())
        XCTAssertFalse(store.storageAvailable)
        XCTAssertNil(store.newConversation())
        XCTAssertEqual(try Data(contentsOf: repository.url), corrupt)
    }
    @MainActor
    func testFailedSaveDoesNotChangeVisibleState() throws {
        let store = AppStore(repository: repository, engine: TestEngine())
        _ = store.newConversation()
        let before = store.data
        try FileManager.default.removeItem(at: repository.url)
        try FileManager.default.removeItem(at: folder)
        // A regular file at the parent path forces the next write to fail, even on privileged test hosts.
        try Data("blocks directory creation".utf8).write(to: folder)
        XCTAssertFalse(store.saveMemory("Do not lose existing state", id: nil))
        XCTAssertEqual(store.data, before)
        XCTAssertNotNil(store.error)
    }
    func testContextBoundsAndCurrentMessagePreserved() throws {
        var conversation = Conversation()
        conversation.messages = (0..<40).map { Message(text: "Old message \($0): " + String(repeating: "x", count: 100)) }
        conversation.messages.append(Message(text: "My latest question"))
        let request = try ChatContext.request(conversation: conversation, memories: [MemoryNote(text: String(repeating: "🌻", count: 1000))])
        XCTAssertLessThan(request.prompt.utf8.count, 2800)
        XCTAssertTrue(request.prompt.contains("My latest question"))
        XCTAssertFalse(request.prompt.contains("Old message 0:"))
    }
    func testOversizedCurrentMessageIsNotSilentlyTruncated() {
        var conversation = Conversation()
        conversation.messages = [Message(text: String(repeating: "x", count: 1201))]
        XCTAssertThrowsError(try ChatContext.request(conversation: conversation, memories: []))
    }
    func testBytePrefixDoesNotBreakEmoji() {
        XCTAssertEqual(ChatContext.prefix("🌻🌻a", bytes: 5), "🌻")
    }
}

@MainActor
final class TestEngine: ChatEngine {
    let name = "Test engine"
    var availability = EngineAvailability(isReady: true, detail: "Tests only")
    var beforeReturn: (() -> Void)?
    var shouldWait = false
    var didStart: (() -> Void)?
    func generate(_ request: ChatRequest, onUpdate: @escaping @MainActor (String) -> Void) async throws -> String {
        onUpdate("Partial")
        didStart?()
        if shouldWait { try await Task.sleep(nanoseconds: 30_000_000_000) }
        beforeReturn?()
        return "Completed local reply"
    }
}

final class GenerationTests: XCTestCase {
    @MainActor
    func testCancelledReplyIsNotSavedAsCompleted() async throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: folder) }
        let engine = TestEngine()
        engine.shouldWait = true
        let started = expectation(description: "Engine started")
        engine.didStart = { started.fulfill() }
        let store = AppStore(repository: LocalRepository(url: folder.appendingPathComponent("state.json")), engine: engine)
        let id = try XCTUnwrap(store.newConversation())
        let finished = expectation(description: "Reply task finished")
        let subscription = store.$activeConversation.dropFirst().filter { $0 == nil }.sink { _ in finished.fulfill() }
        defer { subscription.cancel() }
        XCTAssertTrue(store.send("Hello", in: id))
        await fulfillment(of: [started], timeout: 2)
        // A second generation must not enter while the first one is running.
        XCTAssertFalse(store.send("Duplicate", in: id))
        store.stopReply()
        await fulfillment(of: [finished], timeout: 2)
        XCTAssertNil(store.activeConversation)
        XCTAssertEqual(store.data.conversations.first?.messages.map(\.role), [.user])
        XCTAssertTrue(store.replyNotice?.contains("Stopped") == true)
    }
    @MainActor
    func testCompletedReplySurvivesFailedDiskWriteAndCanRetry() async throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appendingPathComponent("state.json")
        let engine = TestEngine()
        let store = AppStore(repository: LocalRepository(url: url), engine: engine)
        let id = try XCTUnwrap(store.newConversation())
        engine.beforeReturn = {
            // Replace state.json with a directory so atomic file replacement fails.
            do {
                try FileManager.default.removeItem(at: url)
                try FileManager.default.createDirectory(at: url, withIntermediateDirectories: false)
            } catch { XCTFail("Could not prepare write failure: \(error)") }
        }
        let finished = expectation(description: "Reply retained after failed save")
        let subscription = store.$activeConversation.dropFirst().filter { $0 == nil }.sink { _ in finished.fulfill() }
        defer { subscription.cancel() }
        XCTAssertTrue(store.send("Hello", in: id))
        await fulfillment(of: [finished], timeout: 2)
        XCTAssertEqual(store.unsavedReply?.text, "Completed local reply")
        XCTAssertFalse(store.canGenerate)
        try FileManager.default.removeItem(at: url)
        store.savePendingReply()
        XCTAssertNil(store.unsavedReply)
        XCTAssertEqual(try LocalRepository(url: url).load().conversations.first?.messages.last?.role, .assistant)
    }
}
