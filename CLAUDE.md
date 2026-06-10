# QTN Syntax Highlighting

> Photon Quantum3 DSL(`.qtn`) 파일의 신텍스 하이라이팅을 VSCode, JetBrains Rider, Visual Studio 2022에서 제공하는 프로젝트.

## 프로젝트 개요

`.qtn`은 Quantum ECS의 게임 상태를 정의하는 DSL이다. DSL 컴파일러(`Quantum.CodeGen.Qtn`)가 `.qtn` 파일을 파싱하여 메모리 정렬, 직렬화, 디버깅 헬퍼가 포함된 C# partial struct를 생성한다.

이 프로젝트는 `.qtn` 파일에 대한 **정적 문법 기반 신텍스 하이라이팅**을 TextMate Grammar로 구현하고, **Language Server Protocol(LSP)** 기반 IntelliSense(자동 완성, 정의 이동, hover 등)를 제공한다. VSCode 확장, JetBrains Rider 플러그인, Visual Studio 2022 확장으로 패키징한다.

## 프로젝트 구조

```text
shared/syntaxes/
└── qtn.tmLanguage.json              # 핵심 TextMate 문법 (단일 소스, 양쪽 IDE 공유)

vscode-extension/
├── package.json                      # VSCode 확장 매니페스트
├── language-configuration.json       # 괄호 매칭, 주석 토글, 접기
├── syntaxes/qtn.tmLanguage.json     # shared/에서 복사 (npm run sync-grammar)
└── tests/
    ├── unit/                         # vscode-tmgrammar-test 단위 테스트
    └── snap/                         # 스냅샷 테스트

language-server/                      # QTN Language Server (단일 소스, 양쪽 IDE 공유)
├── src/
│   ├── server.ts                     # LSP 서버 진입점
│   ├── lexer.ts                      # 토크나이저
│   ├── parser.ts                     # 파서 (AST 생성)
│   ├── completion.ts                 # 자동 완성
│   ├── definition.ts                 # 정의 이동
│   ├── hover.ts                      # Hover 정보
│   ├── symbols.ts                    # Document/Workspace 심볼
│   └── builtins.ts                   # Quantum 내장 타입 정의
├── package.json
└── tsconfig.json

jetbrains-plugin/
├── build.gradle.kts                  # Gradle IntelliJ Platform Plugin 2.x
├── src/main/kotlin/                  # TextMateBundleProvider + LSP 클라이언트 구현
└── src/main/resources/
    ├── META-INF/
    │   ├── plugin.xml                # 플러그인 매니페스트
    │   └── lsp.xml                   # LSP extension (optional dependency)
    └── bundles/qtn.tmbundle/

vs-extension/
├── QtnLanguageExtension.csproj       # VSIX 프로젝트 (SDK-style)
├── source.extension.vsixmanifest     # VSIX 매니페스트
├── QtnLanguage.pkgdef                # TextMate 문법 등록
├── QtnContentTypeDefinition.cs       # .qtn content type 매핑
├── QtnLanguageClient.cs              # ILanguageClient 구현 (LSP)
├── language-configuration.json       # 괄호 매칭, 주석 토글, 접기
├── Grammars/
│   └── qtn.tmLanguage.json           # shared/에서 복사 (빌드 시 sync)
└── LanguageServer/                   # language-server/dist/server.js 링크 (빌드 시)
    └── server.js                     # webpack 단일 번들 (node_modules 불필요)

tests/fixtures/
└── sample.qtn                        # 종합 테스트 픽스처

docs/
├── DSL.md                            # QTN DSL 전체 문법 레퍼런스
├── HOW_TO_INSTALL.md                 # 설치 가이드
├── README.ko.md / ja / zh-TW        # README 번역본
└── images/sample.png                 # README 스크린샷

docker/                               # Docker 빌드 환경 (Dockerfile, compose)
scripts/                              # build.sh, install.sh, 빌드 보조 스크립트
```

## 핵심 규칙

### 문법 파일 단일 소스 (Single Source of Truth)

- **항상 `shared/syntaxes/qtn.tmLanguage.json`을 편집**한다
- 편집 후 `npm run sync-grammar` (vscode-extension/) 으로 복사
- JetBrains 번들도 동일하게 shared/에서 복사
- 절대로 `vscode-extension/syntaxes/`나 `jetbrains-plugin/.../Syntaxes/`를 직접 수정하지 않는다

### Language Server 단일 소스 (Single Source of Truth)

- **LSP 기능 확장은 항상 `language-server/src/`를 수정**한다
- `language-server/`는 VSCode, JetBrains, Visual Studio 모두에서 공유하는 단일 Language Server이다
- 배포는 세 IDE 모두 **webpack 단일 번들** 하나를 공유한다: `npm run bundle:server` (루트) → `language-server/dist/server.js`
  - VSCode: 번들이 `vscode-extension/dist/server.js`로 복사됨
  - JetBrains: Gradle `prepareSandbox`가 `dist/`를 플러그인의 `language-server/out/`으로 복사
  - Visual Studio: csproj가 `dist/server.js`를 `LanguageServer\server.js`로 링크
  - node_modules는 어디에도 동봉하지 않는다 (의존성은 번들에 포함)
- 새로운 LSP 기능(diagnostics, formatting, rename 등)을 추가할 때는 `language-server/src/`에 구현하면 모든 IDE에 자동 반영된다

## 명령어

```bash
# Docker로 빌드 (로컬 툴체인 불필요, Docker만 있으면 됨)
sh scripts/build.sh sync          # 문법 파일 동기화
sh scripts/build.sh test          # 테스트 실행
sh scripts/build.sh vscode        # VSCode 확장 빌드
sh scripts/build.sh jetbrains     # JetBrains 플러그인 빌드
sh scripts/build.sh all           # sync + test + vscode + jetbrains
sh scripts/build.sh clean         # 빌드 산출물 삭제
```

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

## 기술 스택

| 영역 | 기술 |
|------|------|
| 문법 정의 | TextMate Grammar (JSON) |
| VSCode 확장 | TypeScript/Node.js 18+, `@vscode/vsce` |
| VSCode 테스트 | `vscode-tmgrammar-test` (단위 + 스냅샷) |
| JetBrains 플러그인 | Kotlin/JDK 17+, Gradle IntelliJ Platform Plugin 2.x |
| Visual Studio 확장 | C#/.NET 4.7.2, Microsoft.VSSDK.BuildTools, ILanguageClient |
| 대상 IDE | VSCode 1.50+, JetBrains Rider 2022.3+, Visual Studio 2022 (17.0+) |

## 범위 외

- 사용자 정의 타입의 의미론적 하이라이팅
- 코드 포매팅/리팩토링
- Sublime Text, Vim, Emacs 등 기타 에디터\
  

## DSL 최신 참고문서

https://doc.photonengine.com/ko-kr/quantum/v1/manual/quantum-dsl

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
