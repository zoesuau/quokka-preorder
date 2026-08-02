import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "project-identity.json"), "utf8"));

function get(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "User-Agent": "quokka-project-identity-check" } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        resolve(get(new URL(response.headers.location, url).toString()));
        return;
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode !== 200) reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        else resolve(body);
      });
    });
    request.setTimeout(15000, () => request.destroy(new Error(`逾時：${url}`)));
    request.on("error", reject);
  });
}

function expectedSha(argv) {
  const index = argv.indexOf("--expected-sha");
  if (index < 0 || !argv[index + 1]) throw new Error("缺少 --expected-sha");
  return argv[index + 1];
}

async function verify(sha) {
  const cacheBust = encodeURIComponent(sha);
  const base = manifest.deployment.publicUrl;
  const [identityText, indexText, configText] = await Promise.all([
    get(`${base}deployment-identity.json?v=${cacheBust}`),
    get(`${base}index.html?v=${cacheBust}`),
    get(`${base}config.js?v=${cacheBust}`),
  ]);
  const identity = JSON.parse(identityText);
  const checks = [
    [identity.projectId, manifest.projectId, "projectId"],
    [identity.repository, manifest.repository.slug, "repository"],
    [identity.commit, sha, "commit"],
    [identity.publicUrl, manifest.deployment.publicUrl, "publicUrl"],
    [identity.backendUrl, manifest.backend.webAppUrl, "backendUrl"],
    [identity.datastoreBinding, manifest.backend.datastoreBinding, "datastoreBinding"],
    [identity.liffId, manifest.identity.liffId, "liffId"],
  ];
  for (const [actual, expected, label] of checks) {
    if (actual !== expected) throw new Error(`線上 ${label} 不一致`);
  }
  if (!indexText.includes(`<title>${manifest.frontend.indexTitle}</title>`)) throw new Error("線上前台標題不一致");
  if (!configText.includes(manifest.frontend.brandName)) throw new Error("線上品牌不一致");
  if (!configText.includes(manifest.backend.webAppUrl)) throw new Error("線上 GAS 不一致");
  if (!configText.includes(manifest.identity.liffId)) throw new Error("線上 LIFF 不一致");
}

const sha = expectedSha(process.argv.slice(2));
let lastError;
for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    await verify(sha);
    process.stdout.write(`✓ 線上專案身分正確：${manifest.projectId} @ ${sha}\n`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < 12) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
throw lastError;
