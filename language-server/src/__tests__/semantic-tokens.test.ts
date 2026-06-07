// Tests for Semantic Tokens Provider

import { describe, it, expect } from 'vitest';
import { ProjectModel } from '../project-model.js';
import { handleSemanticTokensFull, tokenTypes } from '../semantic-tokens.js';

// Helper: set up a ProjectModel with given QTN source and return semantic tokens
function getTokens(source: string, uri = 'test://test.qtn') {
  const pm = new ProjectModel();
  pm.updateDocument(uri, source);

  const result = handleSemanticTokensFull(
    { textDocument: { uri } },
    pm,
  );

  return result;
}

// Helper: decode delta-encoded semantic tokens data into absolute positions
function decodeTokens(data: number[]): Array<{
  line: number;
  char: number;
  length: number;
  tokenType: number;
  tokenModifiers: number;
}> {
  const tokens: Array<{
    line: number;
    char: number;
    length: number;
    tokenType: number;
    tokenModifiers: number;
  }> = [];

  let prevLine = 0;
  let prevChar = 0;

  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i];
    const deltaChar = data[i + 1];
    const length = data[i + 2];
    const tokenType = data[i + 3];
    const tokenModifiers = data[i + 4];

    if (deltaLine > 0) {
      prevLine += deltaLine;
      prevChar = deltaChar;
    } else {
      prevChar += deltaChar;
    }

    tokens.push({
      line: prevLine,
      char: prevChar,
      length,
      tokenType,
      tokenModifiers,
    });
  }

  return tokens;
}

describe('Semantic Tokens Provider', () => {
  it('should emit token for user-defined enum type reference', () => {
    const source = `
enum CharacterState { Idle, Moving }
component Player {
  CharacterState State;
}`;
    const result = getTokens(source);
    expect(result).not.toBeNull();

    const tokens = decodeTokens(result!.data);
    // Should have at least 1 token for CharacterState field type
    const enumTokens = tokens.filter(t => t.tokenType === tokenTypes.indexOf('enum'));
    expect(enumTokens.length).toBeGreaterThanOrEqual(1);
    // Verify it points to "CharacterState" (length = 14)
    expect(enumTokens.some(t => t.length === 'CharacterState'.length)).toBe(true);
  });

  it('should not emit token for builtin type reference', () => {
    const source = `
component Player {
  FP MoveSpeed;
}`;
    const result = getTokens(source);
    expect(result).not.toBeNull();

    const tokens = decodeTokens(result!.data);
    // FP is a builtin type → no semantic token (TextMate handles it)
    expect(tokens).toHaveLength(0);
  });

  it('should emit token for generic type argument', () => {
    const source = `
enum CharacterState { Idle, Moving }
component Player {
  list<CharacterState> States;
}`;
    const result = getTokens(source);
    expect(result).not.toBeNull();

    const tokens = decodeTokens(result!.data);
    // 'list' is builtin → no token; CharacterState is user-defined → token emitted
    expect(tokens.length).toBeGreaterThanOrEqual(1);

    // CharacterState should be tokenized
    const csTokens = tokens.filter(t => t.length === 'CharacterState'.length);
    expect(csTokens.length).toBeGreaterThanOrEqual(1);
  });

  it('should not emit tokens for signal builtin parameter types', () => {
    const source = `
signal OnDamage(FP damage, EntityRef target);
`;
    const result = getTokens(source);
    expect(result).not.toBeNull();

    const tokens = decodeTokens(result!.data);
    // FP and EntityRef are builtins → no semantic tokens (TextMate handles them)
    expect(tokens).toHaveLength(0);
  });

  it('should not emit token for unknown types', () => {
    const source = `
component Player {
  UnknownType Field;
}`;
    const result = getTokens(source);
    expect(result).not.toBeNull();

    const tokens = decodeTokens(result!.data);
    // UnknownType is not in symbol table → no token emitted
    const unknownTokens = tokens.filter(t => t.length === 'UnknownType'.length);
    expect(unknownTokens).toHaveLength(0);
  });

  it('should return empty tokens for unknown document URI', () => {
    const pm = new ProjectModel();
    const result = handleSemanticTokensFull(
      { textDocument: { uri: 'test://nonexistent.qtn' } },
      pm,
    );
    expect(result.data).toHaveLength(0);
  });

  it('should not emit tokens for struct builtin field types', () => {
    const source = `
struct Stats {
  FP Health;
  FPVector3 Position;
}`;
    const result = getTokens(source);
    expect(result).not.toBeNull();

    const tokens = decodeTokens(result!.data);
    // FP and FPVector3 are builtins → no semantic tokens
    expect(tokens).toHaveLength(0);
  });

  it('should not emit tokens for input block builtin field types', () => {
    const source = `
input {
  FPVector2 Move;
}`;
    const result = getTokens(source);
    expect(result).not.toBeNull();

    const tokens = decodeTokens(result!.data);
    // FPVector2 is builtin → no semantic token
    expect(tokens).toHaveLength(0);
  });

  it('should not emit tokens for global block builtin field types', () => {
    const source = `
global {
  FP GameTimer;
}`;
    const result = getTokens(source);
    expect(result).not.toBeNull();

    const tokens = decodeTokens(result!.data);
    // FP is builtin → no semantic token
    expect(tokens).toHaveLength(0);
  });

  it('should not emit tokens for event builtin field types', () => {
    const source = `
event MyEvent {
  FP Value;
  EntityRef Source;
}`;
    const result = getTokens(source);
    expect(result).not.toBeNull();

    const tokens = decodeTokens(result!.data);
    // FP and EntityRef are builtins → no semantic tokens
    expect(tokens).toHaveLength(0);
  });

  it('should emit a correctly-sized token for a nullable user-defined type', () => {
    const source = `
struct Health { }
component Player {
  Health? Maybe;
}`;
    const result = getTokens(source);
    expect(result).not.toBeNull();

    const tokens = decodeTokens(result!.data);
    // The nullable 'Health?' field type resolves to the user-defined struct and
    // the token must span exactly 'Health' (6 chars), not 'NullableHealth' (14).
    const structTokens = tokens.filter(t => t.tokenType === tokenTypes.indexOf('struct'));
    expect(structTokens.length).toBeGreaterThanOrEqual(1);
    expect(structTokens.every(t => t.length === 'Health'.length)).toBe(true);
  });

  it('should handle nameRange correctly for multiline token positions', () => {
    const source = `
struct StateA { }
struct StateB { }
component Player {
  StateA Health;
  StateB Position;
}`;
    const result = getTokens(source);
    expect(result).not.toBeNull();

    const tokens = decodeTokens(result!.data);
    // User-defined types StateA and StateB should be on different lines
    const lines = new Set(tokens.map(t => t.line));
    expect(lines.size).toBeGreaterThanOrEqual(2);
  });
});
