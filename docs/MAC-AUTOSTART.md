# Mac login startup — installed October 2, 2026

This Mac now starts the existing NhomeAI local services at user login using two user LaunchAgents:

- `~/Library/LaunchAgents/com.nhomeai.ollama.plist`
- `~/Library/LaunchAgents/com.nhomeai.web.plist`

Both have RunAtLoad and KeepAlive enabled, with a 10-second restart throttle. They run as the logged-in user without sudo and remain independent of Codex or an open terminal. They start after login, not before login or FileVault unlock.

Ollama runs the existing `/Users/joesmac/Documents/NhomeAI/.local-ai/runtime/ollama serve` binary. Its environment matches `scripts/start-local-ai.sh`: loopback port 11434, cloud disabled, existing workspace models, context 4096, one parallel request and one loaded model, and the existing allowed origins. The web job runs the existing bundled Node executable with `web/scripts/server.mjs` from the web directory and serves loopback port 4173. No runtime, model, browser storage, or build was replaced.

The agents invoke binaries directly because macOS privacy controls denied background zsh access to script files in Documents. Direct runtime startup was verified successfully without changing privacy permissions.

Logs: `.local-ai/launchd-ollama.log` and `.local-ai/launchd-web.log`. Early shell-access errors in these logs precede the final working direct-runtime configuration.

Validation: both plists passed lint; launchd loaded both jobs and started services; terminating both processes caused launchd to restart them with new PIDs and incremented run counts; the page returned HTTP 200 and the original model generated Ready. A full reboot still requires owner verification.

## Owner reboot test

1. Restart the Mac and log in to this same macOS account. Do not manually start scripts or open Codex to start services.
2. Wait about 20 seconds, then reopen NhomeAI in the same browser/profile at the same address used for saved chats (normally http://127.0.0.1:4173).
3. Confirm saved conversations and memory remain. NhomeAI now checks local Ollama automatically on opening and retries twice at two-second intervals if login startup is still in progress. The status should become Ready without clicking Connect local Ollama. If the service or model remains unavailable, the app shows the error and keeps manual retry available.
4. Send a message and confirm a local reply, then check recall of the facts from the original persistence test.
5. Report any error text if startup fails. Do not clear browser/site data or switch browser profiles during this test.

Keep the workspace and bundled Node paths in place. These jobs refer to their current absolute paths. Do not launch duplicate manual services while the agents are enabled.

Owner verified that reboot persistence passed: conversations, memory, internet retrieval, and independent Ollama startup all survived. The automatic UI connection fix was added afterward; another full reboot has not been performed by the agent.

To inspect: `launchctl print gui/$(id -u)/com.nhomeai.ollama` and the same command with `com.nhomeai.web`.
