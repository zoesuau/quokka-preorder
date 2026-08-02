const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

(async () => {
  const modulePath = pathToFileURL(path.resolve("scripts/verify-project-identity.mjs")).href;
  const { collectFileIdentity, loadManifest, validateIdentity } = await import(modulePath);
  const manifest = loadManifest(process.cwd());
  const actual = collectFileIdentity(process.cwd());
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const baseContext = {
    expectedRoot: process.cwd(),
    gitRoot: process.cwd(),
    remoteUrl: manifest.repository.remoteUrl,
    githubRepository: manifest.repository.slug,
  };

  assert.deepEqual(validateIdentity(manifest, actual, baseContext), []);

  const cases = [
    ["其他 repository", { ...baseContext, remoteUrl: "https://github.com/example/another-project.git" }],
    ["其他 GitHub repository", { ...baseContext, githubRepository: "example/another-project" }],
    ["其他品牌", baseContext, { ...actual, brandName: "另一個專案" }],
    ["其他 GAS", baseContext, { ...actual, backendUrl: "https://script.google.com/macros/s/OTHER/exec" }],
    ["其他 LIFF", baseContext, { ...actual, liffId: "0000000000-OTHER" }],
    ["其他前台標題", baseContext, { ...actual, indexTitle: "另一個專案" }],
    ["其他後台標題", baseContext, { ...actual, adminTitle: "另一個後台" }],
  ];
  for (const [label, context, changedActual = actual] of cases) {
    assert.ok(validateIdentity(manifest, changedActual, context).length > 0, `${label} 必須被阻擋`);
  }

  const deployContext = {
    ...baseContext,
    deploy: true,
    branch: manifest.repository.productionBranch,
    boundProjectId: manifest.projectId,
    boundRepository: manifest.repository.slug,
    boundPublicUrl: manifest.deployment.publicUrl,
    boundBackendUrl: manifest.backend.webAppUrl,
    boundDatastore: manifest.backend.datastoreBinding,
    boundLiffId: manifest.identity.liffId,
    githubEvent: "push",
    expectedSha: "abc123",
    headSha: "abc123",
    dirty: false,
  };
  assert.deepEqual(validateIdentity(manifest, actual, deployContext), []);
  for (const [field, value] of [
    ["branch", "other"],
    ["boundProjectId", "other"],
    ["boundRepository", "example/other"],
    ["boundPublicUrl", "https://example.com/"],
    ["boundBackendUrl", "https://script.google.com/macros/s/OTHER/exec"],
    ["boundDatastore", "backend-bound:other"],
    ["boundLiffId", "0000000000-OTHER"],
    ["githubEvent", "workflow_dispatch"],
    ["headSha", "different"],
    ["dirty", true],
  ]) {
    const changed = clone(deployContext);
    changed[field] = value;
    assert.ok(validateIdentity(manifest, actual, changed).length > 0, `部署欄位 ${field} 不一致時必須被阻擋`);
  }

  const verifierSource = fs.readFileSync("scripts/verify-project-identity.mjs", "utf8");
  assert.equal(/Echo|echo-line|特定品牌/.test(verifierSource), false, "防線不得依賴特定外部品牌黑名單");
  console.log("✓ 19 個專案隔離與錯誤部署阻擋案例通過");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
