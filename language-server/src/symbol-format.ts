import { SignalDefinition, TypeDefinition, EventDefinition, TypeArgument, TypeReference } from './ast.js';

function formatTypeArgument(arg: TypeArgument): string {
  if (!('name' in arg)) {
    return arg.raw;
  }

  return formatTypeReference(arg);
}

export function formatTypeReference(typeRef: TypeReference): string {
  let result = typeRef.name;

  if (typeRef.genericArgs.length > 0) {
    const args = typeRef.genericArgs.map((arg) => formatTypeArgument(arg)).join(', ');
    result += `<${args}>`;
  }

  if (typeRef.arraySize !== undefined) {
    result += `[${typeRef.arraySize}]`;
  }

  if (typeRef.isPointer) {
    result += '*';
  }

  return result;
}

export function buildTypeDefinitionDetail(def: TypeDefinition): string {
  let detail: string = def.kind;
  if (def.modifiers.length > 0) {
    detail = `${def.modifiers.join(' ')} ${detail}`;
  }
  if (def.baseType) {
    detail += ` : ${def.baseType}`;
  }
  return detail;
}

export function buildEventDetail(def: EventDefinition): string {
  let detail = 'event';
  if (def.modifiers.length > 0) {
    detail = `${def.modifiers.join(' ')} ${detail}`;
  }
  if (def.parentName) {
    detail += ` : ${def.parentName}`;
  }
  return detail;
}

export function buildSignalDetail(def: SignalDefinition): string {
  const paramTypes = def.parameters
    .map((p) => formatTypeReference(p.typeRef))
    .join(', ');

  return `signal(${paramTypes})`;
}
