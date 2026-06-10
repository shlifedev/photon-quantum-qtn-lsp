# QTN Syntax Highlighting 설치 가이드

> Photon Quantum3 DSL (.qtn) 파일에 대한 신텍스 하이라이팅 및 IntelliSense를 VSCode와 JetBrains Rider에 설치하는 방법을 설명합니다.

## 개요

이 프로젝트는 세 가지 플러그인을 제공합니다:

- **VSCode Extension**: `qtn-syntax-highlighting-1.0.0.vsix`
- **JetBrains Plugin**: `qtn-syntax-highlighting-1.0.0.zip` (Rider 2022.3 이상)
- **Visual Studio Extension**: Visual Studio 2022 17.0+ 용 VSIX 패키지

각 IDE에 맞는 설치 방법을 선택하세요.

---

## VSCode 설치

### 방법 1: 자동 설치 (권장)

빌드와 설치를 동시에 수행합니다:

```bash
cd /path/to/QtnLSP
./scripts/build.sh vscode-install
```

이 명령은 자동으로:
1. 문법 파일을 동기화
2. VSCode 확장을 빌드 (.vsix 생성)
3. VSCode에 확장을 설치
4. VSCode를 다시 로드하도록 안내

### 방법 2: CLI로 설치

미리 빌드된 .vsix 파일이 있으면:

```bash
code --install-extension /path/to/qtn-syntax-highlighting-1.0.0.vsix
```

### 방법 3: GUI로 설치

1. VSCode 열기
2. 좌측 사이드바에서 **Extensions** 아이콘 클릭
3. 우상단의 **...** 메뉴 클릭
4. **Install from VSIX...** 선택
5. `qtn-syntax-highlighting-1.0.0.vsix` 파일 선택
6. VSCode 재시작

### 설치 확인

1. `.qtn` 파일 열기
2. 다음을 확인하세요:
   - **신텍스 하이라이팅**: 키워드, 타입, 주석이 색상으로 표시됨
   - **자동 완성**: Ctrl+Space (Windows/Linux) 또는 Cmd+Space (Mac) 입력 시 제안 표시
   - **Hover 정보**: 변수나 타입 위에 마우스를 올릴 때 정보 표시
   - **정의 이동**: F12 또는 Ctrl+Click으로 정의 위치로 이동

### 제거

VSCode 확장 제거 방법:

**CLI:**
```bash
code --uninstall-extension qtn-tools.qtn-syntax-highlighting
```

**GUI:**
1. Extensions 사이드바 열기
2. "QTN Syntax Highlighting" 검색
3. 확장 항목에서 **Uninstall** 클릭
4. VSCode 재시작

---

## JetBrains Rider 설치

### 방법 1: IDE 내 설치 (권장)

1. Rider 열기
2. **Settings** 또는 **Preferences** 열기
   - Windows/Linux: File → Settings
   - Mac: Rider → Preferences
3. **Plugins** 검색
4. **Plugins** 선택
5. 우상단의 **⚙️** (톱니바퀴) 아이콘 클릭
6. **Install Plugin from Disk...** 선택
7. `qtn-syntax-highlighting-1.0.0.zip` 파일 선택
8. **OK** 클릭
9. IDE 재시작

### 방법 2: 빌드 후 설치

.zip 파일이 없으면 직접 빌드할 수 있습니다:

```bash
cd /path/to/QtnLSP
./scripts/build.sh jetbrains
```

그 후 위의 "방법 1"을 따릅니다.

**주의:** JetBrains 플러그인 빌드에는 JDK 17이 필요합니다. 설치 확인 섹션을 참고하세요.

### 설치 확인

1. Rider를 완전히 닫고 다시 열기
2. `.qtn` 파일 열기
3. 다음을 확인하세요:
   - **신텍스 하이라이팅**: 키워드, 타입, 주석이 색상으로 표시됨
   - **자동 완성**: Ctrl+Space (Windows/Linux) 또는 Cmd+Space (Mac) 입력 시 제안 표시
   - **Hover 정보**: 변수나 타입 위에 마우스를 올릴 때 정보 표시
   - **정의 이동**: Ctrl+B (Windows/Linux) 또는 Cmd+B (Mac)로 정의 위치로 이동

### 제거

1. **Settings** → **Plugins** 열기
2. "QTN Syntax Highlighting" 검색
3. 플러그인 항목에서 **Uninstall** 클릭
4. **OK** 클릭
5. IDE 재시작

---

## Visual Studio 2022 설치

### 전제 조건

- **Visual Studio 2022** (17.0 이상) 필수 — VS 2019는 지원하지 않음
- **Node.js 18+** 시스템에 설치 필요 (LSP 서버 실행용)

### 방법 1: VSIX 파일로 설치 (권장)

미리 빌드된 .vsix 파일이 있으면:

1. `.vsix` 파일 더블클릭
2. Visual Studio Installer가 자동으로 시작됨
3. **Install** 클릭
4. Visual Studio 재시작

또는 Visual Studio 내에서:

1. Visual Studio 열기
2. **Extensions** → **Manage Extensions** 열기
3. 좌측 하단 **...** 메뉴 또는 검색 바 옆 아이콘 클릭
4. **Install from VSIX...** 선택 (또는 .vsix 파일을 창에 드래그 앤 드롭)
5. `.vsix` 파일 선택
6. Visual Studio 재시작

### 방법 2: 빌드 후 설치

