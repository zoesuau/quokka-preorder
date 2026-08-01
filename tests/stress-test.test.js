const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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

class MockRange {
  constructor(sheet, row, column, rowCount = 1, columnCount = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }

  getValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        this.sheet.valueAt(this.row + rowOffset, this.column + columnOffset),
      ),
    );
  }

  getDisplayValues() {
    return this.getValues().map((row) => row.map(displayValue));
  }

  getValue() { return this.getValues()[0][0]; }
  getDisplayValue() { return this.getDisplayValues()[0][0]; }

  setValues(values) {
    values.forEach((row, rowOffset) => {
      row.forEach((value, columnOffset) => {
        this.sheet.setValueAt(this.row + rowOffset, this.column + columnOffset, value);
      });
    });
    return this;
  }

  setValue(value) {
    this.sheet.setValueAt(this.row, this.column, value);
    return this;
  }
}

class MockSheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
    this.failNextAppend = false;
  }

  getLastRow() {
    for (let index = this.rows.length - 1; index >= 0; index -= 1) {
      if (this.rows[index].some((value) => value !== "" && value !== null && value !== undefined)) return index + 1;
    }
    return 0;
  }

  getRange(row, column, rowCount = 1, columnCount = 1) {
    return new MockRange(this, row, column, rowCount, columnCount);
  }

  appendRow(row) {
    if (this.failNextAppend) {
      this.failNextAppend = false;
      throw new Error("MOCK_APPEND_FAILED");
    }
    this.rows.push(row.slice());
    return this;
  }

  deleteRow(row) {
    this.rows.splice(row - 1, 1);
    return this;
  }

  setFrozenRows() {}

  valueAt(row, column) {
    return (this.rows[row - 1] || [])[column - 1] ?? "";
  }

  setValueAt(row, column, value) {
    while (this.rows.length < row) this.rows.push([]);
    while (this.rows[row - 1].length < column) this.rows[row - 1].push("");
    this.rows[row - 1][column - 1] = value;
  }
}

class MockSpreadsheet {
  constructor() { this.sheets = new Map(); }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) {
    const sheet = new MockSheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }
  addSheet(sheet) { this.sheets.set(sheet.name, sheet); }
}

function displayValue(value) {
  if (value === true) return "TRUE";
  if (value === false) return "FALSE";
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

function formatDate(date, pattern) {
  const pad = (value) => String(value).padStart(2, "0");
  const parts = {
    yyyy: String(date.getUTCFullYear()),
    yy: String(date.getUTCFullYear()).slice(-2),
    MM: pad(date.getUTCMonth() + 1),
    dd: pad(date.getUTCDate()),
    HH: pad(date.getUTCHours()),
    mm: pad(date.getUTCMinutes()),
    ss: pad(date.getUTCSeconds()),
  };
  return pattern.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, (token) => parts[token]);
}

