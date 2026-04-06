import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const improveConfigPath = resolve(rootDir, "improve.config.json");
const latestActionsPath = resolve(rootDir, "reports", "latest-actions.json");

async function main() {
  const improveConfig = JSON.parse(await readFile(improveConfigPath, "utf8"));
  const actions = JSON.parse(await readFile(latestActionsPath, "utf8"));
  const htmlPath = resolve(rootDir, improveConfig.targetFile);

  let html = await readFile(htmlPath, "utf8");
  const changed = [];

  const hasMetaDescriptionAction = actions.some(
    (x) => x.auditId === "meta-description" || x.id === "meta-description"
  );

  if (hasMetaDescriptionAction && !/<meta\s+name=["']description["']/i.test(html)) {
    const metaTag = `    <meta name="description" content="${improveConfig.defaultMetaDescription}" />\n`;
    html = html.replace(/<title>[\s\S]*?<\/title>\s*\n/, (m) => `${m}${metaTag}`);
    changed.push("meta-description");
  }

  if (!changed.length) {
    process.stdout.write("No safe improvements were applicable.\n");
    return;
  }

  await writeFile(htmlPath, html, "utf8");
  process.stdout.write(`Applied improvements: ${changed.join(", ")}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
