// Built-in types, keywords, and hover data for QTN Language Server

export interface LocalizedDescriptions {
  en: string;
  ko: string;
}

export type SupportedLocale = 'en' | 'ko';

export interface BuiltinTypeInfo {
  name: string;
  category: 'primitive' | 'quantum' | 'collection' | 'special';
  csharpType?: string;
  size?: number;  // bytes
  descriptions: LocalizedDescriptions;
}

export interface KeywordInfo {
  name: string;
  category: 'declaration' | 'modifier' | 'control' | 'directive';
  descriptions: LocalizedDescriptions;
}

export interface AttributeInfo {
  name: string;
  params?: string[];
  descriptions: LocalizedDescriptions;
}

/**
 * Get a localized description from an object with descriptions.
 * Falls back to English if the requested locale is not available.
 */
export function getDescription(
  info: { descriptions: LocalizedDescriptions },
  locale: SupportedLocale
): string {
  return info.descriptions[locale] ?? info.descriptions.en;
}

// Primitive types (18) — C# numeric types and aliases
export const PRIMITIVE_TYPES: BuiltinTypeInfo[] = [
  { name: 'bool', category: 'primitive', csharpType: 'System.Boolean', size: 1, descriptions: { en: 'Boolean type (true/false)', ko: '부울 타입 (참/거짓)' } },
  { name: 'Boolean', category: 'primitive', csharpType: 'System.Boolean', size: 1, descriptions: { en: 'Boolean type (C# alias for bool)', ko: '부울 타입 (bool의 C# 별칭)' } },
  { name: 'byte', category: 'primitive', csharpType: 'System.Byte', size: 1, descriptions: { en: 'Unsigned 8-bit integer (0 to 255)', ko: '부호 없는 8비트 정수 (0~255)' } },
  { name: 'Byte', category: 'primitive', csharpType: 'System.Byte', size: 1, descriptions: { en: 'Unsigned 8-bit integer (C# alias)', ko: '부호 없는 8비트 정수 (C# 별칭)' } },
  { name: 'sbyte', category: 'primitive', csharpType: 'System.SByte', size: 1, descriptions: { en: 'Signed 8-bit integer (-128 to 127)', ko: '부호 있는 8비트 정수 (-128~127)' } },
  { name: 'SByte', category: 'primitive', csharpType: 'System.SByte', size: 1, descriptions: { en: 'Signed 8-bit integer (C# alias)', ko: '부호 있는 8비트 정수 (C# 별칭)' } },
  { name: 'short', category: 'primitive', csharpType: 'System.Int16', size: 2, descriptions: { en: 'Signed 16-bit integer', ko: '부호 있는 16비트 정수' } },
  { name: 'Int16', category: 'primitive', csharpType: 'System.Int16', size: 2, descriptions: { en: 'Signed 16-bit integer (C# alias)', ko: '부호 있는 16비트 정수 (C# 별칭)' } },
  { name: 'ushort', category: 'primitive', csharpType: 'System.UInt16', size: 2, descriptions: { en: 'Unsigned 16-bit integer', ko: '부호 없는 16비트 정수' } },
  { name: 'UInt16', category: 'primitive', csharpType: 'System.UInt16', size: 2, descriptions: { en: 'Unsigned 16-bit integer (C# alias)', ko: '부호 없는 16비트 정수 (C# 별칭)' } },
  { name: 'int', category: 'primitive', csharpType: 'System.Int32', size: 4, descriptions: { en: 'Signed 32-bit integer', ko: '부호 있는 32비트 정수' } },
  { name: 'Int32', category: 'primitive', csharpType: 'System.Int32', size: 4, descriptions: { en: 'Signed 32-bit integer (C# alias)', ko: '부호 있는 32비트 정수 (C# 별칭)' } },
  { name: 'uint', category: 'primitive', csharpType: 'System.UInt32', size: 4, descriptions: { en: 'Unsigned 32-bit integer', ko: '부호 없는 32비트 정수' } },
  { name: 'UInt32', category: 'primitive', csharpType: 'System.UInt32', size: 4, descriptions: { en: 'Unsigned 32-bit integer (C# alias)', ko: '부호 없는 32비트 정수 (C# 별칭)' } },
  { name: 'long', category: 'primitive', csharpType: 'System.Int64', size: 8, descriptions: { en: 'Signed 64-bit integer', ko: '부호 있는 64비트 정수' } },
  { name: 'Int64', category: 'primitive', csharpType: 'System.Int64', size: 8, descriptions: { en: 'Signed 64-bit integer (C# alias)', ko: '부호 있는 64비트 정수 (C# 별칭)' } },
  { name: 'ulong', category: 'primitive', csharpType: 'System.UInt64', size: 8, descriptions: { en: 'Unsigned 64-bit integer', ko: '부호 없는 64비트 정수' } },
  { name: 'UInt64', category: 'primitive', csharpType: 'System.UInt64', size: 8, descriptions: { en: 'Unsigned 64-bit integer (C# alias)', ko: '부호 없는 64비트 정수 (C# 별칭)' } },
];