function createHarness(enabled = true) {
  const properties = { ENABLE_STRESS_TEST_MODE: enabled ? "true" : "false" };
  const spreadsheet = new MockSpreadsheet();
  let uuidCounter = 0;
  let lineCalls = 0;
  let lockDepth = 0;
  const waitLockTimes = [];
  const context = {
    console: { log() {}, warn() {}, error() {} },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(text) {
        return { text, setMimeType() { return this; } };
      },
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock(timeout) {
            assert.equal(lockDepth, 0);
            waitLockTimes.push(timeout);
            lockDepth += 1;
          },
          releaseLock() { assert.equal(lockDepth, 1); lockDepth -= 1; },
        };
      },
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) { return properties[key] || ""; },
          setProperty(key, value) { properties[key] = value; },
        };
      },
    },
    CacheService: {
      getScriptCache() {
        return {
          get() { return null; },
          put() {},
          remove() {},
          removeAll() {},
        };
      },
    },
    SpreadsheetApp: { getActiveSpreadsheet() { return spreadsheet; } },
    Session: { getScriptTimeZone() { return "Asia/Taipei"; } },
    Utilities: {
      getUuid() {
        uuidCounter += 1;
        const prefix = `${uuidCounter.toString(16).padStart(6, "0")}00`;
        return `${prefix}-aaaa-bbbb-cccc-1234567890ab`;
      },
      formatDate(date, _timezone, pattern) { return formatDate(date, pattern); },
      computeDigest(_algorithm, value) {
        return [...crypto.createHash("sha256").update(String(value)).digest()].map((byte) => byte > 127 ? byte - 256 : byte);
      },
      DigestAlgorithm: { SHA_256: "SHA_256" },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const productHeader = Array.from(context.PRODUCT_HEADERS_);
  const orderHeader = Array.from(context.ORDER_HEADERS_);
  spreadsheet.addSheet(new MockSheet("Products", [
    productHeader,
    ["p1", "測試商品", "測試分類", "https://example.com/item.jpg", 1000, "紅\n藍", "測試", "上架", 1, "2026-08-01 00:00:00", "2026-08-01 00:00:00", 200, 5, "[]"],
  ]));
  spreadsheet.addSheet(new MockSheet("Preorders", [orderHeader]));
  context.pushLineMessage_ = () => {
    assert.equal(lockDepth, 0, "LINE 呼叫不可放在 Script Lock 內");
    lineCalls += 1;
    return true;
  };
  context.verifyLineIdToken_ = () => ({ sub: "U-FORMAL-TEST", name: "正式測試" });

  return {
    context,
    spreadsheet,
    properties,
    get lineCalls() { return lineCalls; },
    get lockDepth() { return lockDepth; },
    get waitLockTimes() { return waitLockTimes.slice(); },
    post(payload) {
      const output = context.doPost({ postData: { contents: JSON.stringify(payload) } });
      return JSON.parse(output.text);
    },
  };
}

function productionPayload(requestId = "ORDER-20260801-203015-A7K2M9QX") {
  return {
    action: "createPreorder",
    requestId,
    idToken: "FORMAL_TEST_TOKEN",
    lineDisplayName: "正式測試",
    customerName: "正式測試",
    phone: "0900000001",
    note: "正式流程單元測試",
    items: [{ productId: "p1", variant: "紅", qty: 1 }],
  };
}

function payload(testRequestId = "LOAD-20260801-203015-A7K2-001") {
  return {
    action: "createPreorder",
    idToken: "TEST_MODE_NO_LINE_TOKEN",
    lineDisplayName: "壓測測試001",
    customerName: "壓測測試001",
    phone: "0900000001",
    note: "TEST MODE，不得通知、不得出貨；壓力測試資料，禁止出貨",
    items: [{ productId: "p1", variant: "紅", qty: 1 }],
    testMode: true,
    testRequestId,
  };
}

function formalSimulationPayload(
  testRequestId = "LOAD-20260801-203015-F0RM-001",
  simulationRunId = "SIMRUN-20260801-203015-F0RM",
  simulatedStockLimit = 1,
) {
  return Object.assign(payload(testRequestId), {
    formalSimulationMode: true,
    simulationRunId,
    simulatedStockLimit,
  });
}

test("商品讀取與金額準備在 Script Lock 外完成", () => {
  const harness = createHarness();
  const originalReadSettings = harness.context.readSettings_;
  const originalReadProducts = harness.context.readProducts_;
  harness.context.readSettings_ = function () {
    assert.equal(harness.lockDepth, 0, "讀取設定不可占用 Script Lock");
    return originalReadSettings.apply(this, arguments);
  };
  harness.context.readProducts_ = function () {
    assert.equal(harness.lockDepth, 0, "讀取商品不可占用 Script Lock");
    return originalReadProducts.apply(this, arguments);
  };

  const result = harness.post(payload());
  assert.equal(result.success, true);
});

test("正式流程模擬握手明確揭露已實作的正式安全能力", () => {
  const harness = createHarness();
  const result = harness.post({
    action: "formalSimulationHandshake",
    testMode: true,
  });
  assert.equal(result.success, true);
  assert.equal(result.testMode, true);
  assert.equal(result.formalSimulationMode, true);
  assert.equal(result.isolatedSheet, "正式流程模擬訂單");
  assert.equal(result.formalFlowCoverage.scriptLockWaitMs, 30000);
  assert.equal(result.formalFlowCoverage.formalOrderNumberGenerator, "createOrderNo_");
  assert.equal(result.formalFlowCoverage.linePush, false);
  assert.equal(result.observedFormalRisks.inventoryDeductionImplemented, true);
  assert.equal(result.observedFormalRisks.requestIdempotencyImplemented, true);
});

