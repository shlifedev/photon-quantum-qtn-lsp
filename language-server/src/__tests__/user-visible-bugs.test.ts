import { describe, expect, it } from 'vitest';
import { SymbolKind } from 'vscode-languageserver';
import { parse } from '../parser.js';
import { ProjectModel } from '../project-model.js';
import { buildSignalDetail, formatTypeReference } from '../symbol-format.js';

describe('User-visible bug fixes', () => {
  it('parses numeric generic arguments used by QString and QStringUtf8', () => {
    const result = parse(`
component Strings {
  QString<64> Name;
  QStringUtf8<128> Description;
}`, 'test://strings.qtn');

    expect(result.parseErrors).toHaveLength(0);

    const component = result.definitions.find((def) => def.kind === 'component');
    if (component?.kind !== 'component') {
      throw new Error('Expected component definition');
    }

    expect(formatTypeReference(component.fields[0].typeRef)).toBe('QString<64>');
    expect(formatTypeReference(component.fields[1].typeRef)).toBe('QStringUtf8<128>');
  });

  it('preserves negative hexadecimal numeric values', () => {
    const result = parse(`
#define MIN_INT16 -0x8000
flags Example : Int32 {
  Negative = -0x7F
}`, 'test://negative-hex.qtn');

    expect(result.parseErrors).toHaveLength(0);

    const define = result.definitions.find((def) => def.kind === 'define');
    if (define?.kind !== 'define') {
      throw new Error('Expected define definition');
    }
    expect(define.value).toBe(-0x8000);

    const flags = result.definitions.find((def) => def.kind === 'flags');
    if (flags?.kind !== 'flags') {
      throw new Error('Expected flags definition');
    }
    expect(flags.enumMembers[0].value).toBe(-0x7F);
  });

  it('registers imported struct and enum declarations as external symbols', () => {
    const projectModel = new ProjectModel();
    projectModel.updateDocument('test://imports.qtn', `
import struct Foo(12);
import enum Bar(byte);
component UsesImports {
  Foo FooField;
  Bar BarField;
}`);

    const symbolTable = projectModel.getSymbolTable();
    const foo = symbolTable.lookup('Foo');
    const bar = symbolTable.lookup('Bar');

    expect(foo?.source).toBe('import');
    expect(foo?.kind).toBe(SymbolKind.Struct);
    expect(bar?.source).toBe('import');
    expect(bar?.kind).toBe(SymbolKind.Enum);
  });

  it('registers imported component declarations as external symbols', () => {
    const projectModel = new ProjectModel();
    projectModel.updateDocument('test://component-import.qtn', `
import component ExternalPlayer;
component UsesImport {
  ExternalPlayer Player;
}`);

    const symbol = projectModel.getSymbolTable().lookup('ExternalPlayer');
    expect(symbol?.source).toBe('import');
    expect(symbol?.kind).toBe(SymbolKind.Class);
    expect(symbol?.detail).toBe('import component');
  });

  it('parses component inheritance and abstract singleton components', () => {
    const result = parse(`
abstract component BaseComponent {
  Int32 BaseValue;
}

component DerivedComponent : BaseComponent {
  FP DerivedValue;
}

abstract singleton component AbstractSingleton {
  FP Time;
}`, 'test://components.qtn');

    expect(result.parseErrors).toHaveLength(0);

    const derived = result.definitions.find((def) => def.kind === 'component' && def.name === 'DerivedComponent');
    if (derived?.kind !== 'component') {
      throw new Error('Expected derived component definition');
    }
    expect(derived.baseType).toBe('BaseComponent');

    const singleton = result.definitions.find((def) => def.kind === 'component' && def.name === 'AbstractSingleton');
    if (singleton?.kind !== 'component') {
      throw new Error('Expected abstract singleton component definition');
    }
    expect(singleton.modifiers).toEqual(['abstract', 'singleton']);
  });

  it('formats pointer signal parameters using QTN suffix syntax once', () => {
    const result = parse(`
struct Resources {}
signal OnBeforeDamage(FP damage, Resources* resources);
`, 'test://pointer-signal.qtn');

    expect(result.parseErrors).toHaveLength(0);

    const signal = result.definitions.find((def) => def.kind === 'signal');
    if (signal?.kind !== 'signal') {
      throw new Error('Expected signal definition');
    }

    expect(formatTypeReference(signal.parameters[1].typeRef)).toBe('Resources*');
    expect(buildSignalDetail(signal)).toBe('signal(FP, Resources*)');
  });
});
