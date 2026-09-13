import SwiftUI

struct ModelManagerView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var library: ModelLibrary
    @State private var pendingDelete: DownloadableModel?
    @State private var showDelete = false
    var body: some View {
        List {
            Section("Current engine") {
                Text(store.engineName).font(.headline)
                Text(store.engineStatus.detail).font(.subheadline).foregroundStyle(.secondary)
                if store.isSwitchingEngine {
                    ProgressView("Loading model…")
                    Button("Cancel loading", role: .destructive) { store.cancelModelLoad() }
                }
                Button("Use Apple on-device model") { store.useAppleModel() }
                    .disabled(!store.canSwitchEngine || library.isBusy)
            }
            Section("Downloads") {
                Toggle("Allow cellular downloads", isOn: $library.allowCellular)
                    .disabled(library.isBusy || store.isSwitchingEngine)
                Text("Downloads use the internet; replies use your downloaded files locally. Keep the app visible during downloads. Cancellation removes the unfinished download; retry starts it again.")
                    .font(.caption).foregroundStyle(.secondary)
                if !library.status.isEmpty { Text(library.status).font(.subheadline) }
            }
            ForEach(library.catalog) { model in
                Section(model.name) {
                    LabeledContent("Download size", value: model.sizeLabel)
                    LabeledContent("Files", value: library.installedIDs.contains(model.id) ? "Downloaded" : "Not downloaded")
                    Text("Storage size does not predict memory use or speed. Start with the smaller model; performance on this iPhone still needs testing.")
                        .font(.caption).foregroundStyle(.secondary)
                    if library.activeModelID == model.id && !store.isSwitchingEngine {
                        ProgressView(value: library.progress)
                        Button("Cancel download", role: .destructive) { library.cancel() }
                    } else if library.installedIDs.contains(model.id) {
                        Button("Load for chat") { store.selectModel(model, library: library) }
                            .disabled(!store.canSwitchEngine || library.isBusy)
                        Button("Delete model files", role: .destructive) { pendingDelete = model; showDelete = true }
                            .disabled(!store.canSwitchEngine || library.isBusy || store.data.selectedModelID == model.id)
                        if store.data.selectedModelID == model.id {
                            Text("Choose the Apple model before deleting these files.").font(.caption).foregroundStyle(.secondary)
                        }
                    } else {
                        Button("Download \(model.sizeLabel)") { library.startDownload(model) }
                            .disabled(library.isBusy || store.isSwitchingEngine)
                        // Also permits cleanup of a failed/corrupted installation.
                        Button("Remove incomplete files", role: .destructive) { pendingDelete = model; showDelete = true }
                            .disabled(library.isBusy || !store.canSwitchEngine || store.data.selectedModelID == model.id)
                    }
                    Link("Model details and license", destination: URL(string: "https://huggingface.co/" + model.id)!)
                }
            }
        }
        .navigationTitle("Models")
        .onAppear { library.refresh(); store.refreshEngine() }
        .alert("Delete model files?", isPresented: $showDelete, presenting: pendingDelete, actions: { model in
            Button("Delete", role: .destructive) {
                do { try library.delete(model) } catch { store.error = error.localizedDescription }
            }
            Button("Cancel", role: .cancel) {}
        }, message: { model in
            Text("This removes \(model.name) from this app. Your conversations and memory notes remain.")
        })
    }
}
