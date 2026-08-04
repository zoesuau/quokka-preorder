const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function orderRow(overrides = {}) {
  const row = Array(40).fill("");
  Object.assign(row, {
    0: "QK-001",
    6: '[{"productId":"p1","name":"商品 A","variant":"紅","qty":1}]',
    8: "1",
    15: "已收到訂金",
    17: "未開設賣場",
  }, overrides);
  return row;
}

function createGasContext(rows) {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("Code.gs", "utf8"), context);
  context.spreadsheet_ = () => ({
    getSheetByName: () => ({
      getLastRow: () => rows.length + 1,
      getRange: () => ({ getDisplayValues: () => rows.map((row) => row.slice()) }),
    }),
  });
  return context;
}

test("採購統計只計入有效的已收訂金訂單，取消後數量歸零", () => {
  const context = createGasContext([
    orderRow({ 0: "QK-PAID" }),
    orderRow({ 0: "QK-CANCELLED", 15: "已取消" }),
  ]);
  const summary = context.readPurchaseSummary_();
  assert.equal(summary.orderCount, 1);
  assert.equal(summary.totalQty, 1);
  assert.equal(summary.items.length, 1);

  const cancelledOnlyContext = createGasContext([
    orderRow({ 0: "QK-CANCELLED", 15: "已取消" }),
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(cancelledOnlyContext.readPurchaseSummary_())),
    { orderCount: 0, totalQty: 0, items: [] },
  );
});

test("從狀態選單取消訂單後重新讀取後端統計", () => {
  const adminJs = fs.readFileSync("admin.js", "utf8");
  const start = adminJs.indexOf("async function handleOrderStatusChange(");
  const end = adminJs.indexOf("\nfunction renderAdminProducts", start);
  assert.ok(start >= 0 && end > start, "找不到訂單狀態更新流程");
  const source = adminJs.slice(start, end);
  assert.match(source, /if \(!result\.ok\)[\s\S]*await loadAdminProducts\(\)/);
});

console.log(`\n${passed} admin purchase summary tests passed.`);
