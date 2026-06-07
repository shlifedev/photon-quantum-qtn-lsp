// Completion Handler for QTN Language Server
import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  SymbolKind,
  TextDocuments,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ProjectModel } from './project-model.js';
import { TokenType, tokenize } from './lexer.js';
import type { QtnToken } from './lexer.js';
import {
  TOP_LEVEL_KEYWORDS,
  IMPORT_SUB_KEYWORDS,
  ATTRIBUTES,
  ENUM_BASE_TYPES,
  PRIMITIVE_TYPES,
  QUANTUM_TYPES,
  COLLECTION_TYPES,
  SPECIAL_TYPES,
  FIELD_MODIFIER_KEYWORDS,
  KEYWORD_MAP,
  getDescription,
} from './builtins.js';
import { getLocale } from './locale.js';
import { nodeKindToSymbolKind } from './symbol-table.js';
import { isPositionInCommentOrString } from './text-navigation.js';

// Completion context types
type CompletionContext =
  | 'topLevel'
  | 'fieldType'
  | 'attribute'
  | 'inputBlock'
  | 'import'
  | 'enumBase'
  | 'generic';

type Locale = 'ko' | 'en';

const topLevelCompletionCache = new Map<Locale, CompletionItem[]>();
const attributeCompletionCache = new Map<Locale, CompletionItem[]>();
const importCompletionCache = new Map<Locale, CompletionItem[]>();
const enumBaseCompletionCache = new Map<Locale, CompletionItem[]>();

interface StructuralState {
  braceDepth: number;
  innermostBlock: string | null;
}

/**
 * Main completion handler - analyzes cursor position and provides context-appropriate completions
 */
export function handleCompletion(
  params: CompletionParams,
  projectModel: ProjectModel,
  documents: TextDocuments<TextDocument>
): CompletionItem[] {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  if (isPositionInCommentOrString(document, params.position)) {
    return [];
  }

  const text = document.getText();
  const offset = document.offsetAt(params.position);

  // Detect completion context
  const context = detectContext(text, offset);

  // Generate completions based on context
  switch (context) {
    case 'topLevel':
      return getTopLevelCompletions();
    case 'fieldType':
      return getFieldTypeCompletions(projectModel);
    case 'attribute':
      return getAttributeCompletions();
    case 'inputBlock':
      return getInputBlockCompletions(projectModel);
    case 'import':
      return getImportCompletions();
    case 'enumBase':
      return getEnumBaseCompletions();
    case 'generic':
      return getGenericArgCompletions(projectModel);
    default:
      return [];
  }
}

/**
 * Detect the completion context based on the cursor position
 */
function detectContext(text: string, offset: number): CompletionContext {
  // Extract text up to cursor
  const textUpToCursor = text.substring(0, offset);

  // Get current line up to cursor without splitting entire prefix
  const lineStart = Math.max(
    textUpToCursor.lastIndexOf('\n'),
    textUpToCursor.lastIndexOf('\r')
  );
  const lineUpToCursor = lineStart === -1 ? textUpToCursor : textUpToCursor.slice(lineStart + 1);

  // Check if inside an attribute (unmatched '[')
  if (hasUnmatchedOpenBracket(textUpToCursor)) {
    return 'attribute';
  }

  // Check if after '<' for generic type argument
  if (isAfterGenericOpen(lineUpToCursor)) {
    return 'generic';
  }

  // Check if after 'import' keyword
  if (isAfterImportKeyword(lineUpToCursor)) {
    return 'import';
  }

  // Check if after enum/flags base type position (after ':')
  if (isEnumBasePosition(textUpToCursor, offset)) {
    return 'enumBase';
  }

  const structuralState = getStructuralState(textUpToCursor);

  // Check if inside input block
  if (isInsideInputBlock(structuralState)) {
    return 'inputBlock';
  }

  // Check if in field type position (inside a block, after '{' or ';')
  if (isFieldTypePosition(structuralState)) {
    return 'fieldType';
  }

  // Default: top-level context
  return 'topLevel';
}

/**
 * Check if there's an unmatched '[' (inside attribute)
 */
