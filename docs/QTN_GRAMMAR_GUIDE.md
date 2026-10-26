# QTN 문법 편집 참고

공유 TextMate 문법을 수정할 때 사용하는 스코프 규칙과 예제다. 전체 문법 설명은 [DSL.md](DSL.md)를 참고한다.

## TextMate 스코프 매핑

문법 작성 시 아래 스코프 매핑을 반드시 따른다. 전체 DSL 레퍼런스는 `docs/DSL.md` 참고.

### 키워드

| 분류 | 스코프 | 키워드 |
|------|--------|--------|
| 선언 | `keyword.declaration.qtn` | `component` `struct` `input` `event` `signal` `global` `enum` `flags` `union` `asset` |
| 수식어 | `storage.modifier.qtn` | `singleton` `abstract` |
| 제어 | `keyword.control.qtn` | `import` `using` `synced` `local` `remote` `nothashed` `client` `server` |
| 전처리기 | `keyword.control.directive.qtn` | `#pragma` `#define` |

### 타입

| 분류 | 스코프 | 타입 |
|------|--------|------|
| 기본 타입 | `support.type.qtn` | `bool` `Boolean` `byte` `Byte` `sbyte` `SByte` `short` `Int16` `ushort` `UInt16` `int` `Int32` `uint` `UInt32` `long` `Int64` `ulong` `UInt64` |
| Quantum 내장 | `support.type.qtn` | `FP` `FPVector2` `FPVector3` `FPQuaternion` `FPMatrix` `FPBounds2` `FPBounds3` `EntityRef` `PlayerRef` `AssetRef` `QString` `QStringUtf8` `LayerMask` `NullableFP` `NullableFPVector2` `NullableFPVector3` `Hit` `Hit3D` `Shape2D` `Shape3D` `Joint` `DistanceJoint` `SpringJoint` `HingeJoint` |
| 제네릭/컬렉션 | `support.type.generic.qtn` | `list` `array` `dictionary` `hash_set` `set` `bitset` `entity_ref` `player_ref` `asset_ref` |
| 특수 타입 | `support.type.qtn` | `button` (input 블록 전용) |

### 리터럴 & 주석

| 패턴 | 스코프 |
|------|--------|
| `// ...` | `comment.line.double-slash.qtn` |
| `/* ... */` | `comment.block.qtn` |
| `0xFF` | `constant.numeric.hex.qtn` |
| `3.14` | `constant.numeric.float.qtn` |
| `42` | `constant.numeric.integer.qtn` |
| `"text"` | `string.quoted.double.qtn` |

### 기타

| 패턴 | 스코프 |
|------|--------|
| `[Header("...")]` 등 어트리뷰트 | `meta.annotation.qtn` |
| 선언부 타입 이름 (`component **Player** {`) | `entity.name.type.qtn` |

## QTN 구문 요약

```qtn
// 타입 정의
struct MyStruct { FP Field; }
component MyComponent { Int32 Value; }
singleton component MySingleton { FP Foo; }
enum MyEnum { A, B, C }
enum MyEnum : Byte { A = 0, B = 1 }
flags MyFlags : Byte { None, FlagA, FlagB }
union MyUnion { StructA A; StructB B; }
asset MyAsset;

// 이벤트/시그널
event MyEvent { Int32 Data; }
synced event MySyncedEvent { FP Value; }
abstract event MyBaseEvent { Int32 Common; }
event MyDerivedEvent : MyBaseEvent { FP Extra; }
signal MySignal(FP damage, entity_ref target);

// 입력/전역
input { FPVector2 Move; button Jump; }
global { FP GameTimer; }

// 임포트
import struct Foo(12);
import enum MyEnum(byte);
import FooComponent;
import singleton FooComponent;
using MyNamespace;

// 전처리기
#pragma max_players 16
#define MY_CONST 42

// 컬렉션
list<T>, dictionary<K,V>, hash_set<T>, array<T>[N], bitset[N]

// 어트리뷰트
[Header("Combat Stats")]
[Tooltip("min = 0\nmax = 100")]
[AllocateOnComponentAdded, FreeOnComponentRemoved]
[DrawIf("UseShield", 1, Equal, Hide)]
```
