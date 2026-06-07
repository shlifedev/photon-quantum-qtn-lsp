// Go to Definition handler for QTN Language Server
// Resolves symbol at cursor position to its definition location

import { DefinitionParams, Location } from 'vscode-languageserver';
import { TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ProjectModel } from './project-model.js';
import { getIdentifierAtPosition, isPositionInCommentOrString } from './text-navigation.js';

/**
 * Handle "Go to Definition" request.
 * Returns the location of the symbol definition if found.
 *
 * @param params - LSP definition request parameters (contains position)
 * @param projectModel - Project model with symbol table
 * @param documents - Document manager
 * @returns Location of definition, or null if not found or builtin
 */
export function handleDefinition(
  params: DefinitionParams,
  projectModel: ProjectModel,
  documents: TextDocuments<TextDocument>
): Location | null {
  // Get the document at the requested URI
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  if (isPositionInCommentOrString(document, params.position)) {
    return null;
  }

  // Extract the word at the cursor position
  const word = getIdentifierAtPosition(document, params.position);
  if (!word) {
    return null;
  }

  // Look up the symbol in the project model
  // Returns null for builtins or undefined symbols
  return projectModel.findDefinition(word);
}
