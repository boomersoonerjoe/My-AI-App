import SwiftUI

@main
struct PocketAIApp: App {
    @StateObject private var store = AppStore.live()
    @StateObject private var models = ModelLibrary.live()
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store).environmentObject(models).tint(.teal)
                .alert("Pocket AI", isPresented: Binding(
                    get: { store.error != nil },
                    set: { if !$0 { store.error = nil } }
                ), actions: {
                    Button("OK") { store.error = nil }
                }, message: {
                    Text(store.error ?? "")
                })
        }
    }
}
struct RootView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var models: ModelLibrary
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        TabView {
            ChatList().tabItem { Label("Chat", systemImage: "bubble.left.and.bubble.right") }
            ImageWorkspace().tabItem { Label("Images", systemImage: "photo") }
            MemoryList().tabItem { Label("Memory", systemImage: "brain.head.profile") }
            SettingsView().tabItem { Label("Settings", systemImage: "slider.horizontal.3") }
        }
        .onChange(of: scenePhase) {
            if scenePhase == .active { store.refreshEngine() }
            if scenePhase == .background { store.stopReply(); store.cancelModelLoad(); models.cancel() }
        }
    }
}
struct EngineNotice: View {
    let title: String
    let detail: String
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: "iphone").font(.headline)
            Text(detail).font(.subheadline).foregroundStyle(.secondary)
        }.padding().frame(maxWidth: .infinity, alignment: .leading)
            .background(.teal.opacity(0.09), in: RoundedRectangle(cornerRadius: 16))
    }
}
struct ChatList: View {
    @EnvironmentObject private var store: AppStore
    @State private var path: [UUID] = []
    var body: some View {
        NavigationStack(path: $path) {
            List {
                EngineNotice(title: "Your personal AI", detail: store.engineStatus.detail)
                    .listRowSeparator(.hidden)
                if store.data.conversations.isEmpty {
                    ContentUnavailableView("A fresh start", systemImage: "bubble.left", description: Text("Tap + to create your first conversation."))
                }
                ForEach(store.data.conversations) { conversation in
                    NavigationLink(value: conversation.id) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(conversation.title).font(.headline).lineLimit(1)
                            Text(conversation.messages.last?.text ?? "No messages yet")
                                .font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                        }.padding(.vertical, 4)
                    }
                }.onDelete(perform: store.deleteConversations)
            }.navigationTitle("Pocket AI")
                .toolbar { Button { if let id = store.newConversation() { path.append(id) } } label: {
                    Image(systemName: "plus")
                }.accessibilityLabel("New conversation").disabled(!store.storageAvailable) }
                .navigationDestination(for: UUID.self) { ChatDetail(id: $0) }
        }
    }
}
struct ChatDetail: View {
    @EnvironmentObject private var store: AppStore
    let id: UUID
    @State private var draft = ""
    private var conversation: Conversation? { store.data.conversations.first { $0.id == id } }
    var body: some View {
        VStack(spacing: 0) {
            EngineNotice(title: store.engineName, detail: store.engineStatus.detail)
                .padding()
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .trailing, spacing: 14) {
                        ForEach(conversation?.messages ?? []) { message in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(message.role == .user ? "You · Saved locally" : "AI · Generated locally")
                                    .font(.caption).foregroundStyle(.secondary)
                                Text(message.text).textSelection(.enabled)
                            }.padding().background(.teal.opacity(0.12), in: RoundedRectangle(cornerRadius: 18))
                                .id(message.id)
                        }
                        if store.activeConversation == id {
                            VStack(alignment: .leading, spacing: 8) {
                                ProgressView("Replying on device…")
                                Text(store.streamedReply).textSelection(.enabled)
                                Button("Stop reply", role: .destructive) { store.stopReply() }
                            }.frame(maxWidth: .infinity, alignment: .leading)
                        }
                        if store.unsavedConversation == id, let reply = store.unsavedReply {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Reply not saved yet").font(.headline)
                                Text(reply.text).textSelection(.enabled)
                                Button("Save response") { store.savePendingReply() }
                                Button("Discard response", role: .destructive) { store.discardPendingReply() }
                            }
                        }
                        if store.noticeConversation == id, let notice = store.replyNotice {
                            Text(notice).font(.caption).foregroundStyle(.secondary)
                        }
                        if conversation?.messages.last?.role == .user && store.canGenerate {
                            Button("Reply to last message") { store.reply(to: id) }
                        }
                        Color.clear.frame(height: 1).id("latest")
                    }.padding()
                }.onChange(of: store.streamedReply) {
                    proxy.scrollTo("latest", anchor: .bottom)
                }.onChange(of: conversation?.messages.count) {
                    if let last = conversation?.messages.last { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
            HStack(alignment: .bottom) {
                TextField("Write a message…", text: $draft, axis: .vertical).lineLimit(1...6)
                    .padding(12).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
                Button(store.engineStatus.isReady ? "Send" : "Save") {
                    let succeeded = store.engineStatus.isReady
                        ? store.send(draft, in: id)
                        : store.saveMessage(draft, in: id)
                    if succeeded { draft = "" }
                }
                .buttonStyle(.borderedProminent)
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !store.storageAvailable
                          || store.activeConversation != nil || store.unsavedReply != nil)
            }.padding()
        }.navigationTitle(conversation?.title ?? "Conversation").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Button("Save only") { if store.saveMessage(draft, in: id) { draft = "" } }
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !store.storageAvailable
                              || store.activeConversation != nil || store.unsavedReply != nil)
            }
    }
}
struct ImageWorkspace: View {
    @EnvironmentObject private var store: AppStore
    @State private var prompt = ""
    @State private var negative = ""
    @State private var size = "512 × 512"
    @State private var saved = false
    var body: some View {
        NavigationStack {
            Form {
                EngineNotice(title: "Create on your iPhone", detail: "Image engine not connected yet. Save ideas now; generate after the local engine passes its device test.")
                Section("Describe your image") {
                    TextField("What would you like to create?", text: $prompt, axis: .vertical).lineLimit(3...8)
                    TextField("Things to avoid (optional)", text: $negative, axis: .vertical).lineLimit(2...4)
                    Picker("Size", selection: $size) {
                        ForEach(["512 × 512", "512 × 768", "768 × 512"], id: \.self) { Text($0) }
                    }
                }
                Section {
                    Button("Save image idea") {
                        if store.saveImageDraft(prompt: prompt, negative: negative, size: size) { saved = true }
                    }.disabled(prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !store.storageAvailable)
                    Label("Generation unavailable until a model is connected", systemImage: "info.circle")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("Saved ideas") {
                    ForEach(store.data.imageDrafts) { draft in
                        Button {
                            prompt = draft.prompt; negative = draft.negativePrompt; size = draft.size
                        } label: {
                            VStack(alignment: .leading) {
                                Text(draft.prompt).foregroundStyle(.primary).lineLimit(2)
                                Text(draft.size).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }.onDelete(perform: store.deleteImageDrafts)
                }
            }.navigationTitle("Images")
                .alert("Image idea saved", isPresented: $saved) { Button("OK", role: .cancel) {} }
        }
    }
}
struct MemoryList: View {
    @EnvironmentObject private var store: AppStore
    @State private var editing: MemoryNote?
    @State private var showEditor = false
    var body: some View {
        NavigationStack {
            List {
                Text("Choose what your AI should remember. Replies receive a limited excerpt of these notes and recent messages. Older or longer context may be omitted.")
                    .font(.subheadline).foregroundStyle(.secondary)
                ForEach(store.data.memories) { memory in
                    Button { editing = memory; showEditor = true } label: {
                        Text(memory.text).foregroundStyle(.primary)
                    }
                }.onDelete(perform: store.deleteMemories)
            }.navigationTitle("Memory")
                .toolbar { Button { editing = nil; showEditor = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Add memory").disabled(!store.storageAvailable) }
                .sheet(isPresented: $showEditor) { MemoryEditor(note: editing) }
        }
    }
}
struct MemoryEditor: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let note: MemoryNote?
    @State private var text: String
    init(note: MemoryNote?) { self.note = note; _text = State(initialValue: note?.text ?? "") }
    var body: some View {
        NavigationStack {
            Form { TextField("Something to remember…", text: $text, axis: .vertical).lineLimit(4...12) }
                .navigationTitle(note == nil ? "New memory" : "Edit memory")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") { if store.saveMemory(text, id: note?.id) { dismiss() } }
                            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
        }
    }
}
struct SettingsView: View {
    @EnvironmentObject private var store: AppStore
    var body: some View {
        NavigationStack {
            Form {
                Section("Processing") {
                    LabeledContent("Route", value: ChatRouter.describe(store.chatRoute))
                    LabeledContent("Default", value: "Local")
                    NavigationLink { ModelManagerView() } label: {
                        LabeledContent("Chat model", value: store.engineName)
                    }
                    LabeledContent("Image model", value: "Not connected")
                    LabeledContent("Cloud", value: "Not connected")
                }
                Section("Local model") {
                    Text(store.engineStatus.detail)
                    Button("Refresh model status") { store.refreshEngine() }
                    Text("Choose Apple’s system model or a downloaded model in Models. Keep the app visible while it replies; moving it to the background stops generation.")
                    Text("The model has no web access or connected apps. Replies may be inaccurate; the first version limits context and response length.")
                }
                if store.activeConversation != nil {
                    Section("Active reply") { Button("Stop reply") { store.stopReply() } }
                }
                if let reply = store.unsavedReply {
                    Section("Unsaved response") {
                        Text(reply.text).textSelection(.enabled)
                        Button("Save response") { store.savePendingReply() }
                        Button("Discard response", role: .destructive) { store.discardPendingReply() }
                    }
                }
                Section("Cloud control") {
                    Text("Cloud connections arrive in a later section. This build has no cloud generation, API keys, or paid requests. Model downloads use Hugging Face.")
                }
                Section("About your data") {
                    Text("Conversations, memory notes, and image ideas are saved in this app on your device. Your device backup settings may include app data. Removing the app can remove its data.")
                }
                Section("Build") {
                    LabeledContent("Version", value: "0.3 · Downloadable models")
                    Text("Next: test local models on your iPhone. Image generation remains deferred until after V1 chat.")
                }
            }.navigationTitle("Settings")
        }
    }
}