// Quantum built-in types (24+) — from BuiltIns.cs
export const QUANTUM_TYPES: BuiltinTypeInfo[] = [
  { name: 'FP', category: 'quantum', csharpType: 'Photon.Deterministic.FP', descriptions: { en: 'Quantum fixed-point number (deterministic floating point)', ko: 'Quantum 고정소수점 수 (결정론적 부동소수점)' } },
  { name: 'FPVector2', category: 'quantum', csharpType: 'Photon.Deterministic.FPVector2', descriptions: { en: 'Quantum fixed-point 2D vector', ko: 'Quantum 고정소수점 2D 벡터' } },
  { name: 'FPVector3', category: 'quantum', csharpType: 'Photon.Deterministic.FPVector3', descriptions: { en: 'Quantum fixed-point 3D vector', ko: 'Quantum 고정소수점 3D 벡터' } },
  { name: 'FPQuaternion', category: 'quantum', csharpType: 'Photon.Deterministic.FPQuaternion', descriptions: { en: 'Quantum fixed-point quaternion (rotation)', ko: 'Quantum 고정소수점 쿼터니언 (회전)' } },
  { name: 'FPMatrix', category: 'quantum', csharpType: 'Photon.Deterministic.FPMatrix2x2', descriptions: { en: 'Quantum fixed-point matrix', ko: 'Quantum 고정소수점 행렬' } },
  { name: 'FPBounds2', category: 'quantum', csharpType: 'Photon.Deterministic.FPBounds2', descriptions: { en: 'Quantum fixed-point 2D bounding box', ko: 'Quantum 고정소수점 2D 바운딩 박스' } },
  { name: 'FPBounds3', category: 'quantum', csharpType: 'Photon.Deterministic.FPBounds3', descriptions: { en: 'Quantum fixed-point 3D bounding box', ko: 'Quantum 고정소수점 3D 바운딩 박스' } },
  { name: 'EntityRef', category: 'quantum', csharpType: 'Quantum.EntityRef', descriptions: { en: 'Reference to an ECS entity', ko: 'ECS 엔티티에 대한 참조' } },
  { name: 'PlayerRef', category: 'quantum', csharpType: 'Quantum.PlayerRef', descriptions: { en: 'Reference to a player (0-based index)', ko: '플레이어에 대한 참조 (0부터 시작하는 인덱스)' } },
  { name: 'AssetRef', category: 'quantum', csharpType: 'Quantum.AssetRef', descriptions: { en: 'Reference to a Quantum asset (GUID-based)', ko: 'Quantum 에셋에 대한 참조 (GUID 기반)' } },
  { name: 'QString', category: 'quantum', csharpType: 'Quantum.QString', descriptions: { en: 'Quantum deterministic string (UTF-16)', ko: 'Quantum 결정론적 문자열 (UTF-16)' } },
  { name: 'QStringUtf8', category: 'quantum', csharpType: 'Quantum.QStringUtf8', descriptions: { en: 'Quantum deterministic string (UTF-8)', ko: 'Quantum 결정론적 문자열 (UTF-8)' } },
  { name: 'LayerMask', category: 'quantum', csharpType: 'Quantum.LayerMask', descriptions: { en: 'Physics layer bitmask', ko: '물리 레이어 비트마스크' } },
  { name: 'NullableFP', category: 'quantum', csharpType: 'Quantum.NullableFP', descriptions: { en: 'Nullable fixed-point number', ko: 'Null 허용 고정소수점 수' } },
  { name: 'NullableFPVector2', category: 'quantum', csharpType: 'Quantum.NullableFPVector2', descriptions: { en: 'Nullable fixed-point 2D vector', ko: 'Null 허용 고정소수점 2D 벡터' } },
  { name: 'NullableFPVector3', category: 'quantum', csharpType: 'Quantum.NullableFPVector3', descriptions: { en: 'Nullable fixed-point 3D vector', ko: 'Null 허용 고정소수점 3D 벡터' } },
  { name: 'Hit', category: 'quantum', csharpType: 'Quantum.Physics2D.Hit', descriptions: { en: 'Physics 2D raycast hit result', ko: '2D 물리 레이캐스트 충돌 결과' } },
  { name: 'Hit3D', category: 'quantum', csharpType: 'Quantum.Physics3D.Hit3D', descriptions: { en: 'Physics 3D raycast hit result', ko: '3D 물리 레이캐스트 충돌 결과' } },
  { name: 'Shape2D', category: 'quantum', csharpType: 'Quantum.Physics2D.Shape2D', descriptions: { en: 'Physics 2D collision shape', ko: '2D 물리 충돌 형상' } },
  { name: 'Shape3D', category: 'quantum', csharpType: 'Quantum.Physics3D.Shape3D', descriptions: { en: 'Physics 3D collision shape', ko: '3D 물리 충돌 형상' } },
  { name: 'Joint', category: 'quantum', csharpType: 'Quantum.Physics2D.Joint', descriptions: { en: 'Physics 2D joint', ko: '2D 물리 조인트' } },
  { name: 'DistanceJoint', category: 'quantum', csharpType: 'Quantum.Physics2D.DistanceJoint', descriptions: { en: 'Physics 2D distance joint', ko: '2D 물리 거리 조인트' } },
  { name: 'SpringJoint', category: 'quantum', csharpType: 'Quantum.Physics2D.SpringJoint', descriptions: { en: 'Physics 2D spring joint', ko: '2D 물리 스프링 조인트' } },
  { name: 'HingeJoint', category: 'quantum', csharpType: 'Quantum.Physics2D.HingeJoint', descriptions: { en: 'Physics 2D hinge joint', ko: '2D 물리 힌지 조인트' } },
];