test("正式流程模擬沿用正式編號與金額規則但只寫隔離表", () => {
  const harness = createHarness();
  const result = harness.post(formalSimulationPayload());
  const sheet = harness.spreadsheet.getSheetByName("正式流程模擬訂單");
  assert.equal(result.success, true);
  assert.match(result.simulationOrderId, /^SIM-QK\d{6}-[A-F0-9]{6}$/);
  assert.match(result.formalOrderNoCandidate, /^QK\d{6}-[A-F0-9]{6}$/);
  assert.equal(result.estimatedTotal, 200);
  assert.equal(result.depositTotal, 100);
  assert.equal(result.estimatedBalance, 100);
  assert.equal(sheet.getLastRow(), 2);
  assert.equal(harness.spreadsheet.getSheetByName("Preorders").getLastRow(), 1);
  assert.equal(harness.spreadsheet.getSheetByName("Products").getLastRow(), 2);
  assert.equal(harness.lineCalls, 0);
  assert.deepEqual(harness.waitLockTimes, [30000]);
});

test("正式流程模擬與正式流程都具備冪等防重送", () => {
  const harness = createHarness();
  const source = formalSimulationPayload();
  const first = harness.post(source);
  const second = harness.post(source);
  const sheet = harness.spreadsheet.getSheetByName("正式流程模擬訂單");
  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(second.duplicate, true);
  assert.equal(sheet.getLastRow(), 2);
  assert.equal(harness.post({
    action: "formalSimulationHandshake",
    testMode: true,
  }).observedFormalRisks.requestIdempotencyImplemented, true);
});

test("正式流程模擬的最後一件庫存只允許第一筆成功", () => {
  const harness = createHarness();
  const handshake = harness.post({
    action: "formalSimulationHandshake",
    testMode: true,
  });
  const runId = "SIMRUN-20260801-203015-ST0K";
  const firstId = "LOAD-20260801-203015-ST0K-001";
  const secondId = "LOAD-20260801-203015-ST0K-002";
  const first = harness.post(formalSimulationPayload(firstId, runId, 1));
  const second = harness.post(formalSimulationPayload(secondId, runId, 1));
  const verification = harness.post({
    action: "verifyFormalSimulationResults",
    testMode: true,
    testRequestIds: [firstId],
    safetySnapshot: handshake.safetySnapshot,
  });
  assert.equal(first.oversellRisk, false);
  assert.equal(second.success, false);
  assert.equal(second.error, "OUT_OF_STOCK");
  assert.equal(verification.simulationSheetRowCount, 1);
  assert.equal(verification.oversellRiskCount, 0);
  assert.equal(verification.concurrencyWritePassed, true);
  assert.equal(verification.inventorySafetyPassed, true);
  assert.equal(verification.formalInventoryDeductionImplemented, true);
  assert.equal(verification.formalRequestIdempotencyImplemented, true);
  assert.equal(verification.formalPreordersUnchanged, true);
  assert.equal(verification.productsUnchanged, true);
});

test("安全開關關閉時握手與測試寫入皆被拒絕", () => {
  const harness = createHarness(false);
  const handshake = harness.post({ action: "stressTestHandshake", testMode: true });
  const result = harness.post(payload());
  assert.equal(handshake.success, false);
  assert.equal(handshake.error, "STRESS_TEST_DISABLED");
  assert.equal(result.success, false);
  assert.equal(result.testMode, true);
  assert.equal(harness.spreadsheet.getSheetByName("壓力測試訂單"), null);
  assert.equal(harness.spreadsheet.getSheetByName("Preorders").getLastRow(), 1);
});

test("安全握手回傳隔離能力與正式資料快照", () => {
  const harness = createHarness();
  const result = harness.post({ action: "stressTestHandshake", testMode: true });
  assert.equal(result.success, true);
  assert.equal(result.testMode, true);
  assert.equal(result.stressTestSupported, true);
  assert.equal(result.maxRequests, 20);
  assert.equal(result.isolatedSheet, "壓力測試訂單");
  assert.equal(result.safeguards.customerLineNotifications, false);
  assert.equal(result.safeguards.inventoryMutation, false);
  assert.equal(result.safetySnapshot.preorders.rowCount, 1);
  assert.equal(result.safetySnapshot.products.rowCount, 2);
});

