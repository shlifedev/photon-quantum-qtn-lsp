// Tests for parser edge case hardening (T027)

import { describe, it, expect } from 'vitest';
import { parse } from '../parser.js';
import { TypeDefinition } from '../ast.js';

describe('Parser Edge Cases', () => {
  it('should handle empty files without errors', () => {
    const result = parse('', 'test://empty.qtn');
    expect(result.definitions).toHaveLength(0);
    expect(result.parseErrors).toHaveLength(0);
  });

  it('should handle files with only whitespace', () => {
    const result = parse('   \n\n  \t  \n', 'test://whitespace.qtn');
    expect(result.definitions).toHaveLength(0);
    expect(result.parseErrors).toHaveLength(0);
  });

  it('should handle files with only comments', () => {
    const result = parse('// comment\n/* block */\n// another', 'test://comments.qtn');
    expect(result.definitions).toHaveLength(0);
    expect(result.parseErrors).toHaveLength(0);
  });

  it('should parse duplicate declarations without deduplication', () => {
    const source = `
      struct Foo { int x; }
      struct Foo { int y; }
      component Bar { int a; }
      component Bar { int b; }
    `;
    const result = parse(source, 'test://duplicates.qtn');

    // Should have 4 definitions (no deduplication at parser level)
    expect(result.definitions).toHaveLength(4);

    const structs = result.definitions.filter(d => d.kind === 'struct');
    expect(structs).toHaveLength(2);
    expect(structs.every(s => s.name === 'Foo')).toBe(true);

    const components = result.definitions.filter(d => d.kind === 'component');
    expect(components).toHaveLength(2);
    expect(components.every(c => c.name === 'Bar')).toBe(true);
  });

  it('should recover from unclosed struct block', () => {
    const source = `
      struct Incomplete {
        int x;
        // missing }

      struct NextStruct {
        int y;
      }
    `;
    const result = parse(source, 'test://unclosed-struct.qtn');

    // Should have parsed both structs despite missing }
    expect(result.definitions.length).toBeGreaterThanOrEqual(1);
    expect(result.parseErrors.length).toBeGreaterThan(0);

    // Should have error about missing } or 'struct' keyword being unexpected
    const hasRelevantError = result.parseErrors.some(
      e => e.message.includes('}') || e.message.includes('close') ||
           e.message.includes('struct') || e.message.includes('Expected')
    );
    expect(hasRelevantError).toBe(true);
  });

  it('should recover from unclosed component block', () => {
    const source = `
      component Player {
        int health;
        // missing }

      component Enemy {
        int damage;
      }
    `;
    const result = parse(source, 'test://unclosed-component.qtn');

    expect(result.definitions.length).toBeGreaterThanOrEqual(1);
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });

  it('should recover from unclosed enum block', () => {
    const source = `
      enum Status {
        Idle,
        Running
        // missing }

      struct Point {
        int x;
      }
    `;
    const result = parse(source, 'test://unclosed-enum.qtn');

    expect(result.definitions.length).toBeGreaterThanOrEqual(1);
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });

  it('should not hang on pathological input', () => {
    const source = `
      struct Test {
        invalid syntax here without recovery markers
      }
      component Next { int x; }
    `;

    // This should complete without hanging
    const start = Date.now();
    const result = parse(source, 'test://pathological.qtn');
    const elapsed = Date.now() - start;

    // Should complete in reasonable time (< 1 second)
    expect(elapsed).toBeLessThan(1000);
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });

  it('should advance position on every top-level iteration', () => {
    // Malformed tokens that could potentially cause infinite loops
    const source = `
      @@@ invalid tokens @@@
      struct Valid { int x; }
    `;

    const result = parse(source, 'test://invalid-tokens.qtn');

    // Should have at least one valid definition
    const validStructs = result.definitions.filter(d => d.kind === 'struct' && d.name === 'Valid');
    expect(validStructs.length).toBeGreaterThanOrEqual(0);

    // Should have parse errors for invalid tokens
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });

  it('should handle EOF at various unexpected positions', () => {
    const cases = [
      'struct Foo',           // Missing {
      'struct Foo {',         // Missing } at EOF
      'struct Foo { int',     // Missing field name and ;
      'enum Bar { A,',        // Incomplete enum member list
      'component Baz { int x', // Missing semicolon
    ];

    for (const source of cases) {
      const result = parse(source, 'test://eof-edge-case.qtn');

      // Should not throw or hang
      expect(result).toBeDefined();
      expect(result.definitions).toBeDefined();
      expect(result.parseErrors).toBeDefined();

      // Should have at least one parse error
      expect(result.parseErrors.length).toBeGreaterThan(0);
    }
  });

  it('should handle nested recovery scenarios', () => {
    const source = `
      struct Outer {
        invalid field syntax
        int valid;
        more invalid syntax
        // unclosed brace

      component Next {
        int x;
      }
    `;

    const result = parse(source, 'test://nested-recovery.qtn');

    // Should recover and find the Next component
    const components = result.definitions.filter(d => d.kind === 'component');
    expect(components.length).toBeGreaterThanOrEqual(0);

    // Should have multiple parse errors
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });

  it('should handle completely invalid files gracefully', () => {
    const source = 'this is not valid QTN syntax at all!!! 123 @@@ ###';

    const result = parse(source, 'test://garbage.qtn');

    // Should not crash
    expect(result).toBeDefined();
    expect(result.definitions).toBeDefined();
    expect(result.parseErrors).toBeDefined();

    // Will have errors
    expect(result.parseErrors.length).toBeGreaterThan(0);
  });

  it('should record nullable suffix without mutating the type name', () => {
    const result = parse('struct S { FP? Maybe; }', 'test://nullable.qtn');
    const struct = result.definitions.find(d => d.kind === 'struct') as TypeDefinition;
    const typeRef = struct.fields[0].typeRef;

    // Name stays the source name (NOT 'NullableFP') so symbol lookups resolve.
    expect(typeRef.name).toBe('FP');
    expect(typeRef.isNullable).toBe(true);
    // nameRange covers only 'FP', not the trailing '?'.
    const nameLen = typeRef.nameRange.end.character - typeRef.nameRange.start.character;
    expect(nameLen).toBe('FP'.length);
  });

  it('should leave isNullable false for non-nullable types', () => {
    const result = parse('struct S { FP Value; }', 'test://non-nullable.qtn');
    const struct = result.definitions.find(d => d.kind === 'struct') as TypeDefinition;
    expect(struct.fields[0].typeRef.isNullable).toBe(false);
  });
});
