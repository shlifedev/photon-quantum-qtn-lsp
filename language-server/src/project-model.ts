// Project Model for QTN Language Server
// Manages multiple .qtn documents and a unified symbol table across the project.

import { Location } from 'vscode-languageserver';
import { QtnDocument } from './ast.js';
import { parse } from './parser.js';
import { SymbolTable, SymbolInfo } from './symbol-table.js';

/**
 * ProjectModel manages the state of all .qtn files in the project.
 * It maintains:
 * - A map of URI -> parsed QtnDocument
 * - A unified SymbolTable aggregating symbols from all documents
 *
 * Symbol-table updates are incremental: a changed document only re-indexes its
 * own symbols, and builtins are computed once and reused. Removing a document
 * drops only that document's symbols.
 */
export class ProjectModel {
  private documents: Map<string, QtnDocument>;
  private symbolTable: SymbolTable;

  constructor() {
    this.documents = new Map();
    this.symbolTable = new SymbolTable();
    // Pre-populate with built-in types
    this.symbolTable.mergeBuiltins();
  }

  /**
   * Update a document: re-parse the text and re-index only this document's
   * symbols into the shared symbol table.
   * @param uri - Document URI
   * @param text - Full document text
   */
  updateDocument(uri: string, text: string): void {
    let doc: QtnDocument;
    try {
      doc = parse(text, uri);
    } catch (e) {
      // If the parser throws unexpectedly, store an empty document with an error
      // so the LSP server doesn't crash.
      doc = {
        uri,
        version: 0,
        definitions: [],
        parseErrors: [{
          message: `Internal parser error: ${e instanceof Error ? e.message : String(e)}`,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        }],
      };
    }

    // Store in documents map
    this.documents.set(uri, doc);

    // Re-index only this document; other documents and builtins are untouched.
    this.symbolTable.addFromDocument(doc);
  }

  /**
   * Remove a document from the project model along with its symbols.
   * @param uri - Document URI to remove
   */
  removeDocument(uri: string): void {
    this.documents.delete(uri);
    this.symbolTable.removeDocument(uri);
  }

  /**
   * Get a parsed document by URI.
   * @param uri - Document URI
   * @returns The parsed QtnDocument, or undefined if not found
   */
  getDocument(uri: string): QtnDocument | undefined {
    return this.documents.get(uri);
  }

  /**
   * Get all documents in the project.
   * @returns Map of URI -> QtnDocument
   */
  getAllDocuments(): Map<string, QtnDocument> {
    return this.documents;
  }

  /**
   * Get all symbols from the symbol table.
   * @returns Array of all SymbolInfo objects
   */
  getAllSymbols(): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

    // Collect all type symbols
    for (const symbol of this.symbolTable.types.values()) {
      symbols.push(symbol);
    }

    // Collect all constant symbols
    for (const symbol of this.symbolTable.constants.values()) {
      symbols.push(symbol);
    }

    return symbols;
  }

  /**
   * Find the definition location of a symbol by name.
   * @param name - Symbol name to look up
   * @returns Location if found and user-defined, null otherwise
   */
  findDefinition(name: string): Location | null {
    const symbol = this.symbolTable.lookup(name);

    // Only return user-defined symbols (not builtins or imports)
    if (symbol && symbol.source === 'user') {
      return symbol.location;
    }

    return null;
  }

  /**
   * Get the symbol table for direct access by handlers.
   * @returns The SymbolTable instance
   */
  getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }
}
