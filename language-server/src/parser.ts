// QTN Recursive Descent Parser
// Converts token stream from lexer into AST (ast.ts nodes).
// Implements panic-mode error recovery: on parse errors, skips to }, ;, or top-level keyword.

import { tokenize, QtnToken, TokenType } from './lexer.js';
import {
  type SourceRange,
  type Position,
  type TypeReference,
  type TypeArgument,
  type Attribute,
  type QtnAstNode,
  type FieldDefinition,
  type EnumMemberDefinition,
  type TypeDefinition,
  type TypeKind,
  type EventDefinition,
  type ParameterDefinition,
  type SignalDefinition,
  type InputDefinition,
  type GlobalDefinition,
  type ImportDefinition,
  type ImportKind,
  type PragmaDefinition,
  type DefineDefinition,
  type Definition,
  type ParseError,
  type QtnDocument,
  emptyRange,
} from './ast.js';

// ── Recovery anchors ───────────────────────────────────────────────

const MAX_GENERIC_DEPTH = 32;

const TOP_LEVEL_KEYWORDS = new Set([
  'component', 'struct', 'enum', 'flags', 'union', 'event', 'signal',
  'input', 'global', 'asset', 'import', 'using', 'singleton', 'abstract',
  '#pragma', '#define', 'synced', 'client', 'server',
]);

// Field-level modifier keywords that precede a type in field lists
const FIELD_MODIFIERS = new Set([
  'nothashed', 'synced', 'local', 'remote', 'client', 'server',
]);

// ── Parser ─────────────────────────────────────────────────────────

class Parser {
  private tokens: QtnToken[];
  private pos: number;
  private fileUri: string;
  private errors: ParseError[];

  constructor(tokens: QtnToken[], fileUri: string) {
    this.tokens = tokens;
    this.pos = 0;
    this.fileUri = fileUri;
    this.errors = [];
  }

  // ── Token helpers ──────────────────────────────────────────────

  /** Current token (never past EOF). */
  private current(): QtnToken {
    return this.tokens[this.pos] ?? this.eofToken();
  }

  /** Look ahead by `offset` tokens. */
  private peek(offset: number = 1): QtnToken {
    return this.tokens[this.pos + offset] ?? this.eofToken();
  }

  /** Advance and return the consumed token. */
  private advance(): QtnToken {
    const tok = this.current();
    if (tok.type !== TokenType.eof) {
      this.pos++;
    }
    return tok;
  }