test("測試訂單只寫入獨立工作表且不通知、不改庫存", () => {
  const harness = createHarness();
  const beforeStock = harness.spreadsheet.getSheetByName("Products").valueAt(2, 13);
  const result = harness.post(payload());
  const testSheet = harness.spreadsheet.getSheetByName("壓力測試訂單");
  assert.equal(result.success, true);
  assert.equal(result.testMode, true);
  assert.match(result.testOrderId, /^TEST-/);
  assert.equal(testSheet.getLastRow(), 2);
  assert.equal(testSheet.valueAt(2, 2), payload().testRequestId);
  assert.equal(testSheet.valueAt(2, 16), false);
  assert.equal(testSheet.valueAt(2, 17), false);
  assert.equal(testSheet.valueAt(2, 18), false);
  assert.equal(harness.spreadsheet.getSheetByName("Preorders").getLastRow(), 1);
  assert.equal(harness.spreadsheet.getSheetByName("Products").valueAt(2, 13), beforeStock);
  assert.equal(harness.lineCalls, 0);
});

test("同一 testRequestId 重送只保留一列並回傳 duplicate:true", () => {
  const harness = createHarness();
  const first = harness.post(payload());
  const second = harness.post(payload());
  const testSheet = harness.spreadsheet.getSheetByName("壓力測試訂單");
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.testOrderId, first.testOrderId);
  assert.equal(testSheet.getLastRow(), 2);
});

test("真實格式顧客資料與真實 LINE token 會被測試模式拒絕", () => {
  const harness = createHarness();
  const unsafe = payload();
  unsafe.customerName = "王小明";
  unsafe.idToken = "real-token";
  const result = harness.post(unsafe);
  assert.equal(result.success, false);
  assert.equal(result.error, "REAL_CUSTOMER_DATA_FORBIDDEN");
  assert.equal(harness.spreadsheet.getSheetByName("壓力測試訂單"), null);
});

test("測後核對確認筆數、唯一性、欄位完整與正式資料未變", () => {
  const harness = createHarness();
  const handshake = harness.post({ action: "stressTestHandshake", testMode: true });
  const first = payload("LOAD-20260801-203015-A7K2-001");
  const second = payload("LOAD-20260801-203015-A7K2-002");
  second.customerName = "壓測測試002";
  second.lineDisplayName = "壓測測試002";
  second.phone = "0900000002";
  harness.post(first);
  harness.post(second);
  const result = harness.post({
    action: "verifyStressTestResults",
    testMode: true,
    testRequestIds: [first.testRequestId, second.testRequestId],
    safetySnapshot: handshake.safetySnapshot,
  });
  assert.equal(result.success, true);
  assert.equal(result.testSheetRowCount, 2);
  assert.deepEqual(Array.from(result.missingRequestIds), []);
  assert.deepEqual(Array.from(result.duplicateRequestIds), []);
  assert.deepEqual(Array.from(result.duplicateTestOrderIds), []);
  assert.equal(result.fieldsComplete, true);
  assert.equal(result.formalPreordersUnchanged, true);
  assert.equal(result.productsUnchanged, true);
  assert.equal(result.notificationsSent, 0);
  assert.equal(result.inventoryMutations, 0);
  assert.equal(result.formalOrdersCreated, 0);
});

test("未標示 testMode 的 createPreorder 仍走原正式入口", () => {
  const harness = createHarness();
  harness.context.handleCreatePreorder_ = () => harness.context.json_({ ok: true, formalRoute: true });
  const formalPayload = payload();
  delete formalPayload.testMode;
  const result = harness.post(formalPayload);
  assert.equal(result.formalRoute, true);
  assert.equal(harness.spreadsheet.getSheetByName("壓力測試訂單"), null);
});

