// Symbol Table for QTN Language Server
import { SymbolKind, Location, Range } from 'vscode-languageserver';
import {
  QtnDocument,
  Definition,
  TypeDefinition,
  EventDefinition,
  SignalDefinition,
  InputDefinition,
  GlobalDefinition,
  ImportDefinition,
  DefineDefinition,
  FieldDefinition,
  EnumMemberDefinition,
  NodeKind,
  SourceRange,
} from './ast.js';
import {
  ALL_BUILTIN_TYPES,
  BuiltinTypeInfo,
  getDescription,
} from './builtins.js';
import { getLocale } from './locale.js';
import { buildEventDetail, buildSignalDetail, buildTypeDefinitionDetail, formatTypeReference } from './symbol-format.js';

// Symbol information for types, constants, and definitions
export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  location: Location;
  detail: string;
  children: SymbolInfo[];
  source: 'builtin' | 'user' | 'import';
}

// Convert NodeKind to LSP SymbolKind
export function nodeKindToSymbolKind(kind: NodeKind): SymbolKind {
  switch (kind) {
    case 'component':
      return SymbolKind.Class;
    case 'struct':
      return SymbolKind.Struct;
    case 'enum':
    case 'flags':
      return SymbolKind.Enum;
    case 'union':
      return SymbolKind.Struct;
    case 'event':
      return SymbolKind.Event;
    case 'signal':
      return SymbolKind.Function;
    case 'input':
      return SymbolKind.Interface;
    case 'global':
      return SymbolKind.Namespace;
    case 'asset':
      return SymbolKind.Class;
    case 'define':
      return SymbolKind.Constant;
    case 'field':
      return SymbolKind.Field;
    case 'enumMember':
      return SymbolKind.EnumMember;
    case 'parameter':
      return SymbolKind.Variable;
    case 'import':
    case 'using':
    case 'pragma':
    default:
      return SymbolKind.Module;
  }
}

// Convert SourceRange to LSP Range
function sourceRangeToRange(sourceRange: SourceRange): Range {
  return {
    start: {
      line: sourceRange.start.line,
      character: sourceRange.start.character,
    },
    end: {
      line: sourceRange.end.line,
      character: sourceRange.end.character,
    },
  };
}

// Create Location from SourceRange and file URI
function createLocation(fileUri: string, sourceRange: SourceRange): Location {
  return {
    uri: fileUri,
    range: sourceRangeToRange(sourceRange),
  };
}

// Symbol Table class
export class SymbolTable {
  types: Map<string, SymbolInfo> = new Map();
  constants: Map<string, SymbolInfo> = new Map();
  imports: ImportDefinition[] = [];

  // Build symbol table from parsed QTN document
  buildFromDocument(doc: QtnDocument): void {
    this.types.clear();
    this.constants.clear();
    this.imports = [];

    for (const def of doc.definitions) {
      this.processDefinition(def, doc.uri);
    }
  }

  // Add symbols from a document WITHOUT clearing existing symbols
  // Used by ProjectModel to incrementally build symbol table from multiple documents
  addFromDocument(doc: QtnDocument): void {
    for (const def of doc.definitions) {
      this.processDefinition(def, doc.uri);
    }
  }

  // Process a single definition and add to symbol table
  private processDefinition(def: Definition, fileUri: string): void {
    switch (def.kind) {
      case 'component':
      case 'struct':
      case 'enum':
      case 'flags':
      case 'union':
      case 'asset':
        this.processTypeDefinition(def as TypeDefinition, fileUri);
        break;
      case 'event':
        this.processEventDefinition(def as EventDefinition, fileUri);
        break;
      case 'signal':
        this.processSignalDefinition(def as SignalDefinition, fileUri);
        break;
      case 'input':
        this.processInputDefinition(def as InputDefinition, fileUri);
        break;
      case 'global':
        this.processGlobalDefinition(def as GlobalDefinition, fileUri);
        break;
      case 'import':
        this.imports.push(def as ImportDefinition);
        this.processImportDefinition(def as ImportDefinition, fileUri);
        break;
      case 'using':
        this.imports.push(def as ImportDefinition);
        break;
      case 'define':
        this.processDefineDefinition(def as DefineDefinition, fileUri);
        break;
      case 'pragma':
        // Skip pragma definitions - they don't create symbols
        break;
    }
  }