// Collection types (9) — generic/parameterized types
export const COLLECTION_TYPES: BuiltinTypeInfo[] = [
  { name: 'list', category: 'collection', csharpType: 'Quantum.QList<T>', descriptions: { en: 'Dynamic-length list (Quantum managed)', ko: '가변 길이 리스트 (Quantum 관리)' } },
  { name: 'array', category: 'collection', csharpType: 'Quantum.QArray<T>', descriptions: { en: 'Fixed-length array: array<T>[N]', ko: '고정 길이 배열: array<T>[N]' } },
  { name: 'dictionary', category: 'collection', csharpType: 'Quantum.QDictionary<K,V>', descriptions: { en: 'Key-value dictionary (Quantum managed)', ko: '키-값 딕셔너리 (Quantum 관리)' } },
  { name: 'hash_set', category: 'collection', csharpType: 'Quantum.QHashSet<T>', descriptions: { en: 'Hash set collection (Quantum managed)', ko: '해시 셋 컬렉션 (Quantum 관리)' } },
  { name: 'set', category: 'collection', csharpType: 'Quantum.QHashSet<T>', descriptions: { en: 'Alias for hash_set', ko: 'hash_set의 별칭' } },
  { name: 'bitset', category: 'collection', csharpType: 'Quantum.BitSet', descriptions: { en: 'Fixed-size bit array: bitset[N]', ko: '고정 크기 비트 배열: bitset[N]' } },
  { name: 'entity_ref', category: 'collection', csharpType: 'Quantum.EntityRef', descriptions: { en: 'Entity reference (collection context)', ko: '엔티티 참조 (컬렉션 컨텍스트)' } },
  { name: 'player_ref', category: 'collection', csharpType: 'Quantum.PlayerRef', descriptions: { en: 'Player reference (collection context)', ko: '플레이어 참조 (컬렉션 컨텍스트)' } },
  { name: 'asset_ref', category: 'collection', csharpType: 'Quantum.AssetRef', descriptions: { en: 'Asset reference (collection context)', ko: '에셋 참조 (컬렉션 컨텍스트)' } },
];

// Special types
export const SPECIAL_TYPES: BuiltinTypeInfo[] = [
  { name: 'button', category: 'special', csharpType: 'Quantum.Input.Button', descriptions: { en: 'Input button type (input block only)', ko: '입력 버튼 타입 (input 블록 전용)' } },
];

// All built-in types combined
export const ALL_BUILTIN_TYPES: BuiltinTypeInfo[] = [
  ...PRIMITIVE_TYPES,
  ...QUANTUM_TYPES,
  ...COLLECTION_TYPES,
  ...SPECIAL_TYPES,
];

