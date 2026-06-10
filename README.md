<p align="center">
  <a href="README.md">English</a> | <a href="docs/README.ko.md">한국어</a> | <a href="docs/README.ja.md">日本語</a> | <a href="docs/README.zh-TW.md">繁體中文</a>
</p>

# QtnLSP

Syntax highlighting and Language Server support for Photon Quantum3 DSL (`.qtn`) files, including autocomplete, go-to-definition, hover information, and symbols.

Supports **VSCode**, **JetBrains Rider**, and **Visual Studio 2022**.

## Supported IDEs

| IDE | Version |
|-----|---------|
| VSCode | 1.50+ |
| JetBrains Rider | 2022.3+ |
| Visual Studio | 2022 (17.0+) |

## Installation

### VSCode
- **Marketplace**: [Quantum DSL (QTN) Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.qtn-syntax-highlighting) — or open the **Extensions** view in VSCode and search for `Quantum DSL (QTN)`.
- **CLI**: `code --install-extension shlifedev.qtn-syntax-highlighting`

### Visual Studio 2022
- **Marketplace**: [Quantum DSL (QTN) Language Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.QtnLanguageSupport) — or in Visual Studio go to **Extensions → Manage Extensions → Online** and search for `Quantum DSL (QTN)`.

### JetBrains Rider
- Download `QtnLSP-jetbrains.zip` from [GitHub Releases](../../releases), then **Settings → Plugins → ⚙ → Install Plugin from Disk**. _(Marketplace listing coming soon.)_

> Prefer a manual install? Every build is attached to [GitHub Releases](../../releases) as a `.vsix` / `.zip`.

## Build

[Docker](https://www.docker.com/) required. No other local toolchain needed.
For local Node-based development, use Node.js 20 to match CI.

```bash
sh scripts/build.sh all        # sync + test + build all plugins
sh scripts/build.sh vscode     # VSCode extension only
sh scripts/build.sh jetbrains  # JetBrains plugin only
```

## Screenshot

<img src="docs/images/sample.png" width="600" alt="QtnLSP screenshot">

## License

MIT
