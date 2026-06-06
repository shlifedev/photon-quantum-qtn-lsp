# Quantum DSL (QTN) Language Support

Syntax highlighting and IntelliSense for [Photon Quantum 3](https://doc.photonengine.com/quantum/current/quantum-intro) DSL (`.qtn`) files in Visual Studio 2022.

`.qtn` is the data-definition language for Quantum's deterministic ECS — it declares components, structs, events, signals, inputs and globals that the Quantum code generator turns into C#.

## Features

- **Syntax highlighting** — TextMate grammar covering declarations, modifiers, built-in Quantum types (`FP`, `FPVector2`, `EntityRef`, …), collections, attributes, literals and comments.
- **IntelliSense via Language Server** — auto-completion, hover information, and go-to-definition across your `.qtn` files.
- **Document & workspace symbols** — navigate types and members quickly.

## Requirements

- Visual Studio 2022 (17.0+)
- The extension bundles its own Language Server; no extra setup is required.

## Links

- Source & issues: https://github.com/shlifedev/QtnLSP
- Quantum DSL reference: https://doc.photonengine.com/quantum/current/manual/quantum-dsl

Also available for VSCode and JetBrains Rider.

## License

MIT
