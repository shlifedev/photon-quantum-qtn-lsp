// Symbol Handlers for QTN Language Server
// Provides document and workspace symbol navigation

import {
  DocumentSymbolParams,
  DocumentSymbol,
  SymbolKind,
  Range,
  WorkspaceSymbolParams,
  SymbolInformation,
} from 'vscode-languageserver';
import { ProjectModel } from './project-model.js';
import { nodeKindToSymbolKind } from './symbol-table.js';
import { buildEventDetail, buildTypeDefinitionDetail, formatTypeReference } from './symbol-format.js';
import {
  Definition,
  TypeDefinition,
  EventDefinition,
  SignalDefinition,
  InputDefinition,
  GlobalDefinition,
  ImportDefinition,
  PragmaDefinition,
  DefineDefinition,
  FieldDefinition,
  EnumMemberDefinition,
  SourceRange,
} from './ast.js';

/**
 * Convert AST SourceRange to LSP Range
 */
function sourceRangeToLspRange(range: SourceRange): Range {
  return {
    start: { line: range.start.line, character: range.start.character },
    end: { line: range.end.line, character: range.end.character },
  };
}

/**
 * Create DocumentSymbol for a field
 */
function createFieldSymbol(field: FieldDefinition): DocumentSymbol {
  return {
    name: field.name,
    kind: SymbolKind.Field,
    range: sourceRangeToLspRange(field.range),
    selectionRange: sourceRangeToLspRange(field.range),
    detail: formatTypeReference(field.typeRef),
  };
}

/**
 * Create DocumentSymbol for an enum member
 */
function createEnumMemberSymbol(member: EnumMemberDefinition): DocumentSymbol {
  return {
    name: member.name,
    kind: SymbolKind.EnumMember,
    range: sourceRangeToLspRange(member.range),
    selectionRange: sourceRangeToLspRange(member.range),
    detail: member.value !== undefined ? `= ${member.value}` : undefined,
  };
}

/**
 * Create DocumentSymbol for a top-level definition
 */
function createDefinitionSymbol(def: Definition): DocumentSymbol {
  const range = sourceRangeToLspRange(def.range);
  const selectionRange = range;

  // Handle different definition types
  switch (def.kind) {
    case 'component':
    case 'struct':
    case 'enum':
    case 'flags':
    case 'union':
    case 'asset': {
      const typeDef = def as TypeDefinition;
      const children: DocumentSymbol[] = [];

      // Add fields as children
      if (typeDef.fields && typeDef.fields.length > 0) {
        for (const field of typeDef.fields) {
          children.push(createFieldSymbol(field));
        }
      }

      // Add enum members as children
      if (typeDef.enumMembers && typeDef.enumMembers.length > 0) {
        for (const member of typeDef.enumMembers) {
          children.push(createEnumMemberSymbol(member));
        }
      }

      const detail = buildTypeDefinitionDetail(typeDef);

      return {
        name: typeDef.name,
        kind: nodeKindToSymbolKind(typeDef.kind),
        range,
        selectionRange,
        detail,
        children,
      };
    }

    case 'event': {
      const eventDef = def as EventDefinition;
      const children: DocumentSymbol[] = [];

      if (eventDef.fields && eventDef.fields.length > 0) {
        for (const field of eventDef.fields) {
          children.push(createFieldSymbol(field));
        }
      }

      const detail = buildEventDetail(eventDef);

      return {
        name: eventDef.name,
        kind: SymbolKind.Event,
        range,
        selectionRange,
        detail,
        children,
      };
    }

    case 'signal': {
      const signalDef = def as SignalDefinition;

      // Build parameter signature
      const paramTypes = signalDef.parameters.map(p => {
        return `${formatTypeReference(p.typeRef)} ${p.name}`;
      }).join(', ');

      return {
        name: signalDef.name,
        kind: SymbolKind.Function,
        range,
        selectionRange,
        detail: `(${paramTypes})`,
      };
    }

    case 'input': {
      const inputDef = def as InputDefinition;
      const children: DocumentSymbol[] = [];

      if (inputDef.fields && inputDef.fields.length > 0) {
        for (const field of inputDef.fields) {
          children.push(createFieldSymbol(field));
        }
      }

      return {
        name: 'input',
        kind: SymbolKind.Interface,
        range,
        selectionRange,
        detail: 'input',
        children,
      };
    }

    case 'global': {
      const globalDef = def as GlobalDefinition;
      const children: DocumentSymbol[] = [];

      if (globalDef.fields && globalDef.fields.length > 0) {
        for (const field of globalDef.fields) {
          children.push(createFieldSymbol(field));
        }
      }

      return {
        name: 'global',
        kind: SymbolKind.Namespace,
        range,
        selectionRange,
        detail: 'global',
        children,
      };
    }

    case 'import':
    case 'using': {
      const importDef = def as ImportDefinition;
      return {
        name: importDef.name,
        kind: SymbolKind.Module,
        range,
        selectionRange,
        detail: importDef.kind === 'using' ? 'using' : `import ${importDef.importKind}`,
      };
    }

    case 'pragma': {
      const pragmaDef = def as PragmaDefinition;
      return {
        name: `#pragma ${pragmaDef.key}`,
        kind: SymbolKind.Constant,
        range,
        selectionRange,
        detail: pragmaDef.value,
      };
    }

    case 'define': {
      const defineDef = def as DefineDefinition;
      return {
        name: defineDef.name,
        kind: SymbolKind.Constant,
        range,
        selectionRange,
        detail: `#define = ${defineDef.value}`,
      };
    }
  }
}

