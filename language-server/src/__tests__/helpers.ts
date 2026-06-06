// Shared test setup for handler unit tests.
//
// completion/hover/definition read the document text from the LSP TextDocuments
// manager (not from ProjectModel), so handlers need both: a ProjectModel that
// owns the parsed symbols and a `documents` stub that returns the open document.

import type { Position, TextDocuments } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ProjectModel } from '../project-model.js';

export interface Fixture {
  projectModel: ProjectModel;
  documents: TextDocuments<TextDocument>;
  uri: string;
}

export function setupDocument(source: string, uri = 'test://test.qtn'): Fixture {
  const projectModel = new ProjectModel();
  projectModel.updateDocument(uri, source);

  const doc = TextDocument.create(uri, 'qtn', 1, source);
  const documents = {
    get: (u: string) => (u === uri ? doc : undefined),
  } as unknown as TextDocuments<TextDocument>;

  return { projectModel, documents, uri };
}

export function pos(line: number, character: number): Position {
  return { line, character };
}
