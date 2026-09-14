import Foundation

/// Stable destination for chat work. UI and persistence should depend on this
/// route, not on a specific vendor or server implementation.
enum ChatRoute: Equatable {
    case appleOnDevice
    case localDownloadable(id: String)
    /// Reserved for a later private remote/server engine. V1 never selects this.
    case remoteUnavailable(reason: String)
}

enum ChatRouter {
    static let remotePlaceholderReason = "Remote chat is not connected in Version 1. Replies stay on this device."

    static func route(selectedModelID: String?) -> ChatRoute {
        guard let id = selectedModelID?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty else {
            return .appleOnDevice
        }
        return .localDownloadable(id: id)
    }

    static func describe(_ route: ChatRoute) -> String {
        switch route {
        case .appleOnDevice:
            return "Local · Apple on-device"
        case .localDownloadable(let id):
            return "Local · Downloaded model \(id)"
        case .remoteUnavailable:
            return "Remote · Not connected"
        }
    }

    static func placeholderEngine(for route: ChatRoute) -> any ChatEngine {
        switch route {
        case .appleOnDevice:
            return AppleChatEngine()
        case .localDownloadable(let id):
            return UnavailableChatEngine(
                name: "Saved local model",
                detail: "Select your saved model in Settings > Models to load it: \(id)"
            )
        case .remoteUnavailable(let reason):
            return UnavailableChatEngine(name: "Remote chat", detail: reason)
        }
    }
}
