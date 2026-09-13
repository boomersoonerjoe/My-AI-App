import Foundation
import MLXLLM
import MLXLMCommon
import MLXHuggingFace
import Tokenizers

@MainActor
final class UnavailableChatEngine: ChatEngine {
    let name: String
    let availability: EngineAvailability
    init(name: String, detail: String) {
        self.name = name
        self.availability = EngineAvailability(isReady: false, detail: detail)
    }
    func generate(_ request: ChatRequest, onUpdate: @escaping @MainActor (String) -> Void) async throws -> String {
        throw ChatError.unavailable(availability.detail)
    }
}

@MainActor
final class MLXChatEngine: ChatEngine {
    let name: String
    private let container: ModelContainer
    var availability: EngineAvailability {
        EngineAvailability(isReady: true, detail: "\(name) is loaded from this device. Chat runs locally.")
    }
    private init(name: String, container: ModelContainer) { self.name = name; self.container = container }
    static func load(model: DownloadableModel, directory: URL) async throws -> MLXChatEngine {
        try Task.checkCancellation()
        // This overload takes a local directory and no downloader. Tokenizer files are local too.
        let container = try await LLMModelFactory.shared.loadContainer(
            from: directory, using: #huggingFaceTokenizerLoader())
        try Task.checkCancellation()
        return MLXChatEngine(name: model.name, container: container)
    }
    func generate(_ request: ChatRequest, onUpdate: @escaping @MainActor (String) -> Void) async throws -> String {
        try Task.checkCancellation()
        let session = ChatSession(container,
            instructions: "Answer concisely using relevant user-provided context. Be candid about uncertainty. You have no web access or app-control tools.",
            generateParameters: GenerateParameters(maxTokens: 512, temperature: 0.6),
            additionalContext: ["enable_thinking": false])
        var response = ""
        do {
            // MLX emits text deltas, unlike Apple's cumulative snapshots.
            for try await chunk in session.streamResponse(to: request.prompt) {
                try Task.checkCancellation()
                response += chunk
                onUpdate(response)
            }
            await session.synchronize()
            try Task.checkCancellation()
        } catch {
            // Wait until outstanding KV-cache/GPU work finishes before another engine can load.
            await session.synchronize()
            throw error
        }
        guard !response.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw ChatError.emptyResponse }
        return response
    }
}