  private processImportDefinition(def: ImportDefinition, fileUri: string): void {
    const existing = this.types.get(def.name);
    if (existing && existing.source !== 'import') {
      return;
    }

    const symbol: SymbolInfo = {
      name: def.name,
      kind: this.importKindToSymbolKind(def.importKind),
      location: createLocation(fileUri, def.range),
      detail: this.buildImportDetail(def),
      children: [],
      source: 'import',
    };

    this.types.set(def.name, symbol);
  }

  private importKindToSymbolKind(kind: ImportDefinition['importKind']): SymbolKind {
    switch (kind) {
      case 'struct':
        return SymbolKind.Struct;
      case 'enum':
        return SymbolKind.Enum;
      case 'singleton':
      case 'component':
      case 'type':
      default:
        return SymbolKind.Class;
    }
  }

  private buildImportDetail(def: ImportDefinition): string {
    if (def.importKind === 'struct' && def.size !== undefined) {
      return `import struct (${def.size})`;
    }
    if (def.importKind === 'enum' && def.underlyingType) {
      return `import enum (${def.underlyingType})`;
    }
    return `import ${def.importKind}`;
  }

  // Process type definition (component, struct, enum, flags, union, asset)
  private processTypeDefinition(def: TypeDefinition, fileUri: string): void {
    const children: SymbolInfo[] = [];

    // Add fields as children (for struct, component, union)
    if (def.fields && def.fields.length > 0) {
      for (const field of def.fields) {
        children.push(this.createFieldSymbol(field, fileUri));
      }
    }

    // Add enum members as children (for enum, flags)
    if (def.enumMembers && def.enumMembers.length > 0) {
      for (const member of def.enumMembers) {
        children.push(this.createEnumMemberSymbol(member, fileUri));
      }
    }

    const detail = buildTypeDefinitionDetail(def);

    const symbol: SymbolInfo = {
      name: def.name,
      kind: nodeKindToSymbolKind(def.kind),
      location: createLocation(fileUri, def.range),
      detail,
      children,
      source: 'user',
    };

    this.types.set(def.name, symbol);
  }

  // Process event definition
  private processEventDefinition(def: EventDefinition, fileUri: string): void {
    const children: SymbolInfo[] = [];

    if (def.fields && def.fields.length > 0) {
      for (const field of def.fields) {
        children.push(this.createFieldSymbol(field, fileUri));
      }
    }

    const detail = buildEventDetail(def);

    const symbol: SymbolInfo = {
      name: def.name,
      kind: SymbolKind.Event,
      location: createLocation(fileUri, def.range),
      detail,
      children,
      source: 'user',
    };

    this.types.set(def.name, symbol);
  }

  // Process signal definition
  private processSignalDefinition(def: SignalDefinition, fileUri: string): void {
    const detail = buildSignalDetail(def);

    const symbol: SymbolInfo = {
      name: def.name,
      kind: SymbolKind.Function,
      location: createLocation(fileUri, def.range),
      detail,
      children: [],
      source: 'user',
    };

    this.types.set(def.name, symbol);
  }

  // Process input definition
  private processInputDefinition(def: InputDefinition, fileUri: string): void {
    const children: SymbolInfo[] = [];

    if (def.fields && def.fields.length > 0) {
      for (const field of def.fields) {
        children.push(this.createFieldSymbol(field, fileUri));
      }
    }

    const symbol: SymbolInfo = {
      name: 'input',
      kind: SymbolKind.Interface,
      location: createLocation(fileUri, def.range),
      detail: 'input',
      children,
      source: 'user',
    };

    this.types.set('input', symbol);
  }

