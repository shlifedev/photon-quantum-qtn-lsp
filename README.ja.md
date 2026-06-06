<p align="center">
  <a href="README.md">English</a> | <a href="README.ko.md">한국어</a> | <a href="README.ja.md">日本語</a> | <a href="README.zh-TW.md">繁體中文</a>
</p>

# QtnLSP

Photon Quantum3 DSL(`.qtn`)ファイル向けのシンタックスハイライトとLSPベースのIntelliSense。

**VSCode**、**JetBrains Rider**、**Visual Studio 2022**に対応しています。

## 対応IDE

| IDE | バージョン |
|-----|-----------|
| VSCode | 1.50+ |
| JetBrains Rider | 2022.3+ |
| Visual Studio | 2022 (17.0+) |

## インストール

### VSCode
- **マーケットプレイス**: [Quantum DSL (QTN) Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.qtn-syntax-highlighting) — または VSCode の**拡張機能（Extensions）**ビューで `Quantum DSL (QTN)` を検索。
- **CLI**: `code --install-extension shlifedev.qtn-syntax-highlighting`

### Visual Studio 2022
- **マーケットプレイス**: [Quantum DSL (QTN) Language Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.QtnLanguageSupport) — または Visual Studio で **Extensions → Manage Extensions → Online** を開き `Quantum DSL (QTN)` を検索。

### JetBrains Rider
- [GitHub Releases](../../releases) から `QtnLSP-jetbrains.zip` をダウンロードし、**Settings → Plugins → ⚙ → Install Plugin from Disk**。_(マーケットプレイス登録予定)_

> 手動インストールをご希望の場合、すべてのビルドが [GitHub Releases](../../releases) に `.vsix` / `.zip` として添付されています。

## ビルド

[Docker](https://www.docker.com/)が必要です。その他のローカルツールチェーンは不要です。

```bash
sh build.sh all        # 同期 + テスト + 全プラグインビルド
sh build.sh vscode     # VSCode拡張のみ
sh build.sh jetbrains  # JetBrainsプラグインのみ
```

## スクリーンショット

<img src="sample.png" width="600" alt="QtnLSP スクリーンショット">

## ライセンス

MIT