function hasUnmatchedOpenBracket(text: string): boolean {
  let openCount = 0;
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    // Handle comments
    if (!inString && !inBlockComment && ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (!inString && !inLineComment && ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (inBlockComment && ch === '*' && next === '/') {
      inBlockComment = false;
      i++;
      continue;
    }
    if (inLineComment && (ch === '\n' || ch === '\r')) {
      inLineComment = false;
      continue;
    }

    // Skip if in comment
    if (inLineComment || inBlockComment) continue;

    // Handle strings
    if (ch === '"' && (i === 0 || text[i - 1] !== '\\')) {
      inString = !inString;
      continue;
    }

    // Skip if in string
    if (inString) continue;

    // Count brackets
    if (ch === '[') {
      openCount++;
    } else if (ch === ']') {
      openCount--;
    }
  }

  return openCount > 0;
}

/**
 * Check if cursor is after '<' (generic type argument)
 */
function isAfterGenericOpen(lineUpToCursor: string): boolean {
  const trimmed = lineUpToCursor.trim();
  // Check if last non-whitespace character is '<'
  if (trimmed.endsWith('<')) {
    return true;
  }
  // Check if we're inside angle brackets (after '<' but before '>')
  const lastOpen = lineUpToCursor.lastIndexOf('<');
  const lastClose = lineUpToCursor.lastIndexOf('>');
  return lastOpen > lastClose;
}

/**
 * Check if cursor is after 'import' keyword
 */
function isAfterImportKeyword(lineUpToCursor: string): boolean {
  const trimmed = lineUpToCursor.trim();
  // Match: import followed by whitespace, no semicolon yet
  return /^import\s+\w*$/.test(trimmed);
}

/**
 * Check if in enum/flags base type position (after ':')
 */
function isEnumBasePosition(text: string, offset: number): boolean {
  // Look backwards from offset to find the line start
  let lineStart = offset;
  while (lineStart > 0 && text[lineStart - 1] !== '\n' && text[lineStart - 1] !== '\r') {
    lineStart--;
  }
  const line = text.substring(lineStart, offset);

  // Match: (enum|flags) TypeName :
  return /^\s*(enum|flags)\s+\w+\s*:\s*\w*$/.test(line);
}

/**
 * Check if inside input block
 */
function isInsideInputBlock(state: StructuralState): boolean {
  return state.innermostBlock === 'input';
}

/**
 * Check if in field type position (inside block, after '{' or ';')
 */
function isFieldTypePosition(state: StructuralState): boolean {
  return state.braceDepth > 0;
}

function getStructuralState(text: string): StructuralState {
  const tokens = tokenize(text).filter((token) => token.type !== TokenType.eof);
  const blockStack: Array<string | null> = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (isPunctuation(token, '{')) {
      blockStack.push(getBlockKeywordBeforeOpenBrace(tokens, i));
    } else if (isPunctuation(token, '}') && blockStack.length > 0) {
      blockStack.pop();
    }
  }

  return {
    braceDepth: blockStack.length,
    innermostBlock: blockStack[blockStack.length - 1] ?? null,
  };
}

function getBlockKeywordBeforeOpenBrace(tokens: QtnToken[], openBraceIndex: number): string | null {
  const previous = tokens[openBraceIndex - 1];
  if (previous?.type === TokenType.keyword && previous.value === 'input') {
    return 'input';
  }

  return null;
}

function isPunctuation(token: QtnToken, value: string): boolean {
  return token.type === TokenType.punctuation && token.value === value;
}

/**
 * Get top-level keyword completions
 */
function getTopLevelCompletions(): CompletionItem[] {
  const locale = getCurrentLocale();
  const cached = topLevelCompletionCache.get(locale);
  if (cached) {
    return cached;
  }

  const fallback = locale === 'ko' ? 'QTN 키워드' : 'QTN keyword';
  const completions = TOP_LEVEL_KEYWORDS.map((keyword) => {
    const info = KEYWORD_MAP.get(keyword);
    return {
      label: keyword,
      kind: CompletionItemKind.Keyword,
      detail: info ? getDescription(info, locale) : fallback,
    };
  });

  topLevelCompletionCache.set(locale, completions);
  return completions;
}

/**
 * Get field type completions (primitives + quantum types + collections + user-defined)
 */
