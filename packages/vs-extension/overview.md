# Quantum DSL (QTN) Language Support

Syntax highlighting and Language Server support for [Photon Quantum 3](https://doc.photonengine.com/quantum/current/quantum-intro) DSL (`.qtn`) files in Visual Studio 2022, including autocomplete, go-to-definition, hover information, and symbols.

`.qtn` is the data-definition language for Quantum's deterministic ECS — it declares components, structs, events, signals, inputs and globals that the Quantum code generator turns into C#.

## Features

- **Syntax highlighting** — TextMate grammar covering declarations, modifiers, built-in Quantum types (`FP`, `FPVector2`, `EntityRef`, …), collections, attributes, literals and comments.
- **Language Server features** — autocomplete, hover information, go-to-definition, and symbols across your `.qtn` files.
- **Document & workspace symbols** — navigate types and members quickly.

## Requirements

- Visual Studio 2022 (17.0+)
- The extension bundles its Language Server and a private Node.js runtime. No separate Node.js installation or PATH setup is required, even for Unity/C# projects. No runtime download occurs at startup.

The VSIX is larger because it includes the runtime. If IntelliSense cannot start, syntax highlighting remains available; check **Output → QTN Language Server** for details and update/reinstall the extension.

## Links

- Source & issues: https://github.com/shlifedev/photon-quantum-qtn-lsp
- Quantum DSL reference: https://doc.photonengine.com/quantum/current/manual/quantum-dsl

Also available for VSCode and JetBrains Rider.

## License

MIT
