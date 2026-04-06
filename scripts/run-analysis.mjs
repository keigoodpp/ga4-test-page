import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const configPath = resolve(rootDir, "analyze.config.json");
const reportsDir = resolve(rootDir, "reports");

function toPercent(score) {
  return Math.round((score ?? 0) * 100);
}

function buildActions(result) {
  const audits = result.audits ?? {};
  const actions = [];

  const pushAction = (id, auditId, why, nextStep, priority = "medium") => {
    const audit = audits[auditId];
    if (!audit || audit.score === null || audit.score >= 0.9) {
      return;
    }

    actions.push({
      id,
      priority,
      auditId,
      score: audit.score,
      title: audit.title,
      why,
      nextStep
    });
  };

  pushAction(
    "eliminate-render-blocking-resources",
    "render-blocking-resources",
    "描画を遅らせるCSS/JSがあるとLCPが悪化しやすい。",
    "クリティカルCSSをインライン化し、残りは遅延読込にする。",
    "high"
  );
  pushAction(
    "modern-image-formats",
    "modern-image-formats",
    "画像最適化は最も改善インパクトが出やすい。",
    "WebP/AVIF配信とサイズ最適化を行う。",
    "high"
  );
  pushAction(
    "unused-javascript",
    "unused-javascript",
    "未使用JSは初回表示とINPの両方に悪影響。",
    "不要コード削減と遅延ロードを実施する。",
    "high"
  );
  pushAction(
    "document-has-title",
    "document-title",
    "検索結果と共有時のCTRに直結する。",
    "ページ意図に沿った固有タイトルを設定する。"
  );
  pushAction(
    "meta-description",
    "meta-description",
    "メタ説明不足は検索スニペット最適化機会を失う。",
    "120文字前後で価値訴求を含む説明文を設定する。"
  );
  pushAction(
    "color-contrast",
    "color-contrast",
    "コントラスト不足は可読性とアクセシビリティを損なう。",
    "文字と背景のコントラスト比をWCAG基準まで上げる。",
    "high"
  );

  return actions.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function buildMarkdownSummary({ finalUrl, categories, actions, thresholds }) {
  const lines = [];
  const categoryRows = [
    ["Performance", categories.performance?.score, thresholds.performance],
    ["Accessibility", categories.accessibility?.score, thresholds.accessibility],
    ["Best Practices", categories["best-practices"]?.score, thresholds.bestPractices],
    ["SEO", categories.seo?.score, thresholds.seo]
  ];

  lines.push("# Web Analyze Report");
  lines.push("");
  lines.push(`- Target URL: ${finalUrl}`);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Score Summary");
  lines.push("");
  for (const [name, score, threshold] of categoryRows) {
    const val = toPercent(score);
    const pass = (score ?? 0) >= threshold ? "PASS" : "FAIL";
    lines.push(`- ${name}: ${val} (${pass}, threshold ${toPercent(threshold)})`);
  }
  lines.push("");
  lines.push("## Suggested Improvements");
  lines.push("");

  if (!actions.length) {
    lines.push("- 主要な監査項目は閾値を満たしています。");
  } else {
    for (const action of actions) {
      lines.push(
        `- [${action.priority}] ${action.title}: ${action.why} 次アクション: ${action.nextStep}`
      );
    }
  }

  lines.push("");
  lines.push("## Next Step");
  lines.push("");
  lines.push("- 低リスク項目（meta, 画像圧縮, 遅延読込）からPR化して比較検証する。");
  return lines.join("\n");
}

async function main() {
  const configRaw = await readFile(configPath, "utf8");
  const config = JSON.parse(configRaw);
  const targetUrl = config.url;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = resolve(reportsDir, timestamp);
  const lighthouseJsonPath = resolve(runDir, "lighthouse.report.json");
  const summaryMdPath = resolve(runDir, "summary.md");
  const actionsJsonPath = resolve(runDir, "actions.json");
  const latestSummaryPath = resolve(reportsDir, "latest-summary.md");
  const latestActionsPath = resolve(reportsDir, "latest-actions.json");

  await mkdir(runDir, { recursive: true });

  const cmd = [
    "npx lighthouse",
    `"${targetUrl}"`,
    "--quiet",
    "--chrome-flags=--headless=new",
    "--only-categories=performance,accessibility,best-practices,seo",
    "--output=json",
    `--output-path=\"${lighthouseJsonPath}\"`
  ].join(" ");

  await execAsync(cmd, {
    cwd: rootDir,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 10
  });

  const lighthouseRaw = await readFile(lighthouseJsonPath, "utf8");
  const report = JSON.parse(lighthouseRaw);
  const categories = report.categories ?? {};
  const actions = buildActions(report);
  const summary = buildMarkdownSummary({
    finalUrl: report.finalUrl ?? targetUrl,
    categories,
    actions,
    thresholds: config.thresholds
  });

  await writeFile(summaryMdPath, summary, "utf8");
  await writeFile(actionsJsonPath, JSON.stringify(actions, null, 2), "utf8");
  await writeFile(latestSummaryPath, summary, "utf8");
  await writeFile(latestActionsPath, JSON.stringify(actions, null, 2), "utf8");

  process.stdout.write(`Done: ${summaryMdPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
