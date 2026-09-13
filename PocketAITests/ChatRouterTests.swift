import XCTest
@testable import PocketAI

final class ChatRouterTests: XCTestCase {
    func testNilOrBlankSelectionUsesAppleOnDevice() {
        XCTAssertEqual(ChatRouter.route(selectedModelID: nil), .appleOnDevice)
        XCTAssertEqual(ChatRouter.route(selectedModelID: ""), .appleOnDevice)
        XCTAssertEqual(ChatRouter.route(selectedModelID: "   "), .appleOnDevice)
    }

    func testSavedDownloadableIDRoutesLocally() {
        XCTAssertEqual(ChatRouter.route(selectedModelID: "mlx-community/Qwen3-0.6B-4bit"), .localDownloadable(id: "mlx-community/Qwen3-0.6B-4bit"))
    }

    func testV1NeverSelectsRemote() {
        XCTAssertNotEqual(ChatRouter.route(selectedModelID: nil), .remoteUnavailable(reason: ChatRouter.remotePlaceholderReason))
        XCTAssertNotEqual(ChatRouter.route(selectedModelID: "any-id"), .remoteUnavailable(reason: ChatRouter.remotePlaceholderReason))
    }

    func testDescriptionsStayProviderNeutral() {
        XCTAssertTrue(ChatRouter.describe(.appleOnDevice).contains("Local"))
        XCTAssertTrue(ChatRouter.describe(.localDownloadable(id: "demo")).contains("Local"))
        XCTAssertTrue(ChatRouter.describe(.remoteUnavailable(reason: ChatRouter.remotePlaceholderReason)).contains("Not connected"))
    }
}
