# Web Analyze Automation

対象URLを定期計測し、改善アクション候補まで自動出力する最小構成です。

## Setup

```bash
npm install
```

## Run

```bash
npm run analyze:web
```

改善適用（低リスクのみ）:

```bash
npm run improve:web
```

解析→改善を連続実行:

```bash
npm run autoloop:web
```

実行すると `reports/` に以下が出力されます。

- `lighthouse.report.json`: Lighthouse生データ
- `summary.md`: スコアサマリーと改善提案
- `actions.json`: 優先度付き改善アクション（機械可読）
- `latest-summary.md`, `latest-actions.json`: 最新実行の固定ファイル

## Target URL 変更

`analyze.config.json` の `url` を変更してください。

## Automation Example

GitHub Actions やスケジューラで `npm run analyze:web` を定期実行し、`reports/latest-summary.md` を Slack/Notion に通知すると改善サイクルを継続できます。
