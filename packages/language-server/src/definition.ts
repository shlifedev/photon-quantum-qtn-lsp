// Go to Definition handler for QTN Language Server
// Resolves symbol at cursor position to its definition location

import { DefinitionParams, Location } from 'vscode-languageserver';
import { TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ProjectModel } from './project-model.js';
import { getIdentifierAtPosition } from './text-navigation.js';

/**
 * Handle "Go to Definition" request.
 * Returns all declaration sites for a symbol, including partial definitions.
 *
 * @param params - LSP definition request parameters (contains position)
 * @param projectModel - Project model with symbol table
 * @param documents - Document manager
 * @returns One location, multiple declaration locations, or null for unresolved/builtin names
 */
export function handleDefinition(
  params: DefinitionParams,
  projectModel: ProjectModel,
  documents: TextDocuments<TextDocument>
): Location | Location[] | null {
  // Get the document at the requested URI
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  // Extract the word at the cursor position
  const word = getIdentifierAtPosition(document, params.position);
  if (!word) {
    return null;
  }

  // Look up the symbol in the project model
  // Returns null for builtins or undefined symbols
  const locations = projectModel.findDefinitions(word);
  return locations.length > 1 ? locations : locations[0] ?? null;
}
