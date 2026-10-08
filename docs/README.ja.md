<p align="center">
  <a href="../README.md">English</a> | <a href="README.ko.md">한국어</a> | <a href="README.ja.md">日本語</a> | <a href="README.zh-TW.md">繁體中文</a>
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

Visual Studio と Rider の拡張には QTN IntelliSense 用の Node.js ランタイムが含まれています。Node.js の別途インストールや PATH 設定は不要で、拡張の起動時にもダウンロードしません。VSCode は内蔵ランタイムを使用します。

### VSCode
- **マーケットプレイス**: [Quantum DSL (QTN) Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.qtn-syntax-highlighting) — または VSCode の**拡張機能（Extensions）**ビューで `Quantum DSL (QTN)` を検索。
- **CLI**: `code --install-extension shlifedev.qtn-syntax-highlighting`

### Visual Studio 2022
- **マーケットプレイス**: [Quantum DSL (QTN) Language Support](https://marketplace.visualstudio.com/items?itemName=shlifedev.QtnLanguageSupport) — または Visual Studio で **Extensions → Manage Extensions → Online** を開き `Quantum DSL (QTN)` を検索。

### JetBrains Rider
- [GitHub Releases](https://github.com/shlifedev/photon-quantum-qtn-lsp/releases) から `QtnLSP-jetbrains.zip` をダウンロードし、**Settings → Plugins → ⚙ → Install Plugin from Disk**。_(マーケットプレイス登録予定)_

> 手動インストールをご希望の場合、すべてのビルドが [GitHub Releases](https://github.com/shlifedev/photon-quantum-qtn-lsp/releases) に `.vsix` / `.zip` として添付されています。

## ビルド

[Docker](https://www.docker.com/)が必要です。その他のローカルツールチェーンは不要です。

ローカルでソースからビルドする場合は Node.js 22 を使用します。VS・Rider のビルド時にチェックサムを固定した Node.js 22.23.3 を取得します。ランタイム同梱により配布ファイルのサイズが増えます。[パッケージの検証手順](RUNTIME_PACKAGING.md)。

```bash
sh scripts/build.sh all        # 同期 + テスト + 全プラグインビルド
sh scripts/build.sh vscode     # VSCode拡張のみ
sh scripts/build.sh jetbrains  # JetBrainsプラグインのみ
```

## スクリーンショット

<img src="images/sample.png" width="600" alt="QtnLSP スクリーンショット">

## ライセンス

MIT