test("正式訂單在鎖內扣除有限庫存並建立請求冪等紀錄", () => {
  const harness = createHarness();
  const result = harness.post(productionPayload());
  const products = harness.spreadsheet.getSheetByName("Products");
  const preorders = harness.spreadsheet.getSheetByName("Preorders");
  const requests = harness.spreadsheet.getSheetByName("OrderRequestIds");
  assert.equal(result.ok, true);
  assert.equal(result.duplicate, false);
  assert.equal(products.valueAt(2, 13), 4);
  assert.equal(preorders.getLastRow(), 2);
  assert.equal(requests.getLastRow(), 2);
  assert.equal(requests.valueAt(2, 1), productionPayload().requestId);
  assert.equal(requests.valueAt(2, 2), result.orderNo);
  assert.equal(harness.lineCalls, 1);
  assert.deepEqual(harness.waitLockTimes, [30000]);
});

test("正式 requestId 重送只回傳原訂單且不再扣庫存或通知", () => {
  const harness = createHarness();
  const first = harness.post(productionPayload());
  const second = harness.post(productionPayload());
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.orderNo, first.orderNo);
  assert.equal(harness.spreadsheet.getSheetByName("Products").valueAt(2, 13), 4);
  assert.equal(harness.spreadsheet.getSheetByName("Preorders").getLastRow(), 2);
  assert.equal(harness.spreadsheet.getSheetByName("OrderRequestIds").getLastRow(), 2);
  assert.equal(harness.lineCalls, 1);
});

test("同一正式 requestId 若 payload 不同會拒絕而非誤回舊訂單", () => {
  const harness = createHarness();
  const first = harness.post(productionPayload());
  const changed = productionPayload();
  changed.items[0].qty = 2;
  const second = harness.post(changed);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.error, "ORDER_REQUEST_CONFLICT");
  assert.equal(harness.spreadsheet.getSheetByName("Products").valueAt(2, 13), 4);
  assert.equal(harness.spreadsheet.getSheetByName("Preorders").getLastRow(), 2);
  assert.equal(harness.lineCalls, 1);
});

test("最後一件庫存只允許一張正式訂單且不會變成負數", () => {
  const harness = createHarness();
  harness.spreadsheet.getSheetByName("Products").setValueAt(2, 13, 1);
  const first = harness.post(productionPayload("ORDER-20260801-203015-STOCK001"));
  const second = harness.post(productionPayload("ORDER-20260801-203015-STOCK002"));
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(second.error, "OUT_OF_STOCK");
  assert.equal(harness.spreadsheet.getSheetByName("Products").valueAt(2, 13), 0);
  assert.equal(harness.spreadsheet.getSheetByName("Products").valueAt(2, 8), "下架");
  assert.equal(harness.spreadsheet.getSheetByName("Preorders").getLastRow(), 2);
  assert.equal(harness.lineCalls, 1);
});

test("未設定庫存上限的舊商品仍可下單且不寫入假庫存", () => {
  const harness = createHarness();
  harness.spreadsheet.getSheetByName("Products").setValueAt(2, 13, "");
  const result = harness.post(productionPayload());
  assert.equal(result.ok, true);
  assert.equal(harness.spreadsheet.getSheetByName("Products").valueAt(2, 13), "");
  assert.equal(harness.spreadsheet.getSheetByName("Products").valueAt(2, 8), "上架");
});

test("訂單或冪等紀錄寫入失敗時會回滾庫存與正式訂單", () => {
  const harness = createHarness();
  const requestSheet = harness.context.ensureSheet_(
    harness.spreadsheet,
    "OrderRequestIds",
    harness.context.ORDER_REQUEST_HEADERS_,
  );
  requestSheet.failNextAppend = true;
  const result = harness.post(productionPayload());
  assert.equal(result.ok, false);
  assert.equal(result.error, "ORDER_WRITE_FAILED");
  assert.equal(harness.spreadsheet.getSheetByName("Products").valueAt(2, 13), 5);
  assert.equal(harness.spreadsheet.getSheetByName("Products").valueAt(2, 8), "上架");
  assert.equal(harness.spreadsheet.getSheetByName("Preorders").getLastRow(), 1);
  assert.equal(requestSheet.getLastRow(), 1);
  assert.equal(harness.lineCalls, 0);
});

console.log(`\n${passed} 個壓力測試後端案例全部通過`);
