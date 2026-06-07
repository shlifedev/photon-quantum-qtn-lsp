<p align="center">
  <a href="README.md">English</a> | <a href="README.ko.md">한국어</a> | <a href="README.ja.md">日本語</a> | <a href="README.zh-TW.md">繁體中文</a>
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

### VSCode
- **마켓플레이스**: [Quantum DSL (QTN) Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.qtn-syntax-highlighting) — 또는 VSCode **확장(Extensions)** 뷰에서 `Quantum DSL (QTN)` 검색.
- **CLI**: `code --install-extension shlifedev.qtn-syntax-highlighting`

### Visual Studio 2022
- **마켓플레이스**: [Quantum DSL (QTN) Language Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.QtnLanguageSupport) — 또는 Visual Studio에서 **Extensions → Manage Extensions → Online**으로 들어가 `Quantum DSL (QTN)` 검색.

### JetBrains Rider
- [GitHub Releases](../../releases)에서 `QtnLSP-jetbrains.zip`를 받은 뒤 **Settings → Plugins → ⚙ → Install Plugin from Disk**. _(마켓플레이스 등록 예정)_

> 수동 설치를 원하면 모든 빌드가 [GitHub Releases](../../releases)에 `.vsix` / `.zip`으로 첨부돼 있습니다.

## 빌드

[Docker](https://www.docker.com/) 필요. 그 외 로컬 툴체인은 불필요합니다.
로컬 Node 기반 개발은 CI와 같은 Node.js 20 사용을 권장합니다.

```bash
sh build.sh all        # 동기화 + 테스트 + 전체 빌드
sh build.sh vscode     # VSCode 확장만
sh build.sh jetbrains  # JetBrains 플러그인만
```

## 스크린샷

<img src="sample.png" width="600" alt="QtnLSP 스크린샷">

## 라이선스

MIT
