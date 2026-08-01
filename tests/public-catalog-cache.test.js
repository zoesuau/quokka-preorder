const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("Code.gs", "utf8");
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function createHarness(initialCache = "") {
  const cache = new Map();
  if (initialCache) cache.set("public-catalog-v2", initialCache);
  const cacheCalls = { get: 0, put: 0, remove: 0 };
  const lockCalls = { wait: 0, release: 0 };
  const reads = { products: 0, settings: 0 };
  const context = { console };
  vm.createContext(context);
  vm.runInContext(source, context);

  context.CacheService = {
    getScriptCache: () => ({
      get(key) {
        cacheCalls.get += 1;
        return cache.get(key) || null;
      },
      put(key, value, seconds) {
        cacheCalls.put += 1;
        assert.equal(seconds, 300);
        cache.set(key, value);
      },
      remove(key) {
        cacheCalls.remove += 1;
        cache.delete(key);
      },
    }),
  };
  context.LockService = {
    getScriptLock: () => ({
      waitLock() {
        lockCalls.wait += 1;
      },
      releaseLock() {
        lockCalls.release += 1;
      },
    }),
  };
  context.readSettings_ = () => {
    reads.settings += 1;
    return {
      exchangeRate: 0.022,
      preorderNotice: "測試公告",
      saleClosed: false,
      saleClosedNotice: "已結束",
      depositPercent: 50,
    };
  };
  context.readProducts_ = (settings) => {
    reads.products += 1;
    assert.equal(settings.exchangeRate, 0.022);
    return [
      { id: "active", name: "上架商品", active: true },
      { id: "inactive", name: "下架商品", active: false },
    ];
  };
  context.setupQuokkaPreorder = () => {
    throw new Error("公開目錄不可執行初始化");
  };
  context.json_ = (payload) => payload;
  return { context, cache, cacheCalls, lockCalls, reads };
}

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `找不到 ${name}`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test("快取未命中時只讀一次商品與設定，並建立五分鐘快取", () => {
  const harness = createHarness();
  const result = harness.context.handleReadPublicCatalog_();

  assert.equal(result.ok, true);
  assert.deepEqual(
    Array.from(result.products, (product) => product.id),
    ["active"],
  );
  assert.equal(harness.reads.settings, 1);
  assert.equal(harness.reads.products, 1);
  assert.equal(harness.cacheCalls.put, 1);
  assert.equal(harness.lockCalls.wait, 1);
  assert.equal(harness.lockCalls.release, 1);
});

test("快取命中時不讀試算表也不取得鎖", () => {
  const payload = {
    ok: true,
    products: [{ id: "cached", active: true }],
    settings: { depositPercent: 50 },
  };
  const harness = createHarness(JSON.stringify(payload));
  const result = harness.context.handleReadPublicCatalog_();

  assert.equal(result.products[0].id, "cached");
  assert.equal(harness.reads.settings, 0);
  assert.equal(harness.reads.products, 0);
  assert.equal(harness.cacheCalls.put, 0);
  assert.equal(harness.lockCalls.wait, 0);
});

test("快取失效會移除公開目錄", () => {
  const harness = createHarness(JSON.stringify({ ok: true }));
  harness.context.invalidatePublicCatalogCache_();

  assert.equal(harness.cache.has("public-catalog-v2"), false);
  assert.equal(harness.cacheCalls.remove, 1);
});

test("公開讀取不再執行 setup，商品與設定更新會清除快取", () => {
  assert.doesNotMatch(
    functionSource("handleReadPublicCatalog_"),
    /setupQuokkaPreorder\s*\(/,
  );
  [
    "handleAdminSaveProduct_",
    "handleAdminToggleProduct_",
    "handleAdminUpdateProductStock_",
    "handleAdminSaveSettings_",
  ].forEach((name) => {
    assert.match(
      functionSource(name),
      /invalidatePublicCatalogCache_\s*\(/,
      `${name} 必須清除公開目錄快取`,
    );
  });
});

console.log(`\n${passed} public catalog cache tests passed.`);
