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
import { getCodeContext } from './text-navigation.js';

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

  const text = document.getText();
  const offset = document.offsetAt(params.position);

  const contextText = getCodeContext(text, offset);
  if (contextText.inCommentOrString) {
    return [];
  }

  // Detect completion context
  const context = detectContext(contextText.code);

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

/** Analyze code with comments and strings masked by the shared lexical scan. */
function detectContext(code: string): CompletionContext {
  const lineStart = Math.max(code.lastIndexOf('\n'), code.lastIndexOf('\r'));
  const line = code.slice(lineStart + 1);

  let brackets = 0;
  const blocks: string[] = [];
  let lastWord = '';
  for (const token of code.match(/[A-Za-z_@][A-Za-z0-9_@]*|[{}\[\]]/g) ?? []) {
    switch (token) {
      case '[': brackets++; break;
      case ']': brackets = Math.max(0, brackets - 1); break;
      case '{': blocks.push(lastWord); lastWord = ''; break;
      case '}': blocks.pop(); lastWord = ''; break;
      default: lastWord = token;
    }
  }

  if (brackets > 0) return 'attribute';
  if (line.lastIndexOf('<') > line.lastIndexOf('>')) return 'generic';
  // Keep trailing whitespace: completion is useful immediately after `import `.
  if (/^\s*import\s+\w*$/.test(line)) return 'import';
  if (/^\s*(enum|flags)\s+\w+\s*:\s*\w*$/.test(line)) return 'enumBase';
  if (blocks[blocks.length - 1] === 'input') return 'inputBlock';
  return blocks.length > 0 ? 'fieldType' : 'topLevel';
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
    if ((symbol.source === 'user' || symbol.source === 'import') &&
        (symbol.kind === SymbolKind.Class || symbol.kind === SymbolKind.Struct || symbol.kind === SymbolKind.Enum)) {
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
