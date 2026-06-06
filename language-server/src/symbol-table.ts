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

// Builtin symbols are identical for every SymbolTable instance and only vary by
// locale (which affects descriptions). Build them once per locale and reuse the
// cached array so a single document edit never rebuilds ~40 builtins from scratch.
const builtinSymbolCache = new Map<string, SymbolInfo[]>();

// What a single document contributed to the merged symbol table. Caching the
// already-built SymbolInfo objects lets us re-derive the merged view on removal
// without re-processing every other document's AST.
interface DocumentContribution {
  types: SymbolInfo[];
  constants: SymbolInfo[];
  imports: ImportDefinition[];
}

// Map a builtin's category to its LSP SymbolKind.
function builtinSymbolKind(category: BuiltinTypeInfo['category']): SymbolKind {
  switch (category) {
    case 'primitive':
      return SymbolKind.Struct;
    case 'quantum':
    case 'collection':
    case 'special':
    default:
      return SymbolKind.Class;
  }
}

function createBuiltinSymbol(builtin: BuiltinTypeInfo): SymbolInfo {
  return {
    name: builtin.name,
    kind: builtinSymbolKind(builtin.category),
    location: {
      uri: 'builtin://',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    },
    detail: getDescription(builtin, getLocale()),
    children: [],
    source: 'builtin',
  };
}

// Builtin symbols for the active locale, computed once and memoized per locale.
function getBuiltinSymbols(): SymbolInfo[] {
  const locale = getLocale();
  let symbols = builtinSymbolCache.get(locale);
  if (!symbols) {
    symbols = ALL_BUILTIN_TYPES.map(createBuiltinSymbol);
    builtinSymbolCache.set(locale, symbols);
  }
  return symbols;
}

// Symbol Table class
export class SymbolTable {
  types: Map<string, SymbolInfo> = new Map();
  constants: Map<string, SymbolInfo> = new Map();
  imports: ImportDefinition[] = [];

  // Per-document contributions, in insertion order. Used to re-derive the merged
  // maps incrementally when a single document is added, updated, or removed.
  private contributions: Map<string, DocumentContribution> = new Map();
  private builtinsMerged = false;

  // Build symbol table from a single document, discarding any prior state.
  buildFromDocument(doc: QtnDocument): void {
    const hadBuiltins = this.builtinsMerged;
    this.contributions.clear();
    this.indexDocument(doc);
    this.builtinsMerged = hadBuiltins;
    this.rebuildMergedView();
  }

  // Add symbols from a document WITHOUT clearing existing symbols.
  // Re-indexing the same uri replaces only that document's contribution; symbols
  // from other documents and the builtins are left untouched.
  addFromDocument(doc: QtnDocument): void {
    const previous = this.contributions.get(doc.uri);
    this.indexDocument(doc);
    const next = this.contributions.get(doc.uri)!;

    // Re-editing a document can drop names it used to define (un-shadowing a
    // builtin or another document) or collide with another document's winner —
    // those cases can't be resolved by a forward merge alone, so fall back to a
    // re-derive. The re-derive only iterates cached SymbolInfo objects, never
    // re-parses.
    if (this.needsFullRederive(doc.uri, previous, next)) {
      this.rebuildMergedView();
      return;
    }

    // Common keystroke case: this document's names are a superset of before and
    // don't collide with other documents, so applying its fresh symbols on top
    // keeps last-write-wins correct without touching any other document.
    // O(symbols in this one document).
    this.applyContribution(next);
  }

  // Drop a single document's symbols. Because removal can un-shadow builtins or
  // symbols from other documents, the merged maps are re-derived from the cached
  // contributions rather than mutated in place.
  removeDocument(uri: string): void {
    if (!this.contributions.delete(uri)) {
      return;
    }
    this.rebuildMergedView();
  }

  // A forward-only merge writes this document's fresh symbols straight into the
  // live maps. That is only valid when it can't disturb another source's winner,
  // so we fall back to a full re-derive (which still reuses cached SymbolInfo,
  // never re-parses) in these cases:
  //   - the re-edit removed a name it used to define (may un-shadow a builtin or
  //     another document),
  //   - the document declared imports (appended into a shared array; a clean
  //     rebuild avoids leaving stale entries),
  //   - one of the document's names is currently owned by a *different* document
  //     (forward-merging would override that document's winner and break the
  //     insertion-order last-write-wins rule).
  private needsFullRederive(
    uri: string,
    previous: DocumentContribution | undefined,
    next: DocumentContribution,
  ): boolean {
    if (previous?.imports.length || next.imports.length) {
      return true;
    }

    if (previous) {
      const nextTypeNames = new Set(next.types.map((s) => s.name));
      for (const symbol of previous.types) {
        if (!nextTypeNames.has(symbol.name)) {
          return true;
        }
      }
      const nextConstNames = new Set(next.constants.map((s) => s.name));
      for (const symbol of previous.constants) {
        if (!nextConstNames.has(symbol.name)) {
          return true;
        }
      }
    }

    for (const symbol of next.types) {
      if (this.ownedByOtherDocument(this.types.get(symbol.name), uri)) {
        return true;
      }
    }
    for (const symbol of next.constants) {
      if (this.ownedByOtherDocument(this.constants.get(symbol.name), uri)) {
        return true;
      }
    }
    return false;
  }

