const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

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

function createHarness(status, overrides = {}) {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("Code.gs", "utf8"), context);

  const originalItems = [
    {
      productId: "p1",
      name: "商品 A",
      variant: "紅",
      qty: 2,
      unitPriceTwd: 100,
      subtotalTwd: 200,
    },
  ];
  const row = Array(context.ORDER_HEADERS_.length).fill("");
  Object.assign(row, {
    0: "QK-TEST",
    1: "2026-07-29 10:00:00",
    2: "U123",
    4: "Zoe",
    6: JSON.stringify(originalItems),
    7: "商品 A｜紅 × 2",
    8: 2,
    9: 200,
    10: 100,
    11: 100,
    15: status,
    17: "未開設賣場",
    26: 0,
    30: "[]",
    33: 0,
  });
  Object.keys(overrides).forEach((key) => {
    row[Number(key)] = overrides[key];
  });

  const sheet = {
    getRange(_rowNumber, column, _rowCount, columnCount = 1) {
      return {
        getDisplayValues: () => [row.slice(column - 1, column - 1 + columnCount)],
        getDisplayValue: () => String(row[column - 1] ?? ""),
        setValues(values) {
          values[0].forEach((value, index) => {
            row[column - 1 + index] = value;
          });
          return this;
        },
        setValue(value) {
          row[column - 1] = value;
          return this;
        },
      };
    },
  };
  context.requireAdmin_ = () => {};
  context.setupQuokkaPreorder = () => {};
  context.spreadsheet_ = () => ({ getSheetByName: () => sheet });
  context.findOrderRow_ = () => 2;
  context.readProducts_ = () => [
    {
      id: "p1",
      name: "商品 A",
      priceTwd: 100,
      variants: ["紅"],
      active: true,
    },
    {
      id: "p2",
      name: "商品 B",
      priceTwd: 75,
      variants: [],
      active: true,
    },
  ];
  context.LockService = {
    getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
  };
  context.formatDateTime_ = () => "2026-07-29 14:00:00";
  context.pushLineMessage_ = () => false;
  context.json_ = (payload) => payload;
  return { context, row };
}

function request(items, extra = {}) {
  return {
    orderNo: "QK-TEST",
    adjustmentId: "adjustment-1",
    expectedRevision: 0,
    items,
    ...extra,
  };
}

test("待收訂金會依新總額重算 50% 訂金", () => {
  const { context, row } = createHarness("待收訂金");
  const result = context.handleAdminAdjustOrder_(
    request(
      [
        { productId: "p1", variant: "紅", qty: 1 },
        { productId: "p2", variant: "", qty: 1 },
      ],
      { expectedStatus: "待收訂金" },
    ),
  );
  assert.equal(result.ok, true);
  assert.equal(row[9], 175);
  assert.equal(row[10], 88);
  assert.equal(row[11], 87);
  assert.equal(row[15], "待收訂金");
  assert.equal(row[33], 1);
});

test("待確認訂金保留原訂金與狀態", () => {
  const { context, row } = createHarness("待確認訂金");
  const result = context.handleAdminAdjustOrder_(
    request([{ productId: "p1", variant: "紅", qty: 1 }], {
      expectedStatus: "待確認訂金",
    }),
  );
  assert.equal(result.ok, true);
  assert.equal(row[9], 100);
  assert.equal(row[10], 100);
  assert.equal(row[11], 0);
  assert.equal(row[15], "待確認訂金");
  assert.equal(row[26], 0);
});

test("已收到訂金保留已收金額並計算溢付", () => {
  const { context, row } = createHarness("已收到訂金", { 10: 250 });
  context.handleAdminAdjustOrder_(
    request([{ productId: "p1", variant: "紅", qty: 1 }], {
      expectedStatus: "已收到訂金",
    }),
  );
  assert.equal(row[10], 250);
  assert.equal(row[11], 0);
  assert.equal(row[26], 150);
  assert.equal(row[15], "已收到訂金");
});

test("版本不同時拒絕覆蓋另一頁的調整", () => {
  const { context } = createHarness("待收訂金", { 33: 2 });
  assert.throws(
    () =>
      context.handleAdminAdjustOrder_(
        request([{ productId: "p1", variant: "紅", qty: 1 }], {
          expectedStatus: "待收訂金",
        }),
      ),
    /ORDER_CHANGED/,
  );
});

test("相同 adjustmentId 重送不會再次修改或通知", () => {
  const existing = JSON.stringify([{ adjustmentId: "adjustment-1" }]);
  const { context, row } = createHarness("已開設 iOPEN Mall 賣場", {
    30: existing,
    33: 1,
  });
  const result = context.handleAdminAdjustOrder_(
    request([{ productId: "p1", variant: "紅", qty: 1 }], {
      expectedStatus: "待收訂金",
    }),
  );
  assert.equal(result.ok, true);
  assert.equal(result.duplicate, true);
  assert.equal(row[9], 200);
  assert.equal(row[33], 1);
});

test("紅色賣場狀態不可一般編輯", () => {
  const { context } = createHarness("已開設 iOPEN Mall 賣場");
  assert.throws(
    () =>
      context.handleAdminAdjustOrder_(
        request([{ productId: "p1", variant: "紅", qty: 1 }], {
          expectedStatus: "已開設 iOPEN Mall 賣場",
        }),
      ),
    /ORDER_EDIT_NOT_ALLOWED/,
  );
});

test("原訂商品下架後仍可保留並調整數量", () => {
  const { context, row } = createHarness("待收訂金");
  context.readProducts_ = () => [
    {
      id: "p1",
      name: "商品 A",
      priceTwd: 999,
      variants: ["紅"],
      active: false,
    },
  ];
  context.handleAdminAdjustOrder_(
    request([{ productId: "p1", variant: "紅", qty: 3 }], {
      expectedStatus: "待收訂金",
    }),
  );
  assert.equal(row[9], 300);
  assert.equal(JSON.parse(row[6])[0].unitPriceTwd, 100);
});

test("缺貨調整也會推進版本，避免舊編輯頁覆蓋", () => {
  const { context, row } = createHarness("已收到訂金");
  context.handleAdminAdjustOrderShortage_({
    orderNo: "QK-TEST",
    cancellations: [{ index: 0, qty: 1 }],
  });
  assert.equal(row[33], 1);
  assert.equal(JSON.parse(row[6])[0].qty, 1);
});

console.log(`\n${passed} 個訂單調整測試全部通過`);