function getFieldTypeCompletions(projectModel: ProjectModel): CompletionItem[] {
  const items: CompletionItem[] = [];

  const locale = getCurrentLocale();

  // Field modifier keywords (synced, local, remote, nothashed, ...)
  for (const keyword of FIELD_MODIFIER_KEYWORDS) {
    const info = KEYWORD_MAP.get(keyword);
    items.push({
      label: keyword,
      kind: CompletionItemKind.Keyword,
      detail: info ? getDescription(info, locale) : keyword,
    });
  }

  // Primitive types
  for (const type of PRIMITIVE_TYPES) {
    items.push({
      label: type.name,
      kind: CompletionItemKind.Struct,
      detail: getDescription(type, locale),
    });
  }

  // Quantum types
  for (const type of QUANTUM_TYPES) {
    items.push({
      label: type.name,
      kind: CompletionItemKind.Class,
      detail: getDescription(type, locale),
    });
  }

  // Collection types
  for (const type of COLLECTION_TYPES) {
    items.push({
      label: type.name,
      kind: CompletionItemKind.Class,
      detail: getDescription(type, locale),
    });
  }

  // User-defined types from symbol table
  const symbolTable = projectModel.getSymbolTable();
  for (const symbol of symbolTable.types.values()) {
    if (symbol.source === 'user' || symbol.source === 'import') {
      items.push({
        label: symbol.name,
        kind: symbolKindToCompletionItemKind(symbol.kind),
        detail: symbol.detail,
      });
    }
  }

  return items;
}

/**
 * Get attribute completions
 */
function getAttributeCompletions(): CompletionItem[] {
  const locale = getCurrentLocale();
  const cached = attributeCompletionCache.get(locale);
  if (cached) {
    return cached;
  }

  const completions = ATTRIBUTES.map((attr) => ({
    label: attr.name,
    kind: CompletionItemKind.Property,
    detail: getDescription(attr, locale),
  }));

  attributeCompletionCache.set(locale, completions);
  return completions;
}

/**
 * Get input block completions (field types + button)
 */
function getInputBlockCompletions(projectModel: ProjectModel): CompletionItem[] {
  const items = getFieldTypeCompletions(projectModel);
  const locale = getCurrentLocale();

  // Add 'button' special type
  for (const type of SPECIAL_TYPES) {
    if (type.name === 'button') {
      items.push({
        label: type.name,
        kind: CompletionItemKind.Keyword,
        detail: getDescription(type, locale),
      });
    }
  }

  return items;
}

/**
 * Get import sub-keyword completions
 */
function getImportCompletions(): CompletionItem[] {
  const locale = getCurrentLocale();
  const cached = importCompletionCache.get(locale);
  if (cached) {
    return cached;
  }

  const detail = locale === 'ko' ? 'import 하위 키워드' : 'Import sub-keyword';
  const completions = IMPORT_SUB_KEYWORDS.map((keyword) => ({
    label: keyword,
    kind: CompletionItemKind.Keyword,
    detail,
  }));

  importCompletionCache.set(locale, completions);
  return completions;
}

/**
 * Get enum base type completions (integer types only)
 */
function getEnumBaseCompletions(): CompletionItem[] {
  const locale = getCurrentLocale();
  const cached = enumBaseCompletionCache.get(locale);
  if (cached) {
    return cached;
  }

  const detail = locale === 'ko' ? 'enum 기본 타입용 정수 타입' : 'Integer type for enum base';
  const completions = ENUM_BASE_TYPES.map((type) => ({
    label: type,
    kind: CompletionItemKind.Struct,
    detail,
  }));

  enumBaseCompletionCache.set(locale, completions);
  return completions;
}

/**
 * Get generic type argument completions (same as field types)
 */
function getGenericArgCompletions(projectModel: ProjectModel): CompletionItem[] {
  return getFieldTypeCompletions(projectModel);
}

/**
 * Convert LSP SymbolKind to CompletionItemKind
 */
function symbolKindToCompletionItemKind(symbolKind: SymbolKind): CompletionItemKind {
  // Map common SymbolKind values to CompletionItemKind
  switch (symbolKind) {
    case SymbolKind.Class:
      return CompletionItemKind.Class;
    case SymbolKind.Struct:
      return CompletionItemKind.Struct;
    case SymbolKind.Enum:
      return CompletionItemKind.Enum;
    case SymbolKind.Event:
      return CompletionItemKind.Event;
    case SymbolKind.Function:
      return CompletionItemKind.Function;
    case SymbolKind.Interface:
      return CompletionItemKind.Interface;
    default:
      return CompletionItemKind.Class;
  }
}

function getCurrentLocale(): Locale {
  return getLocale() === 'ko' ? 'ko' : 'en';
}
