---
name: qtn-package-verification
description: Build or inspect this repository's VSCode VSIX, Rider ZIP, and Visual Studio VSIX artifacts and verify their extracted QTN server. Use for packaging, runtime launcher, bundle, or release validation work.
---

# QTN package verification

Read [RUNTIME_PACKAGING.md](../../../docs/RUNTIME_PACKAGING.md) for payload layout and runtime guarantees. The three IDEs share the webpack server bundle. VSCode uses its host Node; Rider and Visual Studio ship pinned private runtimes.

## Select the artifact

- For a new local VSCode build, run `npm run verify -- --profile package` at the repository root. It runs the full suite, builds a fresh VSIX, and checks that exact archive. The report directory contains the archive and logs.
- For an existing VSIX, use `npm run test:package -- vscode <archive>` for VSCode or `npm run test:package -- vs <archive>` for Visual Studio. They are different layouts despite sharing the `.vsix` suffix.
- For Rider, use `npm run test:package -- jetbrains <archive>`. For source builds, follow [Rider build instructions](../../../packages/jetbrains-plugin/README.md#building-from-source): JDK 21, shared server bundle, and prepared private runtimes precede Gradle packaging.
- Visual Studio source builds require Windows and the VS build tools described in [HOW_TO_INSTALL.md](../../../docs/HOW_TO_INSTALL.md). Do not reinterpret a missing toolchain as a package defect.

Use the existing `scripts/test-packaged-server.mjs` rather than unpacking by hand or launching a server from the source tree. It checks required files, rejects bundled node_modules, validates runtimes where applicable, and exercises initialization, completion, hover, definition and clean shutdown from a path containing spaces and Korean characters. It tests with empty and broken system Node paths without altering the host installation.

## Interpret the evidence

- `--inspect-only` checks archive structure and runtime hashes, not executable startup.
- Rider/VS execution uses the current machine's matching bundled runtime. One platform passing does not validate every runtime; the existing release workflow covers native platform combinations.
- VSCode package execution uses the test host Node and does not launch Extension Host. None of these scripts proves actual IDE UI behavior.
- If packaging inputs change after verification, rebuild and test the resulting archive. Do not describe an older archive as evidence for the changed inputs.
- Keep immutable runtime hashes and license files intact. Runtime updates belong in `scripts/node-runtime-manifest.json` and preparation code, not copied executables or generated bundle edits.

Report the artifact path, platform, command, and any unexecuted native checks. Building and verification are local actions; this skill does not itself request a publish, install, tag, or push. Follow the user's existing authorization for those actions.