  // True when the current winner for a name belongs to a different document, so a
  // forward merge must not clobber it. Builtins (and an absent winner) are safe to
  // overwrite by a user/import symbol, matching last-write-wins.
  private ownedByOtherDocument(current: SymbolInfo | undefined, uri: string | undefined): boolean {
    if (!current || current.source === 'builtin') {
      return false;
    }
    return current.location.uri !== uri;
  }

  // Process the document's definitions into cached SymbolInfo objects, replacing
  // any prior contribution for the same uri.
  private indexDocument(doc: QtnDocument): void {
    this.current = { types: [], constants: [], imports: [] };
    for (const def of doc.definitions) {
      this.processDefinition(def, doc.uri);
    }
    this.contributions.set(doc.uri, this.current);
    this.current = null;
  }

  // Active contribution being populated by processDefinition during indexDocument.
  private current: DocumentContribution | null = null;

  // Re-derive the merged maps from builtins + all cached contributions, in
  // insertion order so user definitions win over builtins and later documents
  // win over earlier ones — exactly matching the previous full rebuild. Cheap
  // because it reuses already-built SymbolInfo objects and cached builtins.
  private rebuildMergedView(): void {
    this.types = new Map();
    this.constants = new Map();
    this.imports = [];

    if (this.builtinsMerged) {
      for (const symbol of getBuiltinSymbols()) {
        this.types.set(symbol.name, symbol);
      }
    }

    for (const contribution of this.contributions.values()) {
      this.applyContribution(contribution);
    }
  }

  private applyContribution(contribution: DocumentContribution): void {
    for (const symbol of contribution.types) {
      // Imports never override an already-resolved non-import symbol (builtin,
      // user, or import from another document) — same rule as the old inline
      // processImportDefinition check.
      if (symbol.source === 'import') {
        const existing = this.types.get(symbol.name);
        if (existing && existing.source !== 'import') {
          continue;
        }
      }
      this.types.set(symbol.name, symbol);
    }
    for (const symbol of contribution.constants) {
      this.constants.set(symbol.name, symbol);
    }
    for (const imp of contribution.imports) {
      this.imports.push(imp);
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
        this.emitImport(def as ImportDefinition);
        this.processImportDefinition(def as ImportDefinition, fileUri);
        break;
      case 'using':
        this.emitImport(def as ImportDefinition);
        break;
      case 'define':
        this.processDefineDefinition(def as DefineDefinition, fileUri);
        break;
      case 'pragma':
        // Skip pragma definitions - they don't create symbols
        break;
    }
  }

  // Emit an import symbol into the current contribution. The decision to skip it
  // when a non-import symbol already wins is applied later in applyContribution.
  private processImportDefinition(def: ImportDefinition, fileUri: string): void {
    const symbol: SymbolInfo = {
      name: def.name,
      kind: this.importKindToSymbolKind(def.importKind),
      location: createLocation(fileUri, def.range),
      detail: this.buildImportDetail(def),
      children: [],
      source: 'import',
    };

    this.emitType(symbol);
  }

  // Collect emitted symbols into the contribution being indexed.
  private emitType(symbol: SymbolInfo): void {
    this.current?.types.push(symbol);
  }

  private emitConstant(symbol: SymbolInfo): void {
    this.current?.constants.push(symbol);
  }

  private emitImport(def: ImportDefinition): void {
    this.current?.imports.push(def);
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

    this.emitType(symbol);
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

    this.emitType(symbol);
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

    this.emitType(symbol);
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

    this.emitType(symbol);
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

    this.emitType(symbol);
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

    this.emitConstant(symbol);
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

  // Pre-populate symbol table with built-in types. Reuses the per-locale cached
  // builtin symbols instead of recreating them on every call.
  mergeBuiltins(): void {
    this.builtinsMerged = true;
    for (const symbol of getBuiltinSymbols()) {
      // Don't overwrite user-defined types
      if (!this.types.has(symbol.name)) {
        this.types.set(symbol.name, symbol);
      }
    }
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