  // Process global definition
  private processGlobalDefinition(def: GlobalDefinition, fileUri: string): void {
    const children: SymbolInfo[] = [];

    if (def.fields && def.fields.length > 0) {
      for (const field of def.fields) {
        children.push(this.createFieldSymbol(field, fileUri));
      }
    }

    const symbol: SymbolInfo = {
      name: 'global',
      kind: SymbolKind.Namespace,
      location: createLocation(fileUri, def.range),
      detail: 'global',
      children,
      source: 'user',
    };

    this.types.set('global', symbol);
  }

  // Process #define constant
  private processDefineDefinition(def: DefineDefinition, fileUri: string): void {
    const symbol: SymbolInfo = {
      name: def.name,
      kind: SymbolKind.Constant,
      location: createLocation(fileUri, def.range),
      detail: `#define ${def.name} = ${def.value}`,
      children: [],
      source: 'user',
    };

    this.constants.set(def.name, symbol);
  }

  // Create field symbol
  private createFieldSymbol(field: FieldDefinition, fileUri: string): SymbolInfo {
    const typeStr = formatTypeReference(field.typeRef);
    return {
      name: field.name,
      kind: SymbolKind.Field,
      location: createLocation(fileUri, field.range),
      detail: `${field.name}: ${typeStr}`,
      children: [],
      source: 'user',
    };
  }

  // Create enum member symbol
  private createEnumMemberSymbol(member: EnumMemberDefinition, fileUri: string): SymbolInfo {
    const valueStr = member.value !== undefined ? ` = ${member.value}` : '';
    return {
      name: member.name,
      kind: SymbolKind.EnumMember,
      location: createLocation(fileUri, member.range),
      detail: `${member.name}${valueStr}`,
      children: [],
      source: 'user',
    };
  }

  // Pre-populate symbol table with built-in types
  mergeBuiltins(): void {
    for (const builtin of ALL_BUILTIN_TYPES) {
      const symbol = this.createBuiltinSymbol(builtin);
      // Don't overwrite user-defined types
      if (!this.types.has(symbol.name)) {
        this.types.set(symbol.name, symbol);
      }
    }
  }

  // Create symbol from builtin type info
  private createBuiltinSymbol(builtin: BuiltinTypeInfo): SymbolInfo {
    let kind: SymbolKind;
    switch (builtin.category) {
      case 'primitive':
        kind = SymbolKind.Struct;
        break;
      case 'quantum':
        kind = SymbolKind.Class;
        break;
      case 'collection':
        kind = SymbolKind.Class;
        break;
      case 'special':
        kind = SymbolKind.Class;
        break;
      default:
        kind = SymbolKind.Class;
    }

    return {
      name: builtin.name,
      kind,
      location: {
        uri: 'builtin://',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      },
      detail: getDescription(builtin, getLocale()),
      children: [],
      source: 'builtin',
    };
  }

  // Lookup symbol by exact name
  lookup(name: string): SymbolInfo | undefined {
    return this.types.get(name) || this.constants.get(name);
  }

  // Fuzzy search for symbols (case-insensitive substring matching)
  fuzzySearch(query: string): SymbolInfo[] {
    const lowerQuery = query.toLowerCase();
    const results: Array<{ symbol: SymbolInfo; score: number }> = [];

    // Search in types
    for (const [name, symbol] of this.types) {
      const lowerName = name.toLowerCase();
      let score = 0;

      if (lowerName === lowerQuery) {
        score = 3; // Exact match
      } else if (lowerName.startsWith(lowerQuery)) {
        score = 2; // Prefix match
      } else if (lowerName.includes(lowerQuery)) {
        score = 1; // Contains match
      }

      if (score > 0) {
        results.push({ symbol, score });
      }
    }

    // Search in constants
    for (const [name, symbol] of this.constants) {
      const lowerName = name.toLowerCase();
      let score = 0;

      if (lowerName === lowerQuery) {
        score = 3; // Exact match
      } else if (lowerName.startsWith(lowerQuery)) {
        score = 2; // Prefix match
      } else if (lowerName.includes(lowerQuery)) {
        score = 1; // Contains match
      }

      if (score > 0) {
        results.push({ symbol, score });
      }
    }

    // Sort by score (descending), then by name (ascending)
    results.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return a.symbol.name.localeCompare(b.symbol.name);
    });

    return results.map(r => r.symbol);
  }
}
