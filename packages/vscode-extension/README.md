# Quantum DSL (QTN) Language Support

Syntax highlighting and Language Server support for Photon Quantum3 DSL (`.qtn`) files in Visual Studio Code, including autocomplete, go-to-definition, hover information, and symbols.

## What It Does

This extension provides comprehensive language support for Quantum3's domain-specific language for defining game data structures, components, and networking protocols. It helps developers write and navigate QTN code with TextMate grammar-based colorization and LSP-powered editor features.

## Features

### Declaration Keywords
Syntax highlighting for all declaration types:
- `component` - Define game components
- `struct` - Define data structures
- `enum` - Define enumeration types
- `flags` - Define bit flag enumerations
- `union` - Define union types
- `input` - Define input structures
- `event` - Define event types
- `signal` - Define signal types
- `global` - Define global properties
- `import` - Import external types

### Modifiers
Support for declaration modifiers:
- `singleton` - Mark components as singletons
- `abstract` - Mark types as abstract
- `synced` - Synchronized property modifier
- `local` - Local-only property modifier
- `remote` - Remote property modifier

### Primitive Types
Complete support for all primitive types:
- `bool` - Boolean type
- `byte`, `sbyte` - 8-bit integer types
- `short`, `ushort` - 16-bit integer types
- `int`, `uint` - 32-bit integer types
- `long`, `ulong` - 64-bit integer types
- `Boolean` - Alternative boolean name

### Quantum Types
Support for Quantum3-specific types:
- `FP` - Fixed-point number type
- `FPVector2` - 2D fixed-point vector
- `FPVector3` - 3D fixed-point vector
- `FPQuaternion` - Quaternion for rotations
- `FPMatrix` - Matrix type
- `FPBounds2` - 2D bounding box
- `FPBounds3` - 3D bounding box
- `EntityRef` - Reference to game entities
- `PlayerRef` - Reference to players
- `AssetRef` - Reference to game assets
- `QString` - String type
- `QStringUtf8` - UTF-8 string type
- `LayerMask` - Layer mask type
- `Hit` - 2D physics hit information
- `Hit3D` - 3D physics hit information
- `Shape2D` - 2D shape type
- `Shape3D` - 3D shape type
- `button` - Input button type

### Generic and Collection Types
Support for parameterized types:
- `list<T>` - Dynamic list type
- `array<T>[N]` - Fixed-size array with explicit size
- `dictionary<K,V>` - Key-value map type
- `hash_set<T>` - Hash set type
- `set<T>` - Ordered set type
- `bitset[N]` - Bit set with explicit size
- `entity_ref<T>` - Typed entity reference
- `player_ref<T>` - Typed player reference
- `asset_ref<T>` - Typed asset reference

Generic types support nesting, allowing complex type definitions like `list<FPVector3>` or `dictionary<QString, int>`.

### Preprocessor Directives
Support for preprocessor commands:
- `#pragma` - Compiler directives
- `#define` - Macro definitions

### Attributes
Highlighting for annotation attributes:
- `[Header("...")]` - Group properties in inspector
- `[Tooltip("...")]` - Provide tooltips for properties
- All custom attributes using square bracket notation

### Comments
Full comment support:
- `//` - Single-line comments
- `/* */` - Multi-line comments

### Code Navigation
- **Bracket Matching** - Automatic matching for `{}`, `[]`, `()`, and `<>`
- **Code Folding** - Fold/unfold code regions using `// #region` and `// #endregion` markers
- **Auto-Closing Pairs** - Automatically close brackets, parentheses, and quotes

### String Handling
- Double-quoted strings with proper escape sequence recognition
- Escape sequences: `\\`, `\"`, `\n`, `\t`, `\r`, `\0`

### Numbers
Support for multiple number formats:
- Decimal integers: `42`, `0`, `1000`
- Floating-point: `3.14`, `0.5`
- Hexadecimal: `0xFF`, `0x1A2B`

## Installation

### From VSIX File
1. Download `QtnLSP-vscode.vsix` from [GitHub Releases](https://github.com/shlifedev/photon-quantum-qtn-lsp/releases)
2. Install it using the VS Code command line:
   ```bash
   code --install-extension QtnLSP-vscode.vsix
   ```
3. Reload VS Code
4. The extension will automatically activate for `.qtn` files

### From VS Code Extension Marketplace

[Quantum DSL (QTN) Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.qtn-syntax-highlighting) is available in the Marketplace.
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "QTN" or "Quantum DSL"
4. Click Install
5. The extension activates automatically

## Supported File Extensions

- `.qtn` - Quantum DSL source files

Files with the `.qtn` extension will automatically be recognized and highlighted.

## Usage Example

Create or open a `.qtn` file and start writing code. Syntax highlighting will activate automatically:

```qtn
component Player {
    FPVector3 Position;
    int Health;
    list<EntityRef> Inventory;
    array<int>[10] Scores;
}

input {
    FPVector2 Movement;
    button Jump;
}

event PlayerDamaged {
    int DamageAmount;
    EntityRef DamageSource;
}

signal OnDamage(FP damage, entity_ref target);
```

## Requirements

- Visual Studio Code 1.82.0 or higher
- No additional dependencies required

## Documentation

For detailed information about the Photon Quantum3 DSL, refer to:
- [Photon Quantum3 Official Documentation](https://doc.photonengine.com/quantum/v3)
- [Quantum DSL Reference](https://doc.photonengine.com/quantum/v3/manual/quantum-ecs/dsl)

## Contributing

To report issues or suggest improvements, please submit feedback through the appropriate channels for your installation method.

## License

MIT. See the repository LICENSE.
