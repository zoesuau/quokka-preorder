import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_NAME = "project-identity.json";

function fail(message) {
  throw new Error(message);
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) fail(`必要檔案不存在：${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`專案身分缺少 ${label}`);
  return value.trim();
}

function extractQuotedProperty(source, property) {
  const expression = new RegExp(`${property}\\s*:\\s*["']([^"']+)["']`);
  const match = source.match(expression);
  if (!match) fail(`無法從 config.js 解析 ${property}`);
  return match[1];
}

function extractTitle(source, label) {
  const match = source.match(/<title>([^<]+)<\/title>/i);
  if (!match) fail(`${label} 缺少 title`);
  return match[1].trim();
}

function git(args, root) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function normalizeRemoteUrl(value) {
  return typeof value === "string" ? value.replace(/\.git\/?$/, "").replace(/\/$/, "") : value;
}

export function loadManifest(root = SCRIPT_ROOT) {
  const manifestPath = path.join(root, MANIFEST_NAME);
  let manifest;
  try {
    manifest = JSON.parse(readText(manifestPath));
  } catch (error) {
    fail(`無法解析 ${MANIFEST_NAME}：${error.message}`);
  }
  return manifest;
}

export function collectFileIdentity(root = SCRIPT_ROOT) {
  const manifest = loadManifest(root);
  const configFile = requireString(manifest.frontend?.configFile, "frontend.configFile");
  const indexFile = requireString(manifest.frontend?.indexFile, "frontend.indexFile");
  const adminFile = requireString(manifest.frontend?.adminFile, "frontend.adminFile");
  const config = readText(path.join(root, configFile));
  const index = readText(path.join(root, indexFile));
  const admin = readText(path.join(root, adminFile));
  return {
    brandName: extractQuotedProperty(config, "brandName"),
    backendUrl: extractQuotedProperty(config, "apiUrl"),
    liffId: extractQuotedProperty(config, "liffId"),
    indexTitle: extractTitle(index, indexFile),
    adminTitle: extractTitle(admin, adminFile),
  };
}

export function validateIdentity(manifest, actual, context = {}) {
  const errors = [];
  const same = (label, observed, expected) => {
    if (observed !== expected) errors.push(`${label} 不一致：實際 ${JSON.stringify(observed)}，預期 ${JSON.stringify(expected)}`);
  };

  if (manifest.schemaVersion !== 1) errors.push("schemaVersion 必須是 1");
  const required = [
    [manifest.projectId, "projectId"],
    [manifest.displayName, "displayName"],
    [manifest.repository?.slug, "repository.slug"],
    [manifest.repository?.remoteUrl, "repository.remoteUrl"],
    [manifest.repository?.productionBranch, "repository.productionBranch"],
    [manifest.deployment?.siteId, "deployment.siteId"],
    [manifest.deployment?.publicUrl, "deployment.publicUrl"],
    [manifest.frontend?.brandName, "frontend.brandName"],
    [manifest.backend?.webAppUrl, "backend.webAppUrl"],
    [manifest.backend?.datastoreBinding, "backend.datastoreBinding"],
    [manifest.identity?.liffId, "identity.liffId"],
  ];
  for (const [value, label] of required) {
    if (typeof value !== "string" || !value.trim()) errors.push(`缺少 ${label}`);
  }

  same("前端品牌", actual.brandName, manifest.frontend?.brandName);
  same("前台標題", actual.indexTitle, manifest.frontend?.indexTitle);
  same("後台標題", actual.adminTitle, manifest.frontend?.adminTitle);
  same("GAS 後端", actual.backendUrl, manifest.backend?.webAppUrl);
  same("LIFF", actual.liffId, manifest.identity?.liffId);

  if (context.gitRoot) same("Git repository root", path.resolve(context.gitRoot), path.resolve(context.expectedRoot));
  if (context.remoteUrl) same("Git origin", normalizeRemoteUrl(context.remoteUrl), normalizeRemoteUrl(manifest.repository?.remoteUrl));
  if (context.pushRemoteUrl) same("push remote", normalizeRemoteUrl(context.pushRemoteUrl), normalizeRemoteUrl(manifest.repository?.remoteUrl));
  if (context.githubRepository) same("GitHub repository", context.githubRepository, manifest.repository?.slug);

  if (context.boundary || context.deploy) {
    same("綁定 projectId", context.boundProjectId, manifest.projectId);
    same("綁定 repository", context.boundRepository, manifest.repository?.slug);
    same("綁定網址", context.boundPublicUrl, manifest.deployment?.publicUrl);
    same("綁定 GAS", context.boundBackendUrl, manifest.backend?.webAppUrl);
    same("綁定資料來源", context.boundDatastore, manifest.backend?.datastoreBinding);
    same("綁定 LIFF", context.boundLiffId, manifest.identity?.liffId);
  }

  if (context.deploy) {
    same("正式 branch", context.branch, manifest.repository?.productionBranch);
    if (context.githubEvent && context.githubEvent !== "push") errors.push(`正式部署只接受 push 事件，實際為 ${context.githubEvent}`);
    if (context.expectedSha && context.headSha !== context.expectedSha) errors.push("部署 SHA 與目前 HEAD 不一致");
    if (context.dirty) errors.push("工作樹不是乾淨狀態，禁止正式部署");
  }
  return errors;
}

function parseArgs(argv) {
  const options = { boundary: false, deploy: false, emit: "" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--deploy") options.deploy = true;
    else if (argv[index] === "--ci") options.boundary = true;
    else if (argv[index] === "--emit") options.emit = argv[++index] || "";
    else fail(`未知參數：${argv[index]}`);
  }
  return options;
}

export function runCli(argv = process.argv.slice(2), root = SCRIPT_ROOT) {
  const options = parseArgs(argv);
  const manifest = loadManifest(root);
  const actual = collectFileIdentity(root);
  const gitRoot = git(["rev-parse", "--show-toplevel"], root);
  const remoteUrl = git(["config", "--get", "remote.origin.url"], root);
  const headSha = git(["rev-parse", "HEAD"], root);
  const currentBranch = process.env.GITHUB_REF_NAME || git(["rev-parse", "--abbrev-ref", "HEAD"], root);
  const dirty = git(["status", "--porcelain"], root).length > 0;
  const context = {
    boundary: options.boundary,
    deploy: options.deploy,
    expectedRoot: root,
    gitRoot,
    remoteUrl,
    pushRemoteUrl: process.env.PROJECT_PUSH_REMOTE_URL || "",
    githubRepository: process.env.GITHUB_REPOSITORY || "",
    githubEvent: process.env.GITHUB_EVENT_NAME || "",
    branch: currentBranch,
    boundProjectId: process.env.BOUND_PROJECT_ID || "",
    boundRepository: process.env.BOUND_REPOSITORY || "",
    boundPublicUrl: process.env.BOUND_PUBLIC_URL || "",
    boundBackendUrl: process.env.BOUND_BACKEND_URL || "",
    boundDatastore: process.env.BOUND_DATASTORE || "",
    boundLiffId: process.env.BOUND_LIFF_ID || "",
    expectedSha: process.env.GITHUB_SHA || "",
    headSha,
    dirty,
  };
  const errors = validateIdentity(manifest, actual, context);
  if (errors.length) fail(`專案隔離驗證失敗：\n- ${errors.join("\n- ")}`);

  if (options.emit) {
    const outputPath = path.resolve(root, options.emit);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify({
      schemaVersion: 1,
      projectId: manifest.projectId,
      repository: manifest.repository.slug,
      commit: headSha,
      publicUrl: manifest.deployment.publicUrl,
      backendUrl: manifest.backend.webAppUrl,
      datastoreBinding: manifest.backend.datastoreBinding,
      liffId: manifest.identity.liffId,
    }, null, 2)}\n`);
  }
  process.stdout.write(`✓ 專案身分正確：${manifest.projectId} (${manifest.repository.slug})\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