  /** Check if current token matches type and optionally value. */
  private check(type: TokenType, value?: string): boolean {
    const t = this.current();
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  /** Consume if current token matches; return it, or null. */
  private match(type: TokenType, value?: string): QtnToken | null {
    if (this.check(type, value)) {
      return this.advance();
    }
    return null;
  }

  /** Require a token; record error and return a synthetic token if missing. */
  private expect(type: TokenType, value?: string): QtnToken {
    if (this.check(type, value)) {
      return this.advance();
    }
    const cur = this.current();
    const expected = value ? `'${value}'` : type;
    this.addError(`Expected ${expected} but got '${cur.value}'`, cur.range);
    // Return a synthetic token at current position so callers can continue.
    return {
      type,
      value: value ?? '',
      range: cur.range,
    };
  }

  private isEof(): boolean {
    return this.current().type === TokenType.eof;
  }

  private eofToken(): QtnToken {
    const last = this.tokens[this.tokens.length - 1];
    return last && last.type === TokenType.eof
      ? last
      : { type: TokenType.eof, value: '', range: emptyRange() };
  }

  // ── Error helpers ──────────────────────────────────────────────

  private addError(message: string, range: SourceRange): void {
    this.errors.push({ message, range });
  }

  /**
   * Panic-mode recovery: skip tokens until we reach a recovery anchor.
   * Recovery anchors are: `}`, `;`, top-level keyword, or EOF.
   * If we land on `;` we consume it. If we land on `}` we stop *before*
   * it so the block parser can close properly.
   *
   * Safety guarantee: Always advances at least one token if not at EOF.
   */
  private skipToRecoveryPoint(): void {
    const startPos = this.pos;

    while (!this.isEof()) {
      const tok = this.current();
      // Top-level keyword: stop *before* consuming so the main loop dispatches it.
      if (tok.type === TokenType.keyword && TOP_LEVEL_KEYWORDS.has(tok.value)) {
        // Ensure we advanced at least once
        if (this.pos === startPos) {
          this.advance();
        }
        return;
      }
      // `[` for attribute lists at top level
      if (tok.type === TokenType.punctuation && tok.value === '[') {
        // Ensure we advanced at least once
        if (this.pos === startPos) {
          this.advance();
        }
        return;
      }
      // `;` — consume and stop
      if (tok.type === TokenType.punctuation && tok.value === ';') {
        this.advance();
        return;
      }
      // `}` — stop *before* consuming so the block parser can close properly.
      if (tok.type === TokenType.punctuation && tok.value === '}') {
        // Ensure we advanced at least once
        if (this.pos === startPos) {
          this.advance();
        }
        return;
      }
      this.advance();
    }
  }

  // ── Range helpers ──────────────────────────────────────────────

  /** Make a range spanning from `start` to `end`. */
  private makeRange(start: SourceRange, end: SourceRange): SourceRange {
    return { start: start.start, end: end.end };
  }

  /** Position of the previously consumed token (for end of ranges). */
  private prevRange(): SourceRange {
    if (this.pos > 0) {
      return this.tokens[this.pos - 1].range;
    }
    return this.current().range;
  }

  // ── Main entry ─────────────────────────────────────────────────

  parse(): QtnDocument {
    const definitions: Definition[] = [];

    while (!this.isEof()) {
      const posBefore = this.pos;
      const def = this.parseTopLevel();
      if (def) {
        definitions.push(def);
      }

      // Infinite loop prevention: ensure we always advance
      if (this.pos === posBefore && !this.isEof()) {
        // Force advance to prevent infinite loop
        this.advance();
      }
    }

    return {
      uri: this.fileUri,
      version: 0,
      definitions,
      parseErrors: this.errors,
    };
  }

  // ── Top-level dispatch ─────────────────────────────────────────

  private parseTopLevel(): Definition | null {
    // Collect leading attributes
    const attributes = this.tryParseAttributes();

    const tok = this.current();

    // EOF check after possible attribute parse
    if (this.isEof()) return null;

    // Keyword dispatch
    if (tok.type === TokenType.keyword) {
      switch (tok.value) {
        case 'struct':
          return this.parseStruct(attributes);
        case 'union':
          return this.parseUnion(attributes);
        case 'component':
          return this.parseComponent(false, [], attributes);
        case 'singleton': {
          const singletonTok = this.advance(); // consume 'singleton'
          if (this.check(TokenType.keyword, 'component')) {
            return this.parseComponent(true, [], attributes, singletonTok.range);
          }
          // Could be: import singleton Name; — but 'singleton' at top-level
          // should be followed by 'component'. Error recovery.
          this.addError("Expected 'component' after 'singleton'", this.current().range);
          this.skipToRecoveryPoint();
          return null;
        }
        case 'enum':
          return this.parseEnum(attributes);
        case 'flags':
          return this.parseFlags(attributes);
        case 'event':
          return this.parseEvent([], attributes);
        case 'synced': {
          const syncTok = this.advance();
          if (this.check(TokenType.keyword, 'event')) {
            return this.parseEvent(['synced'], attributes, syncTok.range);
          }
          this.addError("Expected 'event' after 'synced'", this.current().range);
          this.skipToRecoveryPoint();
          return null;
        }
        case 'abstract': {
          const absTok = this.advance();
          if (this.check(TokenType.keyword, 'event')) {
            return this.parseEvent(['abstract'], attributes, absTok.range);
          }
          if (this.check(TokenType.keyword, 'singleton')) {
            this.advance();
            if (this.check(TokenType.keyword, 'component')) {
              return this.parseComponent(true, ['abstract'], attributes, absTok.range);
            }
            this.addError("Expected 'component' after 'abstract singleton'", this.current().range);
            this.skipToRecoveryPoint();
            return null;
          }
          if (this.check(TokenType.keyword, 'component')) {
            return this.parseComponent(false, ['abstract'], attributes, absTok.range);
          }
          this.addError("Expected 'event', 'component', or 'singleton component' after 'abstract'", this.current().range);
          this.skipToRecoveryPoint();
          return null;
        }
        case 'client': {
          const cliTok = this.advance();
          if (this.check(TokenType.keyword, 'event')) {
            return this.parseEvent(['client'], attributes, cliTok.range);
          }
          this.addError("Expected 'event' after 'client'", this.current().range);
          this.skipToRecoveryPoint();
          return null;
        }
        case 'server': {
          const srvTok = this.advance();
          if (this.check(TokenType.keyword, 'event')) {
            return this.parseEvent(['server'], attributes, srvTok.range);
          }
          this.addError("Expected 'event' after 'server'", this.current().range);
          this.skipToRecoveryPoint();
          return null;
        }
        case 'local': {
          const localTok = this.advance();
          if (this.check(TokenType.keyword, 'event')) {
            return this.parseEvent(['local'], attributes, localTok.range);
          }
          this.addError("Expected 'event' after 'local'", this.current().range);
          this.skipToRecoveryPoint();
          return null;
        }
        case 'remote': {
          const remoteTok = this.advance();
          if (this.check(TokenType.keyword, 'event')) {
            return this.parseEvent(['remote'], attributes, remoteTok.range);
          }
          this.addError("Expected 'event' after 'remote'", this.current().range);
          this.skipToRecoveryPoint();
          return null;
        }
        case 'signal':
          return this.parseSignal(attributes);
        case 'input':
          return this.parseInput(attributes);
        case 'global':
          return this.parseGlobal(attributes);
        case 'asset':
          return this.parseAsset(attributes);
        case 'import':
          return this.parseImport();
        case 'using':
          return this.parseUsing();
        case '#pragma':
          return this.parsePragma();
        case '#define':
          return this.parseDefine();
        default:
          // Unknown keyword at top level
          this.addError(`Unexpected keyword '${tok.value}' at top level`, tok.range);
          this.advance();
          this.skipToRecoveryPoint();
          return null;
      }
    }

    // Unexpected token at top level
    this.addError(`Unexpected token '${tok.value}' at top level`, tok.range);
    this.advance();
    this.skipToRecoveryPoint();
    return null;
  }

  // ── Struct ─────────────────────────────────────────────────────

  private parseStruct(attributes: Attribute[]): TypeDefinition | null {
    const kwTok = this.advance(); // consume 'struct'
    const startRange = kwTok.range;

    const name = this.expectIdentifierOrKeyword('type name');

    // Optional base type: `: BaseType`
    let baseType: string | undefined;
    if (this.match(TokenType.punctuation, ':')) {
      baseType = this.expectIdentifierOrKeyword('base type').value;
    }

    const fields = this.parseFieldBlock();
    const endRange = this.prevRange();

    return {
      kind: 'struct',
      name: name.value,
      modifiers: [],
      fields,
      enumMembers: [],
      baseType,
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Union ──────────────────────────────────────────────────────

  private parseUnion(attributes: Attribute[]): TypeDefinition | null {
    const kwTok = this.advance(); // consume 'union'
    const startRange = kwTok.range;

    const name = this.expectIdentifierOrKeyword('type name');
    const fields = this.parseFieldBlock();
    const endRange = this.prevRange();

    return {
      kind: 'union',
      name: name.value,
      modifiers: [],
      fields,
      enumMembers: [],
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Component ──────────────────────────────────────────────────

  private parseComponent(
    singleton: boolean,
    extraModifiers: string[],
    attributes: Attribute[],
    leadingRange?: SourceRange,
  ): TypeDefinition | null {
    const kwTok = this.advance(); // consume 'component'
    const startRange = leadingRange ?? kwTok.range;

    const name = this.expectIdentifierOrKeyword('component name');

    let baseType: string | undefined;
    if (this.match(TokenType.punctuation, ':')) {
      baseType = this.expectIdentifierOrKeyword('base component name').value;
    }

    const fields = this.parseFieldBlock();
    const endRange = this.prevRange();

    const modifiers = [...extraModifiers];
    if (singleton) modifiers.push('singleton');

    return {
      kind: 'component',
      name: name.value,
      modifiers,
      fields,
      enumMembers: [],
      baseType,
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Enum ───────────────────────────────────────────────────────

  private parseEnum(attributes: Attribute[]): TypeDefinition | null {
    const kwTok = this.advance(); // consume 'enum'
    const startRange = kwTok.range;

    const name = this.expectIdentifierOrKeyword('enum name');

    let baseType: string | undefined;
    if (this.match(TokenType.punctuation, ':')) {
      baseType = this.expectIdentifierOrKeyword('underlying type').value;
    }

    const members = this.parseEnumMemberBlock();
    const endRange = this.prevRange();

    return {
      kind: 'enum',
      name: name.value,
      modifiers: [],
      fields: [],
      enumMembers: members,
      baseType,
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Flags ──────────────────────────────────────────────────────

  private parseFlags(attributes: Attribute[]): TypeDefinition | null {
    const kwTok = this.advance(); // consume 'flags'
    const startRange = kwTok.range;

    const name = this.expectIdentifierOrKeyword('flags name');

    let baseType: string | undefined;
    if (this.match(TokenType.punctuation, ':')) {
      baseType = this.expectIdentifierOrKeyword('underlying type').value;
    }

    const members = this.parseEnumMemberBlock();
    const endRange = this.prevRange();

    return {
      kind: 'flags',
      name: name.value,
      modifiers: [],
      fields: [],
      enumMembers: members,
      baseType,
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Event ──────────────────────────────────────────────────────

  private parseEvent(
    modifiers: string[],
    attributes: Attribute[],
    leadingRange?: SourceRange,
  ): EventDefinition | null {
    const kwTok = this.advance(); // consume 'event'
    const startRange = leadingRange ?? kwTok.range;

    const name = this.expectIdentifierOrKeyword('event name');

    let parentName: string | undefined;
    if (this.match(TokenType.punctuation, ':')) {
      parentName = this.expectIdentifierOrKeyword('parent event name').value;
    }

    const fields = this.parseFieldBlock();
    const endRange = this.prevRange();

    return {
      kind: 'event',
      name: name.value,
      modifiers: [...modifiers],
      parentName,
      fields,
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Signal ─────────────────────────────────────────────────────

  private parseSignal(attributes: Attribute[]): SignalDefinition | null {
    const kwTok = this.advance(); // consume 'signal'
    const startRange = kwTok.range;

    const name = this.expectIdentifierOrKeyword('signal name');

    let parameters: ParameterDefinition[] = [];

    // signal Foo(params...); or signal Foo;
    if (this.match(TokenType.punctuation, '(')) {
      parameters = this.parseParameterList();
      this.expect(TokenType.punctuation, ')');
    }

    this.match(TokenType.punctuation, ';'); // optional trailing semicolon
    const endRange = this.prevRange();

    return {
      kind: 'signal',
      name: name.value,
      parameters,
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Input ──────────────────────────────────────────────────────

  private parseInput(attributes: Attribute[]): InputDefinition | null {
    const kwTok = this.advance(); // consume 'input'
    const startRange = kwTok.range;

    const fields = this.parseFieldBlock();
    const endRange = this.prevRange();

    return {
      kind: 'input',
      fields,
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Global ─────────────────────────────────────────────────────

  private parseGlobal(attributes: Attribute[]): GlobalDefinition | null {
    const kwTok = this.advance(); // consume 'global'
    const startRange = kwTok.range;

    const fields = this.parseFieldBlock();
    const endRange = this.prevRange();

    return {
      kind: 'global',
      fields,
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Asset ──────────────────────────────────────────────────────

  private parseAsset(attributes: Attribute[]): TypeDefinition | null {
    const kwTok = this.advance(); // consume 'asset'
    const startRange = kwTok.range;

    const name = this.expectIdentifierOrKeyword('asset name');
    this.expect(TokenType.punctuation, ';');
    const endRange = this.prevRange();

    return {
      kind: 'asset',
      name: name.value,
      modifiers: [],
      fields: [],
      enumMembers: [],
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Import ─────────────────────────────────────────────────────

  private parseImport(): ImportDefinition | null {
    const kwTok = this.advance(); // consume 'import'
    const startRange = kwTok.range;

    const tok = this.current();

    // import struct Name(size);  or  import struct Name;
    if (tok.type === TokenType.keyword && tok.value === 'struct') {
      this.advance();
      const name = this.expectIdentifierOrKeyword('struct name').value;
      let size: number | undefined;
      if (this.match(TokenType.punctuation, '(')) {
        const numTok = this.expect(TokenType.number);
        size = this.parseNumericValue(numTok.value);
        this.expect(TokenType.punctuation, ')');
      }
      this.expect(TokenType.punctuation, ';');
      return {
        kind: 'import',
        importKind: 'struct',
        name,
        size,
        range: this.makeRange(startRange, this.prevRange()),
        fileUri: this.fileUri,
      };
    }

    // import enum Name(baseType);  or  import enum Name;
    if (tok.type === TokenType.keyword && tok.value === 'enum') {
      this.advance();
      const name = this.expectIdentifierOrKeyword('enum name').value;
      let underlyingType: string | undefined;
      if (this.match(TokenType.punctuation, '(')) {
        underlyingType = this.expectIdentifierOrKeyword('underlying type').value;
        this.expect(TokenType.punctuation, ')');
      }
      this.expect(TokenType.punctuation, ';');
      return {
        kind: 'import',
        importKind: 'enum',
        name,
        underlyingType,
        range: this.makeRange(startRange, this.prevRange()),
        fileUri: this.fileUri,
      };
    }

    // import singleton Name;
    if (tok.type === TokenType.keyword && tok.value === 'singleton') {
      this.advance();
      const name = this.parseDottedName();
      this.expect(TokenType.punctuation, ';');
      return {
        kind: 'import',
        importKind: 'singleton',
        name,
        range: this.makeRange(startRange, this.prevRange()),
        fileUri: this.fileUri,
      };
    }

    // import component Name;
    if (tok.type === TokenType.keyword && tok.value === 'component') {
      this.advance();
      const name = this.parseDottedName();
      this.expect(TokenType.punctuation, ';');
      return {
        kind: 'import',
        importKind: 'component',
        name,
        range: this.makeRange(startRange, this.prevRange()),
        fileUri: this.fileUri,
      };
    }

    // import Name;  or  import Namespace.Sub.Name;
    const name = this.parseDottedName();
    this.expect(TokenType.punctuation, ';');
    return {
      kind: 'import',
      importKind: 'type',
      name,
      range: this.makeRange(startRange, this.prevRange()),
      fileUri: this.fileUri,
    };
  }

  // ── Using ──────────────────────────────────────────────────────

  private parseUsing(): ImportDefinition | null {
    const kwTok = this.advance(); // consume 'using'
    const startRange = kwTok.range;

    const name = this.parseDottedName();
    this.expect(TokenType.punctuation, ';');

    return {
      kind: 'using',
      importKind: 'using',
      name,
      range: this.makeRange(startRange, this.prevRange()),
      fileUri: this.fileUri,
    };
  }

  // ── Pragma ─────────────────────────────────────────────────────

  private parsePragma(): PragmaDefinition | null {
    const kwTok = this.advance(); // consume '#pragma'
    const startRange = kwTok.range;

    const key = this.expectIdentifierOrKeyword('pragma key').value;

    // Value: number or identifier
    let value: string;
    if (this.check(TokenType.number)) {
      value = this.advance().value;
    } else {
      value = this.expectIdentifierOrKeyword('pragma value').value;
    }

    const endRange = this.prevRange();

    return {
      kind: 'pragma',
      key,
      value,
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Define ─────────────────────────────────────────────────────

  private parseDefine(): DefineDefinition | null {
    const kwTok = this.advance(); // consume '#define'
    const startRange = kwTok.range;

    const name = this.expectIdentifierOrKeyword('define name').value;
    const numTok = this.expect(TokenType.number);
    const numValue = this.parseNumericValue(numTok.value);
    const endRange = this.prevRange();

    return {
      kind: 'define',
      name,
      value: numValue,
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  // ── Field block { field; field; ... } ──────────────────────────

  private parseFieldBlock(): FieldDefinition[] {
    const fields: FieldDefinition[] = [];

    if (!this.match(TokenType.punctuation, '{')) {
      this.addError("Expected '{'", this.current().range);
      this.skipToRecoveryPoint();
      return fields;
    }

    while (!this.isEof() && !this.check(TokenType.punctuation, '}')) {
      const posBefore = this.pos;
      try {
        const field = this.parseField();
        if (field) {
          fields.push(field);
        }
      } catch {
        // Safety net — should not happen with internal recovery, but guard anyway.
        this.skipToFieldRecoveryPoint();
      }

      // Infinite loop prevention: ensure we always advance
      if (this.pos === posBefore && !this.isEof() && !this.check(TokenType.punctuation, '}')) {
        this.advance();
      }
    }

    if (!this.check(TokenType.punctuation, '}')) {
      // Unclosed block
      this.addError("Expected '}' to close field block", this.current().range);
    } else {
      this.expect(TokenType.punctuation, '}');
    }
    return fields;
  }

  // ── Single field ───────────────────────────────────────────────

  private parseField(): FieldDefinition | null {
    // Collect field-level attributes
    const attributes = this.tryParseAttributes();

    // Check for `}` — we may have consumed only attributes before the closing brace
    if (this.check(TokenType.punctuation, '}')) {
      return null;
    }

    const startRange = this.current().range;

    // Collect field modifiers: nothashed, synced, local, remote, client, server
    const modifiers: string[] = [];
    while (this.current().type === TokenType.keyword && FIELD_MODIFIERS.has(this.current().value)) {
      modifiers.push(this.advance().value);
    }

    // Parse type reference
    const typeRef = this.parseTypeRef();
    if (!typeRef) {
      this.addError('Expected type in field definition', this.current().range);
      this.skipToFieldRecoveryPoint();
      return null;
    }

    // Field name
    const nameTok = this.expectIdentifierOrKeyword('field name');

    this.expect(TokenType.punctuation, ';');
    const endRange = this.prevRange();

    // Store modifiers in the field's attributes as pseudo-attributes or
    // directly; the AST doesn't have a modifiers field on FieldDefinition,
    // so we prepend modifier pseudo-attributes.
    const modifierAttrs: Attribute[] = modifiers.map(m => ({
      name: m,
      args: [],
      range: startRange,
    }));

    return {
      kind: 'field',
      name: nameTok.value,
      typeRef,
      attributes: [...modifierAttrs, ...attributes],
      range: this.makeRange(startRange, endRange),
      fileUri: this.fileUri,
    };
  }

  /**
   * Skip to `;` or `}` inside a field block for recovery.
   * Safety guarantee: Always advances at least one token if not at EOF.
   */
  private skipToFieldRecoveryPoint(): void {
    const startPos = this.pos;

    while (!this.isEof()) {
      const tok = this.current();
      if (tok.type === TokenType.punctuation && tok.value === ';') {
        this.advance();
        return;
      }
      if (tok.type === TokenType.punctuation && tok.value === '}') {
        // Don't consume — let the block-close handler eat it.
        // Ensure we advanced at least once
        if (this.pos === startPos) {
          this.advance();
        }
        return;
      }
      this.advance();
    }

    // At EOF: ensure we advanced at least once
    if (this.pos === startPos) {
      this.advance();
    }
  }

  // ── Enum member block { A, B = 1, C } ─────────────────────────

  private parseEnumMemberBlock(): EnumMemberDefinition[] {
    const members: EnumMemberDefinition[] = [];

    if (!this.match(TokenType.punctuation, '{')) {
      this.addError("Expected '{'", this.current().range);
      this.skipToRecoveryPoint();
      return members;
    }

    while (!this.isEof() && !this.check(TokenType.punctuation, '}')) {
      const posBefore = this.pos;
      const memberStart = this.current().range;
      const nameTok = this.expectIdentifierOrKeyword('enum member name');

      let value: number | undefined;
      if (this.match(TokenType.punctuation, '=')) {
        const numTok = this.expect(TokenType.number);
        value = this.parseNumericValue(numTok.value);
      }

      const endRange = this.prevRange();

      members.push({
        kind: 'enumMember',
        name: nameTok.value,
        value,
        range: this.makeRange(memberStart, endRange),
        fileUri: this.fileUri,
      });

      // Comma separator (optional before `}`)
      if (!this.match(TokenType.punctuation, ',')) {
        // If next is not `}`, that's an error but we can continue
        if (!this.check(TokenType.punctuation, '}')) {
          this.addError("Expected ',' or '}' in enum member list", this.current().range);
          // Try to recover: skip to comma, }, or next identifier
          this.skipToEnumRecoveryPoint();
        }
      }

      // Infinite loop prevention: ensure we always advance
      if (this.pos === posBefore && !this.isEof() && !this.check(TokenType.punctuation, '}')) {
        this.advance();
      }
    }

    if (!this.check(TokenType.punctuation, '}')) {
      // Unclosed block
      this.addError("Expected '}' to close enum block", this.current().range);
    } else {
      this.expect(TokenType.punctuation, '}');
    }
    return members;
  }

  /**
   * Skip to `,`, `}`, or identifier inside an enum block.
   * `,` is consumed, `}` is NOT consumed (caller handles block close).
   * Safety guarantee: Always advances at least one token if not at EOF.
   */
  private skipToEnumRecoveryPoint(): void {
    const startPos = this.pos;

    while (!this.isEof()) {
      const tok = this.current();
      if (tok.type === TokenType.punctuation && tok.value === ',') {
        this.advance();
        return;
      }
      // `}` — stop *before* consuming so the enum block parser can close.
      if (tok.type === TokenType.punctuation && tok.value === '}') {
        if (this.pos === startPos) {
          this.advance();
        }
        return;
      }
      if (tok.type === TokenType.identifier || tok.type === TokenType.keyword) {
        // Next member: ensure we advanced at least once
        if (this.pos === startPos) {
          this.advance();
        }
        return;
      }
      this.advance();
    }

    // At EOF: ensure we advanced at least once
    if (this.pos === startPos) {
      this.advance();
    }
  }

  // ── Parameter list (signal) ────────────────────────────────────

  private parseParameterList(): ParameterDefinition[] {
    const params: ParameterDefinition[] = [];

    // Empty parameter list
    if (this.check(TokenType.punctuation, ')')) {
      return params;
    }

    while (!this.isEof()) {
      const paramStart = this.current().range;

      const typeRef = this.parseTypeRef();
      if (!typeRef) {
        this.addError('Expected parameter type', this.current().range);
        // Recovery: skip to ')' or ',' so caller can continue
        while (!this.isEof() && !this.check(TokenType.punctuation, ')') && !this.check(TokenType.punctuation, ',')) {
          this.advance();
        }
        if (this.match(TokenType.punctuation, ',')) {
          continue;
        }
        break;
      }

      const nameTok = this.expectIdentifierOrKeyword('parameter name');

      params.push({
        kind: 'parameter',
        name: nameTok.value,
        typeRef,
        range: this.makeRange(paramStart, this.prevRange()),
        fileUri: this.fileUri,
      });

      if (!this.match(TokenType.punctuation, ',')) {
        break;
      }
    }

    return params;
  }

  // ── Type reference ─────────────────────────────────────────────

  private parseTypeRef(depth: number = 0): TypeReference | null {
    const tok = this.current();

    if (tok.type !== TokenType.identifier && tok.type !== TokenType.keyword) {
      return null;
    }

    const startRange = tok.range;
    this.advance();

    // Build potentially dotted name: Namespace.Sub.Type
    let name = tok.value;
    while (this.check(TokenType.punctuation, '.')) {
      this.advance(); // consume '.'
      const next = this.expectIdentifierOrKeyword('type name segment');
      name += '.' + next.value;
    }

    // Capture nameRange: covers only the type name (before generics/array)
    const nameRange = this.makeRange(startRange, this.prevRange());

    // Generic args: <T>, <K,V>, <T>[N]
    let genericArgs: TypeArgument[] = [];
    if (this.match(TokenType.punctuation, '<')) {
      if (depth >= MAX_GENERIC_DEPTH) {
        this.addError('Generic type nesting too deep', this.current().range);
        // Skip to matching '>' to recover
        let angleDepth = 1;
        while (!this.isEof() && angleDepth > 0) {
          const t = this.current();
          if (t.type === TokenType.punctuation && t.value === '<') angleDepth++;
          if (t.type === TokenType.punctuation && t.value === '>') angleDepth--;
          if (angleDepth > 0) this.advance();
        }
      } else {
        genericArgs = this.parseGenericArgs(depth);
      }
      this.expect(TokenType.punctuation, '>');
    }

    // Array size: [N] (for array<T>[N] or bitset[N])
    let arraySize: number | undefined;
    if (this.match(TokenType.punctuation, '[')) {
      const sizeTok = this.expect(TokenType.number);
      arraySize = this.parseNumericValue(sizeTok.value);
      this.expect(TokenType.punctuation, ']');
    }

    // Nullable suffix: FP? → becomes NullableFP conceptually, but
    // we store it as the original name with `?` appended for downstream.
    // Actually the AST TypeReference doesn't have an isNullable flag.
    // The DSL maps FP? → NullableFP at codegen. For the parser we record
    // it as the name with a nullable indicator. Let's just rename it.
    if (this.match(TokenType.punctuation, '?')) {
      name = 'Nullable' + name;
    }

    // Pointer suffix: Type* (used in signal params)
    let isPointer = false;
    if (this.match(TokenType.punctuation, '*')) {
      isPointer = true;
    }

    const endRange = this.prevRange();

    return {
      name,
      nameRange,
      genericArgs,
      arraySize,
      isPointer,
      range: this.makeRange(startRange, endRange),
    };
  }

  /** Parse comma-separated type or numeric arguments inside < > */
  private parseGenericArgs(depth: number = 0): TypeArgument[] {
    const args: TypeArgument[] = [];

    // Empty generic args (shouldn't happen in valid QTN but handle gracefully)
    if (this.check(TokenType.punctuation, '>')) {
      return args;
    }

    while (!this.isEof()) {
      const arg = this.parseGenericArg(depth + 1);
      if (!arg) {
        this.addError('Expected type argument', this.current().range);
        break;
      }
      args.push(arg);

      if (!this.match(TokenType.punctuation, ',')) {
        break;
      }
    }

    return args;
  }

  private parseGenericArg(depth: number): TypeArgument | null {
    if (this.check(TokenType.number)) {
      const tok = this.advance();
      return {
        kind: 'number',
        value: this.parseNumericValue(tok.value),
        raw: tok.value,
        range: tok.range,
      };
    }

    return this.parseTypeRef(depth);
  }

  // ── Attribute list ─────────────────────────────────────────────

  /**
   * Try to parse one or more `[Attr1, Attr2("arg")]` blocks.
   * Returns empty array if current token is not `[`.
   */
  private tryParseAttributes(): Attribute[] {
    const attributes: Attribute[] = [];

    while (this.check(TokenType.punctuation, '[')) {
      this.advance(); // consume '['

      // Parse one or more attributes separated by ','
      while (!this.isEof() && !this.check(TokenType.punctuation, ']')) {
        const attrStart = this.current().range;
        const nameTok = this.expectIdentifierOrKeyword('attribute name');

        const args: string[] = [];
        if (this.match(TokenType.punctuation, '(')) {
          // Parse attribute arguments
          while (!this.isEof() && !this.check(TokenType.punctuation, ')')) {
            const argTok = this.current();
            if (argTok.type === TokenType.string) {
              args.push(argTok.value);
              this.advance();
            } else if (argTok.type === TokenType.number) {
              args.push(argTok.value);
              this.advance();
            } else if (argTok.type === TokenType.identifier || argTok.type === TokenType.keyword) {
              args.push(argTok.value);
              this.advance();
            } else {
              // Unknown arg type, skip
              this.advance();
            }

            if (!this.match(TokenType.punctuation, ',')) {
              break;
            }
          }
          this.expect(TokenType.punctuation, ')');
        }

        const attrEnd = this.prevRange();
        attributes.push({
          name: nameTok.value,
          args,
          range: this.makeRange(attrStart, attrEnd),
        });

        // Multiple attributes within one [...] separated by ','
        if (!this.match(TokenType.punctuation, ',')) {
          break;
        }
      }

      this.expect(TokenType.punctuation, ']');
    }

    return attributes;
  }

  // ── Identifier helpers ─────────────────────────────────────────

  /**
   * Expect an identifier or keyword token. Many QTN names happen to be
   * keywords (e.g., a field type could be `button` which is a keyword in
   * the lexer). We accept both.
   */
  private expectIdentifierOrKeyword(description: string): QtnToken {
    const tok = this.current();
    if (tok.type === TokenType.identifier || tok.type === TokenType.keyword) {
      return this.advance();
    }
    this.addError(`Expected ${description} but got '${tok.value}'`, tok.range);
    return {
      type: TokenType.identifier,
      value: '<missing>',
      range: tok.range,
    };
  }

  /** Parse a dotted name chain: A.B.C */
  private parseDottedName(): string {
    const first = this.expectIdentifierOrKeyword('name');
    let name = first.value;

    while (this.match(TokenType.punctuation, '.')) {
      const next = this.expectIdentifierOrKeyword('name segment');
      name += '.' + next.value;
    }

    return name;
  }

  // ── Numeric helpers ────────────────────────────────────────────

  /** Parse a numeric string (int, float, hex) into a number. */
  private parseNumericValue(raw: string): number {
    const sign = raw.startsWith('-') ? -1 : 1;
    const unsigned = sign < 0 ? raw.substring(1) : raw;

    if (unsigned.startsWith('0x') || unsigned.startsWith('0X')) {
      return sign * parseInt(unsigned, 16);
    }
    if (unsigned.includes('.')) {
      return sign * parseFloat(unsigned);
    }
    return sign * parseInt(unsigned, 10);
  }
}

// ── Public API ─────────────────────────────────────────────────────

export function parse(text: string, fileUri: string): QtnDocument {
  const tokens = tokenize(text);
  const parser = new Parser(tokens, fileUri);
  return parser.parse();
}
