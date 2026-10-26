# Quantum DSL (Domain Specific Language) Specification

> Quantum ECS의 게임 상태를 정의하는 `.qtn` 파일 문법 레퍼런스.
> DSL 컴파일러는 `.qtn` 파일을 파싱하여 메모리 정렬, 직렬화, 디버깅 헬퍼가 포함된 C# partial struct를 생성한다.

> Quantum 3 공식 참고: [DSL (game state)](https://doc.photonengine.com/quantum/v3/manual/quantum-ecs/dsl). 이 문서는 문법 참고용이며, 언어 서버는 컴파일러의 모든 문법을 검증하거나 오류 진단을 발행하지 않습니다. SDK 버전별 유효성은 Quantum 컴파일러로 확인하세요.

---

## 목차

- [1. 기본 타입 (Built-in Types)](#1-기본-타입-built-in-types)
- [2. Component](#2-component)
- [3. Struct](#3-struct)
- [4. Enum / Flags](#4-enum--flags)
- [5. Union](#5-union)
- [6. Bitset](#6-bitset)
- [7. Input](#7-input)
- [8. Signal](#8-signal)
- [9. Event](#9-event)
- [10. Asset](#10-asset)
- [11. Global](#11-global)
- [12. 컬렉션 타입 (Dynamic Collections)](#12-컬렉션-타입-dynamic-collections)
- [13. Import / Using](#13-import--using)
- [14. 필드 어트리뷰트 (Attributes)](#14-필드-어트리뷰트-attributes)
- [15. 전처리기 지시문 (Pragma / Define)](#15-전처리기-지시문-pragma--define)
- [16. 핵심 규칙 요약](#16-핵심-규칙-요약)

---

## 1. 기본 타입 (Built-in Types)

import 없이 사용 가능한 타입.

| DSL 타입 | C# 대응 | 비고 |
|----------|---------|------|
| `Boolean` / `bool` | `QBoolean` | |
| `Byte` | `System.Byte` | |
| `SByte` | `System.SByte` | |
| `UInt16` / `Int16` | `System.UInt16` / `System.Int16` | |
| `UInt32` / `Int32` | `System.UInt32` / `System.Int32` | |
| `UInt64` / `Int64` | `System.UInt64` / `System.Int64` | |
| `FP` | `Photon.Deterministic.FP` | 고정소수점 |
| `FPVector2` | | |
| `FPVector3` | | |
| `FPMatrix` | | |
| `FPQuaternion` | | |
| `PlayerRef` / `player_ref` | 런타임 플레이어 인덱스 (`Int32` 캐스트 가능) | |
| `EntityRef` / `entity_ref` | 엔티티 참조 (index + version) | |
| `LayerMask` | | |
| `NullableFP` / `FP?` | | |
| `NullableFPVector2` / `FPVector2?` | | |
| `NullableFPVector3` / `FPVector3?` | | |
| `QString<N>` | UTF-16 문자열 | N = 총 바이트 (2바이트 오버헤드 포함) |
| `QStringUtf8<N>` | UTF-8 문자열 | |
| `Hit` / `Hit3D` | 물리 히트 결과 | |
| `Shape2D` / `Shape3D` | 물리 셰이프 | |
| `Joint` / `DistanceJoint` / `SpringJoint` / `HingeJoint` | 물리 조인트 | |

**특수 참조/컬렉션 타입:**

| 타입 | 용도 |
|------|------|
| `asset_ref<AssetType>` | 에셋 데이터베이스 참조 (롤백 안전) |
| `list<T>` | 동적 리스트 (`QListPtr<T>`) |
| `dictionary<K, V>` | 동적 딕셔너리 (`QDictionaryPtr<K,V>`) |
| `hash_set<T>` | 동적 해시셋 (`QHashSetPtr<T>`) |
| `array<Type>[size]` | 고정 크기 배열 (포인터 기반) |
| `bitset[size]` | 고정 크기 비트 블록 |

---

## 2. Component

엔티티에 부착 가능한 데이터 구조. 마커 인터페이스와 ID 프로퍼티가 자동 생성된다.

### 기본 문법

```qtn
component Action {
    FP Cooldown;
    FP Power;
}
```

### 싱글톤 컴포넌트

게임 상태 전체에서 단 하나만 존재할 수 있는 컴포넌트.

```qtn
singleton component MySingleton {
    FP Foo;
}
```

- `IComponentSingleton` 인터페이스 상속
- `Frame.SetSingleton<T>()`, `Frame.GetSingleton<T>()`, `Frame.TryGetSingleton<T>()` 지원

### 컴포넌트 임포트

외부 DLL에서 정의된 컴포넌트 임포트:

```qtn
import FooComponent;
import singleton FooComponent;
```

### 컴포넌트 확장 (C#)

생성된 partial struct에 메서드를 추가할 수 있다:

```csharp
public partial struct Action {
    public void UpdateCooldown(FP deltaTime) {
        Cooldown -= deltaTime;
    }
}
```

### 리액티브 콜백

- `ISignalOnComponentAdded<T>` — 컴포넌트 추가 시
- `ISignalOnComponentRemoved<T>` — 컴포넌트 제거 시

---

## 3. Struct

메모리 정렬과 직렬화 헬퍼가 자동 생성되는 데이터 구조.

### DSL 정의

```qtn
struct ResourceItem {
    FP Value;
    FP MaxValue;
    FP RegenRate;
}
```

컴포넌트 내 중첩 사용:

```qtn
component Resources {
    ResourceItem Health;
    ResourceItem Strength;
    ResourceItem Mana;
}
```

### C# 정의 struct (수동)

DSL 외부에서 C#로 직접 정의할 경우 반드시 다음을 충족해야 한다:

1. `[StructLayout(LayoutKind.Explicit)]` 적용
2. `public const int SIZE` 상수 선언 (바이트 단위)
3. `public static unsafe void Serialize(void* ptr, FrameSerializer serializer)` 구현

```csharp
[StructLayout(LayoutKind.Explicit)]
public struct Foo {
    public const int SIZE = 12;

    [FieldOffset(0)]  public int A;
    [FieldOffset(4)]  public int B;
    [FieldOffset(8)]  public int C;

    public static unsafe void Serialize(void* ptr, FrameSerializer serializer) {
        var foo = (Foo*)ptr;
        serializer.Stream.Serialize(&foo->A);
        serializer.Stream.Serialize(&foo->B);
        serializer.Stream.Serialize(&foo->C);
    }
}
```

DSL에서 임포트:

```qtn
import struct Foo(12);
```

> **주의:** import 크기에는 상수를 사용할 수 없다. 반드시 숫자 리터럴을 직접 지정해야 한다.

---

## 4. Enum / Flags

### 기본 Enum

```qtn
enum EDamageType {
    None,
    Physical,
    Magic
}
```

### 명시적 값과 기저 타입 지정

```qtn
enum EModifierOperation : Byte {
    None = 0,
    Add = 1,
    Subtract = 2
}
```

### Flags Enum

비트 연산용. `IsFlagSet()` 유틸리티 메서드가 자동 생성된다 (`System.Enum.HasFlag()`보다 고성능).

```qtn
flags ETeamStatus : Byte {
    None,
    Winning,
    SafelyWinning,
    LowHealth,
    MidHealth,
    HighHealth
}
```

### Enum 임포트

```qtn
import enum MyEnum(underlying_type);
import enum Shape3DType(byte);
```

---

## 5. Union

C 스타일 유니온. 메모리가 겹치는 레이아웃.

```qtn
struct DataA {
    FPVector2 Foo;
}

struct DataB {
    FP Bar;
}

union Data {
    DataA A;
    DataB B;
}

component ComponentWithUnion {
    Data ComponentData;
}
```

C#에서 활성 필드 확인:

```csharp
// 활성 필드 판별
bool isWarrior = data.Field == CharacterData.WARRIOR;

// 포인터로 접근
character->Data.Warrior->ImpulseDirection = FPVector3.Forward;
```

---

## 6. Bitset

고정 크기 비트 메모리 블록.

```qtn
struct FOWData {
    bitset[256] Map;
}
```

---

## 7. Input

클라이언트와 매 틱마다 교환되는 입력 구조체. 프로젝트당 하나.

```qtn
input {
    FPVector2 Movement;
    button Fire;
}
```

- `button` 타입은 입력 전용 특수 타입

---

## 8. Signal

시스템 간 디커플링된 통신 (publisher/subscriber 패턴). 시뮬레이션 내부에서만 사용.

### 기본 문법

```qtn
signal OnDamage(FP damage, entity_ref entity);
```

생성되는 인터페이스:

```csharp
public interface ISignalOnDamage {
    public void OnDamage(Frame frame, FP damage, EntityRef entity);
}
```

### 포인터 파라미터

직접 데이터 수정이 필요한 경우:

```qtn
signal OnBeforeDamage(FP damage, Resources* resources);
```

---

## 9. Event

시뮬레이션 → 렌더링 레이어 통신용. **게임 상태를 절대 수정하면 안 된다.**

### 기본 문법

```qtn
event MyEvent {
    int Foo;
}
```

트리거 (시뮬레이션):
```csharp
f.Events.MyEvent(2022);
```

구독 (Unity):
```csharp
QuantumEvent.Subscribe(listener: this,
    handler: (MyEvent e) => Debug.Log($"MyEvent {e.Foo}"));
```

### Synced Event

서버에서 입력이 확정된 프레임에서만 디스패치. 지연이 발생하지만 false positive/negative가 없다.

```qtn
synced event MyEvent {
    // ...
}
```

### Non-Synced Event (기본값)

예측 프레임에서 디스패치. 검증 전까지 여러 번 발생할 수 있으며, 해시코드(`EventKey`)로 중복을 판별한다.

### 이벤트 키워드

| 키워드 | 적용 대상 | 설명 |
|--------|-----------|------|
| `synced` | event 선언 | 확정된 프레임에서만 디스패치 |
| `nothashed` | 필드 | 중복 판별 해시에서 제외 |
| `local` | `player_ref` 필드 | 해당 플레이어를 조종하는 클라이언트에서만 디스패치 |
| `remote` | `player_ref` 필드 | 해당 플레이어를 조종하지 않는 클라이언트에서만 디스패치 |
| `client` | event 선언 | 클라이언트 사이드 전용 (플러그인 컨텍스트) |
| `server` | event 선언 | 서버 사이드 전용 (플러그인 컨텍스트) |

### 이벤트 필드 예시

```qtn
event LocalPlayerOnly {
    local player_ref player;
}

event MyEvent {
    local player_ref LocalPlayer;
    remote player_ref RemotePlayer;
    player_ref AnyPlayer;
}

abstract event MyBaseEvent {
    nothashed FPVector2 Position;
    Int32 Foo;
}
```

### 추상/다형 이벤트

이벤트는 상속 계층을 지원한다. `abstract` 이벤트는 직접 트리거할 수 없다.

```qtn
abstract event MyBaseEvent {}
event SpecializedEventFoo : MyBaseEvent {}
event SpecializedEventBar : MyBaseEvent {}
```

> **주의:** `synced` 키워드는 상속되지 않는다. 파생 이벤트에 별도로 지정해야 한다.

### 이벤트에 구조체/배열 포함

```qtn
struct FooEventData {
    FP Bar;
    FP Par;
    FP Rap;
}

event FooEvent {
    FooEventData EventData;
    array<FP>[4] ArrayOfValues;
}
```

### 이벤트 생명주기

- 각 클라이언트가 독립적으로 시뮬레이션 (클라이언트 간 동기화 X)
- 모든 프레임 완료 후, `OnUpdateView` 이후에 디스패치
- Non-synced: 검증 프레임 도달 시 취소 또는 확정
- 이벤트 순서는 보존되나, non-synced 중복은 스킵될 수 있음

---

## 10. Asset

불변 데이터 컨테이너. 에셋 데이터베이스에 인덱싱되어 `asset_ref<T>`로 참조한다.

```qtn
asset CharacterData;
```

참조:

```qtn
component Character {
    asset_ref<CharacterData> Data;
}
```

---

## 11. Global

게임 상태에서 전역으로 접근 가능한 변수.

```qtn
global {
    FP MyGlobalValue;
}
```

- `Frame` API를 통해 접근
- 대안: `singleton component`

---

## 12. 컬렉션 타입 (Dynamic Collections)

**blittable 타입만 지원** (프리미티브 및 DSL 정의 타입).

### List

```qtn
component Targets {
    list<EntityRef> Enemies;
}
```

| API | 설명 |
|-----|------|
| `Frame.AllocateList<T>()` | 할당 |
| `Frame.FreeList(QListPtr<T>)` | 해제 |
| `Frame.ResolveList(QListPtr<T>)` | 접근 |

### Dictionary

```qtn
component Hazard {
    dictionary<EntityRef, Int32> DamageDealt;
}
```

| API | 설명 |
|-----|------|
| `Frame.AllocateDictionary<K,V>()` | 할당 |
| `Frame.FreeDictionary(QDictionaryPtr<K,V>)` | 해제 |
| `Frame.ResolveDictionary(QDictionaryPtr<K,V>)` | 접근 |

### HashSet

```qtn
component Nodes {
    hash_set<FP> ProcessedNodes;
}
```

| API | 설명 |
|-----|------|
| `Frame.AllocateHashSet(QHashSetPtr<T>, int capacity = 8)` | 할당 |
| `Frame.FreeHashSet(QHashSetPtr<T>)` | 해제 |
| `Frame.ResolveHashSet(QHashSetPtr<T>)` | 접근 |

### 고정 크기 배열

```qtn
struct SpecialData {
    array<FP>[10] TenNumbers;
}
```

### 컬렉션 관리 규칙

1. **사용 전 반드시 할당**
2. **해제 후 반드시 `= default`로 널화** (직렬화 역직렬화 불일치 방지)
3. `ref` 오버로드 (`FreeList<T>(ref QListPtr<T>)`) 사용 시 자동 널화
4. **같은 컬렉션을 두 번 해제하면 에러** (힙이 무효 상태가 됨)
5. `[FreeOnComponentRemoved]`와 교차 참조 컬렉션을 함께 사용하지 말 것

---

## 13. Import / Using

### 타입 임포트

```qtn
import MyInterface;
import MyNameSpace.Utils;
```

### Enum 임포트

```qtn
import enum MyEnum(underlying_type);
import enum Shape3DType(byte);
```

### Struct 임포트

```qtn
import struct Foo(12);   // 크기는 반드시 숫자 리터럴
```

> `import`의 크기 파라미터에는 상수(`#define`)를 사용할 수 없다. 반드시 숫자 리터럴을 직접 지정.

### 컴포넌트 임포트

```qtn
import FooComponent;
import singleton FooComponent;
```

### Namespace Using

생성 코드에 네임스페이스를 포함:

```qtn
using MyNamespace;
```

---

## 14. 필드 어트리뷰트 (Attributes)

QTN 파일에서 필드에 적용하는 어트리뷰트. 여러 개 적용 시 `[A, B]` 형태로 이어 쓴다.

| 어트리뷰트 | 파라미터 | 설명 |
|------------|----------|------|
| `AllocateOnComponentAdded` | — | 컴포넌트 추가 시 컬렉션 자동 할당 |
| `FreeOnComponentRemoved` | — | 컴포넌트 제거 시 컬렉션 자동 해제 + 널화 |
| `ExcludeFromPrototype` | — | 프로토타입 생성에서 제외 |
| `OnlyInPrototype` | — | 프로토타입에만 존재 (런타임 상태에 미포함) |
| `OnlyInPrototype` | `fieldName, fieldType` | 컴포넌트 레벨 변형 |
| `PreserveInPrototype` | — | 프로토타입에서 사용 가능하도록 마킹 |
| `Header` | `"텍스트"` | 인스펙터 섹션 헤더 |
| `Tooltip` | `"텍스트"` | 인스펙터 호버 설명 (`\n`으로 개행 가능) |
| `DrawIf` | `"fieldName", value, Compare, Hide` | 조건부 표시 |
| `Range` | `(min, max)` | `int` 타입 슬라이더 |
| `RangeEx` | `(min, max)` | `FP` / `long` 타입 슬라이더 |
| `Layer` | — | `int` 전용, `EditorGUI.LayerField` 사용 |
| `HideInInspector` | — | 직렬화하되 인스펙터에서 숨김 |
| `Optional` | `"enabledPropertyPath"` | 토글로 표시/숨김 |
| `Space` | — | 프로퍼티 위에 여백 추가 |

### DrawIf 비교 연산자

`Equal`, `NotEqual`, `Less`, `LessOrEqual`, `Greater`, `GreaterOrEqual`

### DrawIf 숨김 모드

`Hide`, `ReadOnly`

### 사용 예시

```qtn
component Example {
    [Header("Combat Stats")]
    [Tooltip("min = 0\nmax = 100")]
    [RangeEx(0, 100)]
    FP Health;

    Boolean UseShield;

    [DrawIf("UseShield", 1, Equal, Hide)]
    FP ShieldStrength;

    [HideInInspector]
    Int32 InternalCounter;

    [AllocateOnComponentAdded, FreeOnComponentRemoved]
    list<EntityRef> Targets;

    [Header("Example Array")]
    [Tooltip("min = 1\nmax = 20")]
    array<FP>[20] TestArray;

    [Optional("enabledPropertyPath")]
    FP OptionalValue;
}
```

---

## 15. 전처리기 지시문 (Pragma / Define)

### Pragma

```qtn
#pragma max_players 16                        // 기본 6, 최대 64
#pragma max_components 512                    // 기본 256 (유저 정의 가능 236)
#pragma constants_class_name MyFancyConstants // 생성 상수 클래스 이름 변경
```

### Define (상수)

```qtn
#define MY_NUMBER 10    // 정수 상수 → Constants.MY_NUMBER
#define Pi 3.14         // FP 상수 → Constants.Pi, Constants.Raw.Pi
```

---

## 16. 핵심 규칙 요약

| 규칙 | 설명 |
|------|------|
| **blittable 타입만** | 컬렉션에는 프리미티브/DSL 정의 타입만 사용 가능 |
| **결정론적** | 모든 타입은 플랫폼 간 결정론적이어야 함 |
| **컬렉션 라이프사이클** | 할당 → 사용 → 해제 → `= default` 널화 필수 |
| **포인터 캐싱 금지** | 프레임 간 포인터를 캐싱할 수 없음 (롤백 메모리 구조) |
| **이벤트는 읽기 전용** | 이벤트에서 게임 상태 수정 금지 |
| **import 크기는 리터럴** | `import struct Foo(12)` — 상수 사용 불가 |
| **메모리 정렬** | DSL 컴파일러가 자동 처리, C# 수동 struct는 `LayoutKind.Explicit` 필수 |
| **`synced` 미상속** | 이벤트의 `synced` 키워드는 파생 이벤트에 상속되지 않음 |
| **이중 해제 금지** | 같은 컬렉션을 두 번 해제하면 힙이 무효 상태가 됨 |

---

## 문법 요약 (Quick Reference)

```qtn
// === 타입 정의 ===
struct MyStruct { FP Field; }
component MyComponent { Int32 Value; }
singleton component MySingleton { FP Foo; }
enum MyEnum { A, B, C }
enum MyEnum : Byte { A = 0, B = 1 }
flags MyFlags : Byte { None, FlagA, FlagB }
union MyUnion { StructA A; StructB B; }
asset MyAsset;

// === 이벤트/시그널 ===
event MyEvent { Int32 Data; }
synced event MySyncedEvent { FP Value; }
abstract event MyBaseEvent { Int32 Common; }
event MyDerivedEvent : MyBaseEvent { FP Extra; }
signal MySignal(FP damage, entity_ref target);

// === 입력/전역 ===
input { FPVector2 Move; button Jump; }
global { FP GameTimer; }

// === 임포트 ===
import struct Foo(12);
import enum MyEnum(byte);
import FooComponent;
import singleton FooComponent;
import MyInterface;
using MyNamespace;

// === 전처리기 ===
#pragma max_players 16
#pragma max_components 512
#define MY_CONST 42

// === 컬렉션 ===
// list<T>, dictionary<K,V>, hash_set<T>, array<T>[N], bitset[N]
```