// Quick lookup map: type name -> info
export const BUILTIN_TYPE_MAP: Map<string, BuiltinTypeInfo> = new Map(
  ALL_BUILTIN_TYPES.map(t => [t.name, t])
);

// Declaration keywords
export const DECLARATION_KEYWORDS: KeywordInfo[] = [
  { name: 'component', category: 'declaration', descriptions: { en: 'Declares a Quantum ECS component (attached to entities)', ko: 'Quantum ECS 컴포넌트 선언 (엔티티에 부착)' } },
  { name: 'struct', category: 'declaration', descriptions: { en: 'Declares a Quantum struct (value type, no entity attachment)', ko: 'Quantum 구조체 선언 (값 타입, 엔티티 미부착)' } },
  { name: 'input', category: 'declaration', descriptions: { en: 'Declares the input block (player input definition, one per project)', ko: '입력 블록 선언 (플레이어 입력 정의, 프로젝트당 하나)' } },
  { name: 'event', category: 'declaration', descriptions: { en: 'Declares a Quantum event (one-shot message from simulation to view)', ko: 'Quantum 이벤트 선언 (시뮬레이션에서 뷰로 보내는 일회성 메시지)' } },
  { name: 'signal', category: 'declaration', descriptions: { en: 'Declares a Quantum signal (simulation-internal callback)', ko: 'Quantum 시그널 선언 (시뮬레이션 내부 콜백)' } },
  { name: 'global', category: 'declaration', descriptions: { en: 'Declares the globals block (project-wide shared state)', ko: '전역 블록 선언 (프로젝트 전체 공유 상태)' } },
  { name: 'enum', category: 'declaration', descriptions: { en: 'Declares an enumeration type', ko: '열거형 타입 선언' } },
  { name: 'flags', category: 'declaration', descriptions: { en: 'Declares a flags enumeration (bitmask)', ko: '플래그 열거형 선언 (비트마스크)' } },
  { name: 'union', category: 'declaration', descriptions: { en: 'Declares a discriminated union (one-of-many struct)', ko: '판별 공용체 선언 (여러 구조체 중 하나)' } },
  { name: 'asset', category: 'declaration', descriptions: { en: 'Declares a Quantum asset type', ko: 'Quantum 에셋 타입 선언' } },
];

// Modifier keywords
export const MODIFIER_KEYWORDS: KeywordInfo[] = [
  { name: 'singleton', category: 'modifier', descriptions: { en: 'Makes a component singleton (one instance per frame)', ko: '컴포넌트를 싱글톤으로 지정 (프레임당 하나의 인스턴스)' } },
  { name: 'abstract', category: 'modifier', descriptions: { en: 'Makes an event abstract (must be inherited)', ko: '이벤트를 추상으로 지정 (상속 필수)' } },
];

// Control keywords
export const CONTROL_KEYWORDS: KeywordInfo[] = [
  { name: 'import', category: 'control', descriptions: { en: 'Imports an external type definition', ko: '외부 타입 정의를 임포트' } },
  { name: 'using', category: 'control', descriptions: { en: 'Imports a namespace', ko: '네임스페이스를 임포트' } },
  { name: 'synced', category: 'control', descriptions: { en: 'Event modifier: synced across network', ko: '이벤트 수식어: 네트워크 동기화' } },
  { name: 'local', category: 'control', descriptions: { en: 'Event modifier: local-only (not synced)', ko: '이벤트 수식어: 로컬 전용 (동기화 안 됨)' } },
  { name: 'remote', category: 'control', descriptions: { en: 'Event modifier: remote-only', ko: '이벤트 수식어: 리모트 전용' } },
  { name: 'nothashed', category: 'control', descriptions: { en: 'Field modifier: excluded from state hash', ko: '필드 수식어: 상태 해시에서 제외' } },
  { name: 'client', category: 'control', descriptions: { en: 'Event modifier: client-side only', ko: '이벤트 수식어: 클라이언트 전용' } },
  { name: 'server', category: 'control', descriptions: { en: 'Event modifier: server-side only', ko: '이벤트 수식어: 서버 전용' } },
];

// Directive keywords
export const DIRECTIVE_KEYWORDS: KeywordInfo[] = [
  { name: '#pragma', category: 'directive', descriptions: { en: 'Preprocessor pragma directive (e.g., #pragma max_players 16)', ko: '전처리기 pragma 지시문 (예: #pragma max_players 16)' } },
  { name: '#define', category: 'directive', descriptions: { en: 'Preprocessor constant definition (e.g., #define MY_CONST 42)', ko: '전처리기 상수 정의 (예: #define MY_CONST 42)' } },
];

