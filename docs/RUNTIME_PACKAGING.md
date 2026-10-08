# Bundled QTN runtime

Visual Studio and Rider ship Node.js 22.23.3 with the shared webpack language-server bundle. Users do not need Node.js, npm, PATH changes, or a runtime download at startup. VSCode continues to use its own runtime.

Visual Studio ships `win-x64`. Rider ships `win-x64`, `win-arm64`, `darwin-x64`, `darwin-arm64`, `linux-x64`, and `linux-arm64` in one ZIP. Linux uses the official glibc binaries; musl-based systems are not a bundled target. Rider selects the architecture of the running JVM, including an IDE running under emulation. Official Node platform requirements still apply.

## Building

Use Node.js 22 for source builds and JDK 21 for local Rider builds. The Docker builder supplies both. Visual Studio VSIX packaging requires Windows and the .NET SDK.

```sh
npm ci
npm --prefix packages/language-server ci
npm run bundle:server
npm run prepare:runtimes -- --target=vs        # Windows x64 only
npm run prepare:runtimes -- --target=jetbrains # All six platforms
```

The existing `scripts/build.sh vs`, `jetbrains`, and `all` commands prepare the necessary runtimes automatically. A direct Gradle or MSBuild invocation verifies that preparation has already completed and fails if files are absent or corrupt.

`scripts/node-runtime-manifest.json` pins the Node version, official archive names, and SHA-256 hashes. Downloads are cached in ignored `dist/node-downloads`; prepared files are in ignored `dist/node-runtimes`. Each packaged runtime contains only `node`/`node.exe`, `LICENSE` (including Node's third-party notices), and `runtime.json` with provenance and an executable checksum. Never commit downloaded binaries.

Both packages install these files under `runtimes/<platform>-<arch>/`. Launchers use that absolute executable path and never fall back to a system Node. Rider preserves/repairs the Unix execute bit. A missing or unusable runtime disables IntelliSense with an actionable notice; TextMate highlighting remains available. VS diagnostics appear in **Output → QTN Language Server**, and Rider diagnostics in the IDE log.

## Verification

```sh
npm run test:runtimes
npm run test:package -- vs path/to/QtnLSP-vs.vsix
npm run test:package -- jetbrains path/to/QtnLSP-jetbrains.zip
```

Package tests unpack the actual artifact into a path containing spaces and Korean characters. They verify all required runtimes and notices, reject unexpected runtime payloads, and launch the current platform's packaged executable and server. LSP initialization, completion, hover, definition, and clean shutdown are tested with both an empty PATH and a broken Node on PATH. They do not uninstall or alter the host's Node installation. `--inspect-only` checks packaging without claiming executable verification.

CI runs the Rider ZIP on all six native OS/CPU runner combinations and the VSIX on Windows x64. Marketplace publishing consumes the tested artifacts only after these jobs pass. Rider packages must remain below the Marketplace 400 MB limit.

Before releasing, also install the actual packages into disposable IDE profiles without a system Node:

- VS 2022 and VS 2026: open a `.qtn` file and verify IntelliSense without an activation-failure task.
- Rider: verify IntelliSense and the Unix execute-bit repair on supported systems.
- Remove the bundled runtime, or deny execution in a disposable installation: verify one non-modal warning per session, useful diagnostics, and preserved highlighting.
- These GUI checks are separate from protocol smoke tests. Record each environment as passed, failed, or not run; a packaged-server test alone does not prove IDE UI behavior.

## Runtime updates

Update the version, archive names, and all six checksums together from the official Node release's `SHASUMS256.txt`. Update CI/Docker and versioned documentation in the same change, rebuild both packages, and rerun the full platform matrix. A matching cached download is always rehashed before extraction. Do not use a moving `latest` URL in builds.

Node 22 was chosen to retain compatibility with older macOS versions used by existing Rider installations. Plan its replacement before its support ends on 2027-04-30, checking OS requirements before switching release lines. Runtime updates are delivered through normal extension updates.

Release note: Visual Studio and Rider now include the Node runtime required by QTN IntelliSense. Separate Node installation is no longer necessary; downloads and installed plugins are larger because they include the runtime.
