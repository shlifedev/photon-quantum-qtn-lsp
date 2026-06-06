// AST Node Types for QTN Language Server
import { Range } from 'vscode-languageserver-textdocument';

// Node kinds matching QTN DSL constructs
export type NodeKind =
  | 'component' | 'struct' | 'enum' | 'flags' | 'union' | 'asset'
  | 'event' | 'signal' | 'input' | 'global'
  | 'import' | 'using' | 'pragma' | 'define'
  | 'field' | 'enumMember' | 'parameter';

// LSP-compatible Range (0-based lines and characters)
export interface Position {
  line: number;
  character: number;
}

export interface SourceRange {
  start: Position;
  end: Position;
}

// Numeric generic argument for fixed-size types such as QString<64>.
export interface NumericTypeArgument {
  kind: 'number';
  value: number;
  raw: string;
  range: SourceRange;
}

export type TypeArgument = TypeReference | NumericTypeArgument;

// Type reference for field types, generic args, etc.
export interface TypeReference {
  name: string;
  nameRange: SourceRange;  // range of the type name only (excluding generics/array)
  genericArgs: TypeArgument[];
  arraySize?: number;  // fixed array size: array<T>[N]
  isPointer: boolean;  // signal parameter pointer: *
  range: SourceRange;
}

// Attribute on a field or type: [Header("text")]
export interface Attribute {
  name: string;
  args: string[];
  range: SourceRange;
}

// Base AST node
export interface QtnAstNode {
  kind: NodeKind;
  name?: string;
  range: SourceRange;
  fileUri: string;
}

// Field in a struct/component/event/input/global block
export interface FieldDefinition extends QtnAstNode {
  kind: 'field';
  name: string;
  typeRef: TypeReference;
  attributes: Attribute[];
}

// Enum member: A = 0
export interface EnumMemberDefinition extends QtnAstNode {
  kind: 'enumMember';
  name: string;
  value?: number;
}

// Type definition: component, struct, enum, flags, union, asset
export type TypeKind = 'component' | 'struct' | 'enum' | 'flags' | 'union' | 'asset';

export interface TypeDefinition extends QtnAstNode {
  kind: TypeKind;
  name: string;
  modifiers: string[];  // singleton, abstract
  fields: FieldDefinition[];
  enumMembers: EnumMemberDefinition[];  // for enum/flags
  baseType?: string;  // enum underlying type: Byte, Int32, etc.
}

// Event definition
export interface EventDefinition extends QtnAstNode {
  kind: 'event';
  name: string;
  modifiers: string[];  // synced, abstract, client, server
  parentName?: string;  // inheritance: event Foo : Bar
  fields: FieldDefinition[];
}

// Signal parameter
export interface ParameterDefinition extends QtnAstNode {
  kind: 'parameter';
  name: string;
  typeRef: TypeReference;
}

// Signal definition
export interface SignalDefinition extends QtnAstNode {
  kind: 'signal';
  name: string;
  parameters: ParameterDefinition[];
}

// Input block (one per project)
export interface InputDefinition extends QtnAstNode {
  kind: 'input';
  fields: FieldDefinition[];
}

// Global block
export interface GlobalDefinition extends QtnAstNode {
  kind: 'global';
  fields: FieldDefinition[];
}

// Import/using
export type ImportKind = 'type' | 'struct' | 'enum' | 'component' | 'singleton' | 'using';

export interface ImportDefinition extends QtnAstNode {
  kind: 'import' | 'using';
  importKind: ImportKind;
  name: string;
  size?: number;         // struct import size
  underlyingType?: string; // enum import underlying type
}

// Pragma: #pragma key value
export interface PragmaDefinition extends QtnAstNode {
  kind: 'pragma';
  key: string;
  value: string;
}

// Define: #define NAME value
export interface DefineDefinition extends QtnAstNode {
  kind: 'define';
  name: string;
  value: number;
}

// Union of all top-level definition types
export type Definition =
  | TypeDefinition
  | EventDefinition
  | SignalDefinition
  | InputDefinition
  | GlobalDefinition
  | ImportDefinition
  | PragmaDefinition
  | DefineDefinition;

// Parse error (internal, no diagnostics published)
export interface ParseError {
  message: string;
  range: SourceRange;
}

// Single .qtn file parse result
export interface QtnDocument {
  uri: string;
  version: number;
  definitions: Definition[];
  parseErrors: ParseError[];
}

// Helper: create an empty SourceRange
export function emptyRange(): SourceRange {
  return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
}

// Helper: create a SourceRange from line/char values
export function makeRange(startLine: number, startChar: number, endLine: number, endChar: number): SourceRange {
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  };
}