// All keywords combined
export const ALL_KEYWORDS: KeywordInfo[] = [
  ...DECLARATION_KEYWORDS,
  ...MODIFIER_KEYWORDS,
  ...CONTROL_KEYWORDS,
  ...DIRECTIVE_KEYWORDS,
];

// Quick lookup map: keyword name -> info
export const KEYWORD_MAP: Map<string, KeywordInfo> = new Map(
  ALL_KEYWORDS.map(k => [k.name, k])
);

// Known attributes for autocomplete and hover
export const ATTRIBUTES: AttributeInfo[] = [
  { name: 'Header', params: ['text'], descriptions: { en: 'Displays a header label in the Unity inspector', ko: 'Unity 인스펙터에 헤더 레이블을 표시' } },
  { name: 'Tooltip', params: ['text'], descriptions: { en: 'Shows a tooltip when hovering in the Unity inspector', ko: 'Unity 인스펙터에서 마우스를 올리면 툴팁을 표시' } },
  { name: 'DrawIf', params: ['field', 'value', 'comparison', 'mode'], descriptions: { en: 'Conditionally shows/hides field in inspector', ko: '인스펙터에서 조건부로 필드를 표시/숨김' } },
  { name: 'Range', params: ['min', 'max'], descriptions: { en: 'Clamps value to a range with slider in inspector', ko: '인스펙터에서 슬라이더로 값의 범위를 제한' } },
  { name: 'RangeEx', params: ['min', 'max'], descriptions: { en: 'Extended range constraint with slider', ko: '슬라이더를 포함한 확장 범위 제약' } },
  { name: 'HideInInspector', descriptions: { en: 'Hides field from Unity inspector', ko: 'Unity 인스펙터에서 필드를 숨김' } },
  { name: 'AllocateOnComponentAdded', descriptions: { en: 'Auto-allocates collection when component is added to entity', ko: '컴포넌트가 엔티티에 추가될 때 컬렉션을 자동 할당' } },
  { name: 'FreeOnComponentRemoved', descriptions: { en: 'Auto-frees collection when component is removed from entity', ko: '컴포넌트가 엔티티에서 제거될 때 컬렉션을 자동 해제' } },
  { name: 'ExcludeFromPrototype', descriptions: { en: 'Excludes field from entity prototype serialization', ko: '엔티티 프로토타입 직렬화에서 필드를 제외' } },
  { name: 'OnlyInPrototype', descriptions: { en: 'Field exists only in prototype, not in runtime component', ko: '프로토타입에서만 존재하는 필드 (런타임 컴포넌트에는 없음)' } },
  { name: 'PreserveInPrototype', descriptions: { en: 'Preserves field value when prototype is applied', ko: '프로토타입이 적용될 때 필드 값을 보존' } },
  { name: 'Optional', descriptions: { en: 'Marks field as optional in prototype', ko: '프로토타입에서 필드를 선택 사항으로 표시' } },
  { name: 'Space', descriptions: { en: 'Adds visual spacing in Unity inspector', ko: 'Unity 인스펙터에 시각적 여백을 추가' } },
  { name: 'Layer', descriptions: { en: 'Shows Unity layer dropdown for integer field', ko: '정수 필드에 Unity 레이어 드롭다운을 표시' } },
];

// Quick lookup map: attribute name -> info
export const ATTRIBUTE_MAP: Map<string, AttributeInfo> = new Map(
  ATTRIBUTES.map(a => [a.name, a])
);

// Integer types valid as enum base types
export const ENUM_BASE_TYPES: string[] = [
  'Byte', 'SByte', 'Int16', 'UInt16', 'Int32', 'UInt32', 'Int64', 'UInt64',
];

// Top-level keywords for autocomplete at file root
// Includes event modifiers (synced, local, remote, client, server) that precede declarations
export const TOP_LEVEL_KEYWORDS: string[] = [
  'component', 'struct', 'enum', 'flags', 'union', 'event', 'signal',
  'input', 'global', 'asset', 'import', 'using', 'singleton', 'abstract',
  'synced', 'local', 'remote', 'client', 'server',
  '#pragma', '#define',
];

// Field modifier keywords — valid before a type in field declarations
export const FIELD_MODIFIER_KEYWORDS: string[] = [
  'synced', 'local', 'remote', 'nothashed', 'client', 'server',
];

// Import sub-keywords
export const IMPORT_SUB_KEYWORDS: string[] = ['struct', 'enum', 'component', 'singleton'];
