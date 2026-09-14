import Foundation
import Combine

@MainActor
final class AppStore: ObservableObject {
    @Published private(set) var data = AppData()
    @Published var error: String?
    @Published private(set) var storageAvailable = true
    @Published private(set) var engineStatus: EngineAvailability
    @Published private(set) var activeConversation: UUID?
    @Published private(set) var streamedReply = ""
    @Published private(set) var replyNotice: String?
    @Published private(set) var noticeConversation: UUID?
    @Published private(set) var unsavedReply: Message?
    @Published private(set) var unsavedConversation: UUID?
    private var generationTask: Task<Void, Never>?
    @Published private(set) var isSwitchingEngine = false
    private var modelLoadTask: Task<Void, Never>?
    private var engine: any ChatEngine
    var canSwitchEngine: Bool { storageAvailable && generationTask == nil && unsavedReply == nil && !isSwitchingEngine }
    var engineName: String { engine.name }
    var chatRoute: ChatRoute { ChatRouter.route(selectedModelID: data.selectedModelID) }
    var canGenerate: Bool { canSwitchEngine && engineStatus.isReady }
    private let repository: LocalRepository

    init(repository: LocalRepository, engine: any ChatEngine) {
        self.repository = repository
        self.engine = engine
        self.engineStatus = engine.availability
        do { data = try repository.load() }
        catch {
            storageAvailable = false
            self.error = "Saved data could not be opened. It has been left untouched. \(error.localizedDescription)"
        }
    }
    static func live() -> AppStore {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let store = AppStore(repository: LocalRepository(url: root.appendingPathComponent("PocketAI/state.json")), engine: AppleChatEngine())
        store.applyRouteEngine()
        return store
    }
    private func applyRouteEngine() {
        engine = ChatRouter.placeholderEngine(for: chatRoute)
        refreshEngine()
    }
    @discardableResult
    private func change(_ edit: (inout AppData) -> Void) -> Bool {
        guard storageAvailable else {
            error = "Storage is unavailable. Close and reopen the app to retry."
            return false
        }
        var next = data
        edit(&next)
        do {
            try repository.save(next)
            data = next
            return true
        } catch {
            self.error = "Could not save your change. Please try again. \(error.localizedDescription)"
            return false
        }
    }
    func newConversation() -> UUID? {
        let conversation = Conversation()
        return change { $0.conversations.insert(conversation, at: 0) } ? conversation.id : nil
    }
    func deleteConversations(_ offsets: IndexSet) {
        guard generationTask == nil, unsavedReply == nil else {
            error = "Stop the current reply and save or discard any unsaved response before deleting conversations."
            return
        }
        _ = change { value in
            for i in offsets.sorted(by: >) { value.conversations.remove(at: i) }
        }
    }
    func saveMessage(_ text: String, in id: UUID) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard canSwitchEngine, !trimmed.isEmpty,
              let index = data.conversations.firstIndex(where: { $0.id == id }) else { return false }
        return change {
            $0.conversations[index].messages.append(Message(text: trimmed))
            if $0.conversations[index].messages.count == 1 {
                $0.conversations[index].title = String(trimmed.prefix(48))
            }
        }
    }
    func refreshEngine() { engineStatus = engine.availability }

    func useAppleModel() {
        guard canSwitchEngine else { return }
        guard change({ $0.selectedModelID = nil }) else { return }
        engine = AppleChatEngine()
        refreshEngine()
    }
    func selectModel(_ model: DownloadableModel, library: ModelLibrary) {
        guard canSwitchEngine, !library.isBusy else { return }
        isSwitchingEngine = true
        // Drop the previous engine before loading another set of weights.
        engine = UnavailableChatEngine(name: model.name, detail: "Verifying files and loading the model…")
        refreshEngine()
        modelLoadTask = Task { [weak self] in
            guard let self else { return }
            defer { self.isSwitchingEngine = false; self.modelLoadTask = nil }
            do {
                let directory = try await library.verifiedDirectory(for: model)
                let loaded = try await MLXChatEngine.load(model: model, directory: directory)
                try Task.checkCancellation()
                guard self.change({ $0.selectedModelID = model.id }) else {
                    throw ChatError.unavailable("The model choice could not be saved. Try again.")
                }
                self.engine = loaded
            } catch {
                if Task.isCancelled {
                    self.engine = ChatRouter.placeholderEngine(for: self.chatRoute)
                    self.error = "Model loading cancelled. Choose a model to continue."
                } else {
                    // Keep the saved route. Do not silently generate with Apple or a remote provider.
                    self.engine = UnavailableChatEngine(name: model.name, detail: "Model could not load: \(error.localizedDescription)")
                    self.error = self.engine.availability.detail
                }
            }
            self.refreshEngine()
        }
    }
    func cancelModelLoad() { modelLoadTask?.cancel() }

    func forgetDeletedModel(_ model: DownloadableModel) {
        guard data.selectedModelID == model.id else { return }
        guard change({ $0.selectedModelID = nil }) else { return }
        applyRouteEngine()
    }

    @discardableResult
    func send(_ text: String, in id: UUID) -> Bool {
        refreshEngine()
        guard canGenerate else { return false }
        guard let conversation = data.conversations.first(where: { $0.id == id }) else { return false }
        var candidate = conversation
        candidate.messages.append(Message(text: text.trimmingCharacters(in: .whitespacesAndNewlines)))
        do { _ = try ChatContext.request(conversation: candidate, memories: data.memories) }
        catch { replyNotice = error.localizedDescription; noticeConversation = id; return false }
        guard saveMessage(text, in: id) else { return false }
        reply(to: id)
        return true
    }

    func reply(to id: UUID) {
        refreshEngine()
        guard canGenerate, let conversation = data.conversations.first(where: { $0.id == id }),
              conversation.messages.last?.role == .user else { return }
        let request: ChatRequest
        do { request = try ChatContext.request(conversation: conversation, memories: data.memories) }
        catch { replyNotice = error.localizedDescription; noticeConversation = id; return }
        activeConversation = id
        streamedReply = ""
        replyNotice = nil
        noticeConversation = id
        generationTask = Task { [weak self] in
            guard let self else { return }
            defer {
                self.activeConversation = nil
                self.streamedReply = ""
                self.generationTask = nil
            }
            do {
                try Task.checkCancellation()
                let response = try await self.engine.generate(request) { [weak self] partial in
                    self?.streamedReply = partial
                }
                try Task.checkCancellation()
                guard !response.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw ChatError.emptyResponse }
                let message = Message(text: response, role: .assistant)
                if !self.appendReply(message, in: id) {
                    self.unsavedReply = message
                    self.unsavedConversation = id
                }
            } catch {
                self.replyNotice = Task.isCancelled
                    ? "Stopped. Partial reply was not saved. You can retry."
                    : "Local reply failed: \(error.localizedDescription)"
            }
        }
    }

    private func appendReply(_ message: Message, in id: UUID) -> Bool {
        guard let index = data.conversations.firstIndex(where: { $0.id == id }) else { return false }
        return change { $0.conversations[index].messages.append(message) }
    }
    func savePendingReply() {
        guard let reply = unsavedReply, let id = unsavedConversation else { return }
        if appendReply(reply, in: id) { discardPendingReply() }
    }
    func discardPendingReply() { unsavedReply = nil; unsavedConversation = nil }
    func stopReply() { generationTask?.cancel() }

    func saveMemory(_ text: String, id: UUID?) -> Bool {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return change {
            if let id, let index = $0.memories.firstIndex(where: { $0.id == id }) {
                $0.memories[index].text = trimmed
            } else { $0.memories.append(MemoryNote(text: trimmed)) }
        }
    }
    func deleteMemories(_ offsets: IndexSet) {
        _ = change { value in
            for i in offsets.sorted(by: >) { value.memories.remove(at: i) }
        }
    }
    func saveImageDraft(prompt: String, negative: String, size: String) -> Bool {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        return change { $0.imageDrafts.insert(ImageDraft(prompt: trimmed, negativePrompt: negative, size: size), at: 0) }
    }
    func deleteImageDrafts(_ offsets: IndexSet) {
        _ = change { value in
            for i in offsets.sorted(by: >) { value.imageDrafts.remove(at: i) }
        }
    }
}
