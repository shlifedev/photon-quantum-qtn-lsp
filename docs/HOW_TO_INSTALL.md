# QTN Language Support 설치 가이드

Photon Quantum 3의 `.qtn` 파일에 구문 강조, 자동 완성, hover, 정의 이동, 문서·워크스페이스 심볼을 제공합니다.

## 지원 IDE와 설치 링크

| IDE | 최소 버전 | Marketplace |
|---|---|---|
| VSCode | 1.82 | [Quantum DSL (QTN) Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.qtn-syntax-highlighting) |
| JetBrains Rider | 2024.3 (build 243) | [Quantum DSL (QTN) Language Support](https://plugins.jetbrains.com/plugin/32137-quantum-dsl-qtn-language-support) |
| Visual Studio | 2022 (17.0+) | [Quantum DSL (QTN) Language Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.QtnLanguageSupport) |

VSCode는 IDE 내장 Node.js를 사용합니다. Rider와 Visual Studio는 전용 Node.js 런타임을 포함하므로 별도 설치, PATH 설정, 시작 시 다운로드가 필요 없습니다. Rider는 Windows·macOS·Linux의 x64/arm64, Visual Studio 패키지는 Windows x64 런타임을 포함합니다. 자세한 내용은 [런타임 패키징 문서](RUNTIME_PACKAGING.md)를 참고하세요.

## VSCode

**Extensions**에서 `Quantum DSL (QTN)`을 검색해 설치하거나 CLI를 사용합니다.

```bash
code --install-extension shlifedev.qtn-syntax-highlighting
```

수동 설치는 [GitHub Releases](https://github.com/shlifedev/photon-quantum-qtn-lsp/releases)의 `QtnLSP-vscode.vsix`를 받아 **Extensions → … → Install from VSIX…**로 설치하거나 다음 명령을 실행합니다.

```bash
code --install-extension /path/to/QtnLSP-vscode.vsix
```

제거:

```bash
code --uninstall-extension shlifedev.qtn-syntax-highlighting
```

## JetBrains Rider

1. **Settings → Plugins → Marketplace**를 엽니다.
2. `Quantum DSL (QTN) Language Support`를 검색합니다. [Marketplace 페이지](https://plugins.jetbrains.com/plugin/32137-quantum-dsl-qtn-language-support)의 플러그인 ID는 `com.qtn.syntax-highlighting`입니다.
3. **Install**을 누르고 IDE에서 요구하면 재시작합니다.

수동 설치는 [GitHub Releases](https://github.com/shlifedev/photon-quantum-qtn-lsp/releases)의 `QtnLSP-jetbrains.zip`를 받아 **Settings → Plugins → ⚙ → Install Plugin from Disk…**에서 선택합니다. ZIP을 직접 풀 필요는 없습니다.

Rider 전용 플러그인입니다. IntelliJ IDEA는 지원 대상으로 선언되어 있지 않습니다. 제거할 때는 **Settings → Plugins → Installed**에서 해당 플러그인의 **Uninstall**을 선택합니다.

## Visual Studio 2022

**Extensions → Manage Extensions**에서 `Quantum DSL (QTN)`을 검색해 설치합니다. 수동 설치는 [GitHub Releases](https://github.com/shlifedev/photon-quantum-qtn-lsp/releases)의 `QtnLSP-vs.vsix`를 다운로드하고, Visual Studio를 종료한 뒤 파일을 실행해 VSIX Installer의 안내를 따릅니다.

제거는 **Extensions → Manage Extensions**에서 해당 확장의 **Uninstall**을 선택합니다.

## 설치 확인과 지원 범위

`.qtn` 파일을 열어 다음 동작을 확인합니다. 키보드 단축키는 IDE의 키맵과 OS 설정에 따라 달라지므로 메뉴의 자동 완성·정의 이동 명령도 사용할 수 있습니다.

- 키워드·타입·주석·문자열의 구문 강조
- `component Player {` 안에서 `FP`, `int` 등 필드 타입 자동 완성
- `input {` 안에서 `button` 자동 완성
- 타입 이름 위의 hover 설명과 사용자 정의 타입 참조의 정의 이동
- 문서 구조와 워크스페이스 심볼 검색

공유 언어 서버는 타입 참조의 semantic token도 제공합니다. 초기 워크스페이스 검색은 Unity의 `Library`, `Temp` 등 빌드·캐시 디렉토리를 제외합니다. 편집 중인 문서는 저장된 파일보다 우선하며, 문서를 닫으면 디스크 내용으로 다시 읽습니다.

컴파일 오류 진단 발행, 코드 포매팅, rename은 제공하지 않습니다. 실제 DSL 유효성은 Quantum 컴파일러로 확인하세요. 지원 문법과 예제는 [DSL.md](DSL.md)를 참고하세요.

## 소스에서 빌드

### Docker 사용

Docker 데몬이 실행 중이어야 합니다. VSCode·Rider 빌드에는 호스트의 Node.js나 JDK가 필요하지 않습니다. 아래 명령은 저장소 루트에서 실행합니다. 스크립트가 Bash 문법을 사용하므로 `bash`로 실행하세요.

```bash
bash scripts/build.sh sync            # 세 IDE 문법 동기화
bash scripts/build.sh test            # 서버·프로토콜·문법·런타임 테스트
bash scripts/build.sh vscode          # dist/vscode/*.vsix
bash scripts/build.sh vscode-install  # 빌드 후 로컬 VSCode에 설치
bash scripts/build.sh jetbrains       # dist/jetbrains/*.zip
bash scripts/build.sh all             # 동기화 + 테스트 + VSCode·Rider 빌드
```

`all`에는 Visual Studio 빌드가 포함되지 않습니다. Windows에서 Node.js 22.23.3와 .NET 8 SDK를 준비한 뒤 별도로 실행합니다.

```bash
bash scripts/build.sh vs              # dist/vs/*.vsix
```

### 로컬 개발

Node.js 22.23.3와 npm을 준비하고 저장소 루트에서 실행합니다.

```bash
npm ci
npm --prefix packages/language-server ci
npm --prefix packages/vscode-extension ci
npm run sync-grammar
npm test
npm run compile
npm run webpack
```

`npm run check:grammar`는 복사본이 공유 원본과 같은지 검사합니다. 문법은 `packages/shared/syntaxes/qtn.tmLanguage.json`에서, LSP 기능은 `packages/language-server/src/`에서 수정하세요.

VSCode 패키지 생성:

```bash
cd packages/vscode-extension
npx vsce package --no-dependencies
```

로컬 Rider 빌드는 **JDK 21**이 필요합니다. 서버 번들·런타임을 먼저 준비하는 [Rider 빌드 절차](../packages/jetbrains-plugin/README.md#building-from-source)를 따르세요. `build.sh`는 호스트 JDK를 자동 전환하지 않습니다.

## 문제 해결

- **VSCode 자동 완성이 안 됨**: 언어 모드가 `QTN`인지 확인하고 **Output → QTN Language Server**를 확인하세요. 확장을 업데이트한 뒤 **Developer: Reload Window**로 다시 시작합니다.
- **Rider 플러그인 설치가 안 됨**: Rider 2024.3 이상인지 확인하세요. **Settings → Plugins → Installed**에서 플러그인과 TextMate 지원이 활성화되어 있어야 합니다.
- **Rider에서 구문 강조만 동작함**: IDE 로그의 QTN 서버·번들 런타임 오류를 확인하고 플러그인을 업데이트하거나 재설치하세요.
- **Visual Studio에서 구문 강조만 동작함**: **Output → QTN Language Server**와 확장 활성화 상태를 확인하고 업데이트하거나 재설치하세요.
- **Docker 연결 오류**: Docker 데몬을 실행하거나 로컬 개발 절차를 사용하세요.
- **로컬 Rider 빌드의 Java 오류**: `java -version`으로 JDK 21을 확인하고 Gradle이 같은 JDK를 사용하도록 설정하세요.

문제를 보고할 때 IDE·플러그인 버전, OS와 CPU 아키텍처, 설치 방법, 오류 로그와 최소 재현 `.qtn` 예제를 [GitHub Issues](https://github.com/shlifedev/photon-quantum-qtn-lsp/issues)에 첨부하세요.
