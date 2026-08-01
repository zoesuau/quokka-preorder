const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const context = {
  console,
  crypto: crypto.webcrypto,
  URL,
  window: { confirm() { return false; } },
  document: { addEventListener() {}, getElementById() { throw new Error("DOM_NOT_AVAILABLE_IN_PURE_TEST"); } },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("stress-test.js", "utf8"), context);
const html = fs.readFileSync("stress-test.html", "utf8");
const storefront = fs.readFileSync("storefront.js", "utf8");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

const product = { productId: "p1", variant: "紅", qty: 1 };

test("獨立頁提供正式流程模擬按鈕且仍未載入正式 config", () => {
  assert.match(html, /id="formalSimulationTest"/);
  assert.doesNotMatch(html, /src="config\.js/);
});

test("測試筆數輸入硬性限制為 20", () => {
  const target = { value: "99" };
  context.enforceRequestLimit({ target });
  assert.equal(target.value, "20");
});

test("壓測 payload 沿用正式欄位並加入 testMode 與唯一識別碼", () => {
  const payloads = context.buildPayloads(20, product);
  assert.equal(payloads.length, 20);
  assert.equal(new Set(payloads.map((entry) => entry.testRequestId)).size, 20);
  payloads.forEach((entry, index) => {
    assert.equal(entry.action, "createPreorder");
    assert.equal(entry.idToken, "TEST_MODE_NO_LINE_TOKEN");
    assert.equal(entry.testMode, true);
    assert.match(entry.testRequestId, /^LOAD-\d{8}-\d{6}-[A-Z0-9]{4}-\d{3}$/);
    assert.equal(entry.customerName, `壓測測試${String(index + 1).padStart(3, "0")}`);
    assert.match(entry.phone, /^090000\d{4}$/);
    assert.match(entry.note, /TEST MODE/);
    assert.match(entry.note, /不得通知/);
    assert.match(entry.note, /不得出貨/);
    assert.deepEqual(JSON.parse(JSON.stringify(entry.items)), [product]);
  });
});

test("重複請求測試會建立兩份相同 testRequestId 的獨立 payload", () => {
  const payloads = context.buildDuplicatePayloads(product);
  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].testRequestId, payloads[1].testRequestId);
  assert.notEqual(payloads[0], payloads[1]);
  assert.notEqual(payloads[0].items, payloads[1].items);
});

test("正式流程模擬 payload 共用 runId 並固定測試最後一件庫存", () => {
  const payloads = context.buildFormalSimulationPayloads(20, product);
  assert.equal(payloads.length, 20);
  assert.equal(new Set(payloads.map((entry) => entry.testRequestId)).size, 20);
  assert.equal(new Set(payloads.map((entry) => entry.simulationRunId)).size, 1);
  payloads.forEach((entry) => {
    assert.equal(entry.action, "createPreorder");
    assert.equal(entry.testMode, true);
    assert.equal(entry.formalSimulationMode, true);
    assert.equal(entry.simulatedStockLimit, 1);
    assert.match(entry.simulationRunId, /^SIMRUN-\d{8}-\d{6}-[A-Z0-9]{4}$/);
  });
});

test("非 HTTPS 外部網址會被拒絕，localhost HTTP 可供本機測試", () => {
  assert.throws(() => context.normalizeTestUrl("http://example.com/test"), /TEST_URL_MUST_USE_HTTPS/);
  assert.match(context.normalizeTestUrl("http://127.0.0.1:8080/mock"), /^http:\/\/127\.0\.0\.1:8080/);
  assert.match(context.normalizeTestUrl("https://script.google.com/macros/s/test/exec"), /^https:/);
});

test("安全握手缺少任一隔離旗標時會拒絕開始", () => {
  const safe = {
    testMode: true,
    stressTestSupported: true,
    maxRequests: 20,
    isolatedSheet: "壓力測試訂單",
    safetySnapshot: { preorders: {}, products: {} },
    safeguards: {
      customerLineNotifications: false,
      adminLineNotifications: false,
      inventoryMutation: false,
      formalOrderCreation: false,
      formalOrderNumberCreation: false,
      scheduledWorkflowEnrollment: false,
    },
  };
  assert.doesNotThrow(() => context.validateHandshake(safe, 20));
  const unsafe = JSON.parse(JSON.stringify(safe));
  unsafe.safeguards.customerLineNotifications = true;
  assert.throws(() => context.validateHandshake(unsafe, 20), /UNSAFE_OR_UNSUPPORTED_BACKEND/);
  const missingTestMode = JSON.parse(JSON.stringify(safe));
  delete missingTestMode.testMode;
  assert.throws(() => context.validateHandshake(missingTestMode, 20), /UNSAFE_OR_UNSUPPORTED_BACKEND/);
});

test("正式流程模擬握手必須揭露覆蓋範圍與安全能力", () => {
  const safe = {
    testMode: true,
    formalSimulationMode: true,
    formalSimulationSupported: true,
    maxRequests: 20,
    isolatedSheet: "正式流程模擬訂單",
    safetySnapshot: { preorders: {}, products: {} },
    safeguards: {
      customerLineNotifications: false,
      adminLineNotifications: false,
      inventoryMutation: false,
      formalOrderCreation: false,
      scheduledWorkflowEnrollment: false,
    },
    formalFlowCoverage: {
      scriptLockWaitMs: 30000,
      formalOrderNumberGenerator: "createOrderNo_",
      linePush: false,
      formalPreordersWrite: false,
    },
    observedFormalRisks: {
      inventoryDeductionImplemented: true,
      requestIdempotencyImplemented: true,
    },
  };
  assert.doesNotThrow(() => context.validateFormalSimulationHandshake(safe, 20));
  const unsafe = JSON.parse(JSON.stringify(safe));
  unsafe.formalFlowCoverage.linePush = true;
  assert.throws(() => context.validateFormalSimulationHandshake(unsafe, 20), /UNSAFE_OR_UNSUPPORTED_FORMAL_SIMULATION/);
});

test("正式前端會保存 requestId 並在相同 payload 重送時沿用", () => {
  assert.match(storefront, /payload\.requestId = getOrCreateOrderRequestId\(payload\)/);
  assert.match(storefront, /quokka-pending-order-request-v1/);
  assert.match(storefront, /pending\.fingerprint === fingerprint/);
  assert.match(storefront, /sessionStorage\.setItem/);
  assert.match(storefront, /clearPendingOrderRequest\(\)/);
  assert.match(storefront, /OUT_OF_STOCK/);
  assert.match(storefront, /LOCK_TIMEOUT/);
});

console.log(`\n${passed} 個壓力測試前端案例全部通過`);
