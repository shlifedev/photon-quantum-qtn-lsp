<p align="center">
  <a href="../README.md">English</a> | <a href="README.ko.md">한국어</a> | <a href="README.ja.md">日本語</a> | <a href="README.zh-TW.md">繁體中文</a>
</p>

# QtnLSP

Photon Quantum3 DSL(`.qtn`) 파일을 위한 구문 강조 및 LSP 기반 IntelliSense.

**VSCode**, **JetBrains Rider**, **Visual Studio 2022**를 지원합니다.

## 지원 IDE

| IDE | 버전 |
|-----|------|
| VSCode | 1.50+ |
| JetBrains Rider | 2022.3+ |
| Visual Studio | 2022 (17.0+) |

## 설치

Visual Studio와 Rider 확장에는 QTN IntelliSense용 Node.js 런타임이 포함됩니다. 별도 Node.js 설치나 PATH 설정이 필요 없으며, 확장 실행 시 런타임을 다운로드하지 않습니다. VSCode는 내장 런타임을 사용합니다.

### VSCode
- **마켓플레이스**: [Quantum DSL (QTN) Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.qtn-syntax-highlighting) — 또는 VSCode **확장(Extensions)** 뷰에서 `Quantum DSL (QTN)` 검색.
- **CLI**: `code --install-extension shlifedev.qtn-syntax-highlighting`

### Visual Studio 2022
- **마켓플레이스**: [Quantum DSL (QTN) Language Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.QtnLanguageSupport) — 또는 Visual Studio에서 **Extensions → Manage Extensions → Online**으로 들어가 `Quantum DSL (QTN)` 검색.

### JetBrains Rider
- [GitHub Releases](https://github.com/shlifedev/photon-quantum-qtn-lsp/releases)에서 `QtnLSP-jetbrains.zip`를 받은 뒤 **Settings → Plugins → ⚙ → Install Plugin from Disk**. _(마켓플레이스 등록 예정)_

> 수동 설치를 원하면 모든 빌드가 [GitHub Releases](https://github.com/shlifedev/photon-quantum-qtn-lsp/releases)에 `.vsix` / `.zip`으로 첨부돼 있습니다.

## 빌드

[Docker](https://www.docker.com/) 필요. 그 외 로컬 툴체인은 불필요합니다.
로컬 Node 기반 개발은 CI와 같은 Node.js 22를 사용합니다. VS·Rider 빌드는 체크섬으로 고정한 Node.js 22.23.3을 다운로드하며, 런타임 포함으로 배포 파일 용량이 증가합니다. [런타임 패키징·검증](RUNTIME_PACKAGING.md)을 참고하세요.

```bash
sh scripts/build.sh all        # 동기화 + 테스트 + 전체 빌드
sh scripts/build.sh vscode     # VSCode 확장만
sh scripts/build.sh jetbrains  # JetBrains 플러그인만
```

## 스크린샷

<img src="images/sample.png" width="600" alt="QtnLSP 스크린샷">

## 라이선스

MIT
