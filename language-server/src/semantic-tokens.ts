// Semantic Tokens Provider for QTN Language Server
// Provides semantic token data for type references resolved via the symbol table.

import {
  SemanticTokensParams,
  SemanticTokens,
  SemanticTokensBuilder,
} from 'vscode-languageserver';
import { SymbolKind } from 'vscode-languageserver';
import {
  TypeReference,
  Definition,
  TypeDefinition,
  EventDefinition,
  SignalDefinition,
  InputDefinition,
  GlobalDefinition,
} from './ast.js';
import { ProjectModel } from './project-model.js';
import { SymbolInfo } from './symbol-table.js';

// Token types legend — order matters (index = token type ID)
export const tokenTypes = [
  'type',        // 0: generic type
  'enum',        // 1: enum / flags
  'struct',      // 2: struct / union
  'class',       // 3: component / asset
  'event',       // 4: event
  'function',    // 5: signal
];

export const tokenModifiers: string[] = [];

// Map LSP SymbolKind → semantic token type index
function symbolKindToTokenType(kind: SymbolKind): number {
  switch (kind) {
    case SymbolKind.Enum:
      return 1; // enum
    case SymbolKind.Struct:
      return 2; // struct
    case SymbolKind.Class:
      return 3; // class (component, asset, quantum builtins)
    case SymbolKind.Event:
      return 4; // event
    case SymbolKind.Function:
      return 5; // function (signal)
    default:
      return 0; // type (fallback)
  }
}

// Collect all type references from a definition, including nested generic args
function collectTypeReferences(def: Definition): TypeReference[] {
  const refs: TypeReference[] = [];

  function addTypeRef(typeRef: TypeReference): void {
    refs.push(typeRef);
    // Recurse into generic args (e.g., list<CharacterState> → CharacterState)
    for (const arg of typeRef.genericArgs) {
      if ('name' in arg) {
        addTypeRef(arg);
      }
    }
  }

  switch (def.kind) {
    case 'component':
    case 'struct':
    case 'union':
    case 'asset':
    case 'flags':
    case 'enum': {
      const typeDef = def as TypeDefinition;
      for (const field of typeDef.fields) {
        addTypeRef(field.typeRef);
      }
      break;
    }
    case 'event': {
      const eventDef = def as EventDefinition;
      for (const field of eventDef.fields) {
        addTypeRef(field.typeRef);
      }
      break;
    }
    case 'signal': {
      const signalDef = def as SignalDefinition;
      for (const param of signalDef.parameters) {
        addTypeRef(param.typeRef);
      }
      break;
    }
    case 'input': {
      const inputDef = def as InputDefinition;
      for (const field of inputDef.fields) {
        addTypeRef(field.typeRef);
      }
      break;
    }
    case 'global': {
      const globalDef = def as GlobalDefinition;
      for (const field of globalDef.fields) {
        addTypeRef(field.typeRef);
      }
      break;
    }
  }

  return refs;
}

// Token data: line, char, length, tokenType, tokenModifiers
interface TokenData {
  line: number;
  char: number;
  length: number;
  tokenType: number;
  tokenModifiers: number;
}

export function handleSemanticTokensFull(
  params: SemanticTokensParams,
  projectModel: ProjectModel,
): SemanticTokens {
  const uri = params.textDocument.uri;
  const doc = projectModel.getDocument(uri);
  if (!doc) {
    return { data: [] };
  }

  const symbolTable = projectModel.getSymbolTable();
  const tokens: TokenData[] = [];

  for (const def of doc.definitions) {
    const typeRefs = collectTypeReferences(def);

    for (const typeRef of typeRefs) {
      // Look up the base type name in the symbol table (strip dotted prefix for lookup)
      const symbol = symbolTable.lookup(typeRef.name);
      if (!symbol || symbol.source === 'builtin') {
        // Skip unknown types and built-in types (TextMate grammar handles builtin highlighting)
        continue;
      }

      const tokenType = symbolKindToTokenType(symbol.kind);

      // Derive length from nameRange so it stays correct regardless of how the
      // name was stored (e.g. nullable types). Fall back to name.length for
      // multiline dotted names where columns span lines.
      const { start, end } = typeRef.nameRange;
      const length = start.line === end.line
        ? end.character - start.character
        : typeRef.name.length;

      tokens.push({
        line: start.line,
        char: start.character,
        length,
        tokenType,
        tokenModifiers: 0,
      });
    }

    // Handle event parent type reference (inheritance)
    if (def.kind === 'event') {
      const eventDef = def as EventDefinition;
      if (eventDef.parentName) {
        const parentSymbol = symbolTable.lookup(eventDef.parentName);
        if (parentSymbol) {
          // Find parent name range: it's after `:` in the event declaration
          // We need to locate it in the source. Since we don't have a dedicated
          // parentNameRange in the AST, we compute it from the event range.
          // For now, skip — parentName range is not tracked in the AST.
          // This can be added in a future enhancement.
        }
      }
    }
  }

  // Sort tokens by position (required for delta encoding)
  tokens.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.char - b.char;
  });

  // Build SemanticTokens data using delta encoding
  const builder = new SemanticTokensBuilder();
  for (const token of tokens) {
    builder.push(token.line, token.char, token.length, token.tokenType, token.tokenModifiers);
  }

  return builder.build();
}
