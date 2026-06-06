<p align="center">
  <a href="README.md">English</a> | <a href="README.ko.md">한국어</a> | <a href="README.ja.md">日本語</a> | <a href="README.zh-TW.md">繁體中文</a>
</p>

# QtnLSP

Photon Quantum3 DSL(`.qtn`)檔案的語法高亮與基於LSP的IntelliSense。

支援 **VSCode**、**JetBrains Rider** 和 **Visual Studio 2022**。

## 支援的IDE

| IDE | 版本 |
|-----|------|
| VSCode | 1.50+ |
| JetBrains Rider | 2022.3+ |
| Visual Studio | 2022 (17.0+) |

## 安裝

### VSCode
- **市集（Marketplace）**：[Quantum DSL (QTN) Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.qtn-syntax-highlighting) — 或在 VSCode 的**擴充功能（Extensions）**檢視中搜尋 `Quantum DSL (QTN)`。
- **CLI**：`code --install-extension shlifedev.qtn-syntax-highlighting`

### Visual Studio 2022
- **市集（Marketplace）**：[Quantum DSL (QTN) Language Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.QtnLanguageSupport) — 或在 Visual Studio 中開啟 **Extensions → Manage Extensions → Online** 並搜尋 `Quantum DSL (QTN)`。

### JetBrains Rider
- 從 [GitHub Releases](../../releases) 下載 `QtnLSP-jetbrains.zip`，然後 **Settings → Plugins → ⚙ → Install Plugin from Disk**。_(市集上架即將推出)_

> 若偏好手動安裝，所有建置版本皆以 `.vsix` / `.zip` 形式附加於 [GitHub Releases](../../releases)。

## 建置

需要 [Docker](https://www.docker.com/)。無需其他本地工具鏈。

```bash
sh build.sh all        # 同步 + 測試 + 建置所有外掛
sh build.sh vscode     # 僅 VSCode 擴充功能
sh build.sh jetbrains  # 僅 JetBrains 外掛
```

## 截圖

<img src="sample.png" width="600" alt="QtnLSP 截圖">

## 授權

MIT
