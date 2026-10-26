# Quantum DSL (QTN) Language Support for JetBrains

Syntax highlighting and Language Server support for Photon Quantum3 DSL (`.qtn`) files in JetBrains Rider, including autocomplete, go-to-definition, hover information, and symbols.

## Overview

This plugin provides comprehensive language support for Quantum3's domain-specific language for defining game data structures, components, and networking protocols. It helps Rider users write and navigate QTN code with TextMate grammar-based colorization and LSP-powered editor features.

## Features

The plugin supports QTN language constructs and editor workflows:

- **Declarations**: component, struct, event, signal, input, asset, global, enum, flags, union, singleton, abstract, import
- **Quantum Types**: FP, FPVector2, FPVector3, FPQuaternion, FPMatrix, FPBounds2, FPBounds3, EntityRef, PlayerRef, AssetRef, QString, QStringUtf8, LayerMask, Hit, Hit3D, Shape2D, Shape3D
- **Built-in Types**: bool, byte, sbyte, short, ushort, int, uint, long, ulong
- **Collection Types**: list, array, dictionary, hash_set, bitset
- **Keywords**: synced, local, remote, button, nothashed
- **Attributes**: [Header], [Tooltip], [Range], [RangeEx], [DrawIf], [HideInInspector], [Optional], and more
- **Comments**: Single-line (`//`) and multi-line (`/* */`)
- **Preprocessor Directives**: #pragma, #define
- **String and Number Literals**: Full support for string escaping and numeric formats
- **Nested Generic Types**: Proper highlighting for complex type declarations (e.g., `list<asset_ref<MyType>>`)
- **Language Server Features**: Auto-completion, hover information, go-to-definition, and document/workspace symbols

## Installation

### From JetBrains Marketplace

Install [Quantum DSL (QTN) Language Support](https://plugins.jetbrains.com/plugin/32137-quantum-dsl-qtn-language-support) (plugin ID `com.qtn.syntax-highlighting`).

1. Open JetBrains Rider 2024.3 or later
2. Go to **Settings/Preferences** → **Plugins** → **Marketplace**
3. Search for "Quantum DSL" or "QTN Language Support"
4. Click **Install** and restart the IDE

### Manual Installation

1. Download `QtnLSP-jetbrains.zip` from [GitHub Releases](https://github.com/shlifedev/photon-quantum-qtn-lsp/releases), or build from source
2. Go to **Settings/Preferences** → **Plugins** → **Install Plugin from Disk**
3. Select the downloaded ZIP (local builds use `build/distributions/qtn-syntax-highlighting.zip`)
4. Restart the IDE

## Building from Source

Run from the repository root with **Node.js 22.23.3** and **JDK 21**:

```bash
npm ci
npm --prefix packages/language-server ci
npm run sync-grammar
npm run bundle:server
npm run prepare:runtimes -- --target=jetbrains
cd packages/jetbrains-plugin
./gradlew test buildPlugin
cd ../..
npm run test:package -- jetbrains packages/jetbrains-plugin/build/distributions/qtn-syntax-highlighting.zip
```

The ZIP includes the shared server bundle and checksum-pinned runtimes for all six supported OS/architecture pairs. Node.js is required for source builds, but plugin users do not need to install it. See [runtime packaging](../../docs/RUNTIME_PACKAGING.md).

Alternatively, with Docker running, execute `bash scripts/build.sh jetbrains` from the repository root. The output is copied to `dist/jetbrains/`. After preparing the server and runtimes, `./gradlew runIde` in this directory launches a test Rider instance.

## Compatibility

- **Supported IDEs**: JetBrains Rider
- **Minimum Version**: Rider 2024.3+ (build 243 and later)
- **TextMate Bundle**: Uses JetBrains TextMate plugin for grammar-based highlighting

## How It Works

The plugin registers a TextMate bundle (`qtn.tmbundle`) for syntax highlighting and starts the bundled QTN Language Server for IntelliSense features when `.qtn` files are opened.

## References

For detailed Quantum3 DSL documentation, visit:
- [Photon Quantum Documentation](https://doc.photonengine.com/quantum/v3)
- [Photon Quantum DSL Reference](https://doc.photonengine.com/quantum/v3/manual/quantum-ecs/dsl)

## License

This plugin is distributed under the same license as the Quantum DSL project.

## Support

For issues, feature requests, or contributions, please refer to the project repository.