function workspaceSymbolName(def: Definition): string {
  switch (def.kind) {
    case 'pragma':
      return `#pragma ${(def as PragmaDefinition).key}`;
    case 'input':
    case 'global':
      return def.kind;
    default:
      return def.name ?? def.kind;
  }
}

/**
 * Handle textDocument/documentSymbol request
 * Provides hierarchical symbol outline for the current document
 */
export function handleDocumentSymbol(
  params: DocumentSymbolParams,
  projectModel: ProjectModel
): DocumentSymbol[] {
  const doc = projectModel.getDocument(params.textDocument.uri);

  if (!doc) {
    return [];
  }

  const symbols: DocumentSymbol[] = [];

  for (const def of doc.definitions) {
    symbols.push(createDefinitionSymbol(def));
  }

  return symbols;
}

/**
 * Handle workspace/symbol request
 * Provides project-wide symbol search with fuzzy matching
 */
export function handleWorkspaceSymbol(
  params: WorkspaceSymbolParams,
  projectModel: ProjectModel
): SymbolInformation[] {
  const query = params.query;

  // If empty query, return all top-level symbols from all documents (flat list)
  if (!query || query.trim() === '') {
    const allSymbols: SymbolInformation[] = [];

    for (const doc of projectModel.getAllDocuments().values()) {
      for (const def of doc.definitions) {
        // Skip builtin symbols - we only want user-defined symbols
        // (builtins don't have definitions in documents anyway)
        const symbol: SymbolInformation = {
          name: workspaceSymbolName(def),
          kind: nodeKindToSymbolKind(def.kind),
          location: {
            uri: doc.uri,
            range: sourceRangeToLspRange(def.range),
          },
        };
        allSymbols.push(symbol);
      }
    }

    return allSymbols;
  }

  // Non-empty query - use fuzzy search from symbol table
  const results = projectModel.getSymbolTable().fuzzySearch(query);

  // Convert SymbolInfo to SymbolInformation and filter out builtins
  return results
    .filter(symbol => symbol.source !== 'builtin')
    .map(symbol => ({
      name: symbol.name,
      kind: symbol.kind,
      location: symbol.location,
    }));
}
