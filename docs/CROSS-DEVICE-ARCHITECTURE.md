# PocketAI Cross-Device Architecture

PocketAI is a private personal AI system for one owner. It is not an iPhone-only product, and the current Swift app is one client of the larger system.

## Platform goal
PocketAI should remain accessible from multiple device types where practical, including iPhone/iPad, Mac, Windows, and Linux/Chromebook-class devices. A client platform must not own the intelligence, persistent memory, routing contracts, or private-server architecture in a way that forces those pieces to be rebuilt for another client.

Target direction:

`PocketAI clients -> stable PocketAI interface/routing layer -> local engine when practical OR private remote/server engine -> persistent owner memory/data`

## Apple boundary
Apple-specific frameworks belong in the Apple client or Apple adapter layers. Xcode is an Apple-client build/test tool, not a requirement or architectural foundation for the entire PocketAI system.

The owner's available 2017 Intel MacBook Air running macOS Monterey 12.7.6 may use an older compatible Xcode for the subset of Apple-client development and validation that toolchain supports. Do not downgrade PocketAI's overall architecture or quality merely to satisfy that older Xcode. Modern iOS-specific validation can be performed later with compatible newer Apple tooling.

## Server portability
Remote/heavy AI work may use a private VPS initially. Preserve stable interfaces so that VPS can later be replaced by the owner's physical AI server without rebuilding the clients or core system contracts.

## Development guardrails
- Device independence is a first-class requirement.
- The Swift/iPhone app is one PocketAI client, not PocketAI itself.
- Keep local and remote engines behind stable interfaces.
- Prefer local/private behavior where practical; remote use should be intentional.
- Do not couple the whole project to a particular iOS release, Xcode version, AI provider, VPS provider, or hardware platform.
- Do not sacrifice project quality merely to accommodate legacy development hardware.
- Distinguish source code that exists from behavior actually validated on a supported toolchain/device.
