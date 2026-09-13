#!/bin/bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
if [[ "$(uname -s)" != "Darwin" ]] || ! command -v xcodebuild >/dev/null 2>&1; then
    echo 'This native iPhone project requires Xcode on a compatible Mac.' >&2
    exit 1
fi
xcodebuild -version
xcodebuild -project "$project_root/PocketAI.xcodeproj" -scheme PocketAI \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$project_root/build" CODE_SIGNING_ALLOWED=NO build
if [[ $# -ge 1 ]]; then
    xcodebuild -project "$project_root/PocketAI.xcodeproj" -scheme PocketAI \
        -destination "platform=iOS Simulator,id=$1" \
        -derivedDataPath "$project_root/build" CODE_SIGNING_ALLOWED=NO test
else
    echo 'Build finished. To run XCTest, pass an installed simulator UUID as the first argument.'
    xcrun simctl list devices available
fi