```bash
cd /path/to/QtnLSP
./scripts/build.sh vs
```

그 후 위의 "방법 1"을 따릅니다.

**주의:** Visual Studio 확장 빌드에는 .NET SDK 6.0+이 필요합니다.

### 설치 확인

1. Visual Studio 재시작
2. `.qtn` 파일 열기
3. 다음을 확인하세요:
   - **신텍스 하이라이팅**: 키워드, 타입, 주석이 색상으로 표시됨
   - **자동 완성**: Ctrl+Space 입력 시 제안 표시
   - **Hover 정보**: 변수나 타입 위에 마우스를 올릴 때 정보 표시
   - **정의 이동**: F12 또는 Ctrl+Click으로 정의 위치로 이동

### 제거

1. Visual Studio 열기
2. **Extensions** → **Manage Extensions**
3. "Quantum DSL" 검색
4. **Uninstall** 클릭
5. Visual Studio 재시작

---

## 소스에서 빌드

### 빌드 요구사항

- **공통**: Node.js 18+ (npm 9+), git
- **VSCode**: 추가 요구사항 없음
- **JetBrains**: JDK 17 필수
- **Visual Studio**: .NET SDK 6.0+

### JDK 17 설치 (macOS)

```bash
brew install openjdk@17
```

설치 후 `$JAVA_HOME` 설정:
```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
```

### VSCode 확장 빌드

```bash
cd /path/to/QtnLSP
./scripts/build.sh vscode
```

생성된 파일: `vscode-extension/qtn-syntax-highlighting-1.0.0.vsix`

### JetBrains 플러그인 빌드

```bash
cd /path/to/QtnLSP
./scripts/build.sh jetbrains
```

생성된 파일: `jetbrains-plugin/build/distributions/qtn-syntax-highlighting-1.0.0.zip`

### Visual Studio 확장 빌드

```bash
cd /path/to/QtnLSP
./scripts/build.sh vs
```

### 전체 빌드

VSCode, JetBrains, Visual Studio 플러그인을 모두 빌드합니다:

```bash
cd /path/to/QtnLSP
./scripts/build.sh all
```

이 명령은:
1. 공유 문법 파일을 동기화
2. 문법 단위 테스트 실행
3. VSCode 확장 빌드
4. JetBrains 플러그인 빌드
5. Visual Studio 확장 빌드

---

## 문제 해결

### VSCode

**확장이 활성화되지 않음**

```bash
# VSCode 출력 패널에서 "QTN Language Server"를 검색하여 오류 확인
# 또는 직접 재설치:
code --uninstall-extension qtn-tools.qtn-syntax-highlighting
code --install-extension qtn-syntax-highlighting-1.0.0.vsix
```

**자동 완성이 작동하지 않음**

- VSCode를 완전히 재시작하세요 (Ctrl+Shift+P → "Reload Window")
- 파일이 `.qtn` 확장자인지 확인하세요
- 언어 모드가 "QTN"으로 설정되었는지 확인하세요 (우하단)

### JetBrains Rider

**플러그인이 로드되지 않음**

1. IDE를 완전히 종료
2. `~/.cache/JetBrains/Rider*/` 디렉토리 삭제 (캐시 초기화)
3. IDE 재시작

**자동 완성이 작동하지 않음**

- Rider를 완전히 재시작하세요
- File → Invalidate Caches → Invalidate and Restart 사용

**JDK 버전 오류 (빌드 시)**

```
ERROR: Java 23 is too new for Gradle Kotlin DSL. Install JDK 17
```

JDK 17을 설치하고 build.sh가 자동으로 감지하도록 하세요:

```bash
brew install openjdk@17
./scripts/build.sh jetbrains
```

build.sh가 시스템 Java를 감지하면 자동으로 JDK 17로 전환합니다.

### Visual Studio 2022

**확장이 활성화되지 않음**

- Visual Studio를 완전히 재시작하세요
- Extensions → Manage Extensions에서 확장이 활성화되어 있는지 확인
- 파일이 `.qtn` 확장자인지 확인

**자동 완성이 작동하지 않음**

- Node.js가 시스템 PATH에 설치되어 있는지 확인:
  ```bash
  node --version
  ```
- Visual Studio 출력 창에서 "QTN Language Server" 관련 오류 확인
- Visual Studio를 완전히 재시작

**.NET SDK 오류 (빌드 시)**

.NET SDK가 설치되어 있어야 합니다:
- https://dotnet.microsoft.com/download 에서 .NET SDK 6.0+ 다운로드

---

## 개발자 정보

- **저장소**: https://github.com/shlifedev/QtnLSP
- **라이선스**: MIT
- **최소 요구사항**:
  - VSCode 1.50+
  - JetBrains Rider 2022.3+
  - Visual Studio 2022 (17.0+)

### 추가 리소스

- QTN DSL 문법 레퍼런스: [DSL.md](DSL.md)
- 빌드 스크립트 옵션: [build.sh](../scripts/build.sh)
- 프로젝트 구조 및 개발 가이드: [CLAUDE.md](../CLAUDE.md)

---

## 피드백

문제가 발생하면 다음을 포함하여 보고하세요:

1. 설치 방법 (CLI / GUI / 빌드)
2. IDE 및 버전 (VSCode 버전 또는 Rider 버전)
3. 운영 체제 (Windows / macOS / Linux)
4. 오류 메시지 (IDE의 개발자 콘솔 출력)
