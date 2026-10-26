<p align="center">
  <a href="README.md">English</a> | <a href="docs/README.ko.md">한국어</a> | <a href="docs/README.ja.md">日本語</a> | <a href="docs/README.zh-TW.md">繁體中文</a>
</p>

# QtnLSP

Syntax highlighting and Language Server support for Photon Quantum3 DSL (`.qtn`) files, including autocomplete, go-to-definition, hover information, and symbols.

Supports **VSCode**, **JetBrains Rider**, and **Visual Studio 2022**.

## Supported IDEs

| IDE | Version |
|-----|---------|
| VSCode | 1.82+ |
| JetBrains Rider | 2024.3+ |
| Visual Studio | 2022 (17.0+) |

## Installation

VS and Rider include a private Node.js runtime for QTN IntelliSense. No separate Node.js installation or PATH setup is needed, and no runtime is downloaded when the extension starts. VSCode uses its built-in runtime.

### VSCode
- **Marketplace**: [Quantum DSL (QTN) Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.qtn-syntax-highlighting) — or open the **Extensions** view in VSCode and search for `Quantum DSL (QTN)`.
- **CLI**: `code --install-extension shlifedev.qtn-syntax-highlighting`

### Visual Studio 2022
- **Marketplace**: [Quantum DSL (QTN) Language Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.QtnLanguageSupport) — or in Visual Studio go to **Extensions → Manage Extensions → Online** and search for `Quantum DSL (QTN)`.

### JetBrains Rider
- **Marketplace**: [Quantum DSL (QTN) Language Support](https://plugins.jetbrains.com/plugin/32137-quantum-dsl-qtn-language-support) — in Rider, open **Settings → Plugins → Marketplace** and search for `Quantum DSL (QTN)`.
- **Manual install**: download `QtnLSP-jetbrains.zip` from [GitHub Releases](https://github.com/shlifedev/photon-quantum-qtn-lsp/releases), then **Settings → Plugins → ⚙ → Install Plugin from Disk**.

> Prefer a manual install? Every build is attached to [GitHub Releases](https://github.com/shlifedev/photon-quantum-qtn-lsp/releases) as a `.vsix` / `.zip`.

## Build

[Docker](https://www.docker.com/) required. No other local toolchain needed.
For local Node-based development, use Node.js 22.23.3 to match CI. VS and Rider builds download checksum-pinned Node.js 22.23.3 binaries; packaged extensions are larger because they include the runtime. See [runtime packaging and verification](docs/RUNTIME_PACKAGING.md).

```bash
bash scripts/build.sh all        # sync + test + build VSCode and Rider
bash scripts/build.sh vscode     # VSCode extension only
bash scripts/build.sh jetbrains  # JetBrains plugin only
```

Visual Studio VSIX builds run separately on Windows with Node.js 22.23.3 and the .NET 8 SDK: `bash scripts/build.sh vs`. The `all` command builds VSCode and Rider only.

### Local development and validation

```bash
npm run setup
npm test
npm run compile
npm run webpack
cd packages/vscode-extension
npx vsce package --no-dependencies
```

`npm run setup` installs the three locked dependency sets and synchronizes grammar copies. If you use nvm, run `nvm install && nvm use` first; CI reads the same `.nvmrc`.

For agent-assisted work, start with [AGENTS.md](AGENTS.md) and the [development harness guide](docs/AI_DEVELOPMENT.md). `npm run doctor` checks the local prerequisites; `npm run verify` runs the full suite and saves logs plus a JSON report. Use `-- --profile quick` for fast iteration or `-- --profile package` to also build and exercise a VSCode VSIX. Repository-local skills live in `.agents/skills/`.

`npm test` checks grammar synchronization, TypeScript source and test types, runtime packaging helpers, language-server unit/protocol tests, and TextMate unit/snapshot tests. Run `npm run typecheck` for a quick type check without emitting build files. Rider source builds also require JDK 21; see [Rider build instructions](packages/jetbrains-plugin/README.md#building-from-source).

The shared server provides completion, hover, definition lookup, document/workspace symbols, and semantic tokens for resolved type references. Workspace scans and file watcher events exclude build/cache directories such as Unity `Library` and `Temp`. Explicitly opened buffers remain available until closed. Types split across files retain all declaration sites for definition lookup and aggregate their members in hover. Compiler diagnostics, formatting, and rename are not provided; Quantum's compiler remains the authority for DSL validation.

After packaging, run `npm run test:package -- vscode packages/vscode-extension/qtn-syntax-highlighting-1.0.0.vsix` from the repository root (substitute the actual package filename). CI checks the VSIX contents and runs the extracted server with no usable system Node on PATH.

Development tests use Vitest 4. The VSCode packaging tool’s MSAL dependency uses only `uuid.v4()`; a scoped override keeps it on the patched CommonJS-compatible `uuid` 11.1.1 until upstream updates its dependency.

See the [installation guide](docs/HOW_TO_INSTALL.md) and [DSL reference](docs/DSL.md).

## Screenshot

<img src="docs/images/sample.png" width="600" alt="QtnLSP screenshot">

## License

MIT
