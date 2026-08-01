const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { console, Date };
vm.createContext(context);
vm.runInContext(fs.readFileSync("Code.gs", "utf8"), context);

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

test("7-11 全款每張訂單各加固定 60 元運費", () => {
  const settings = {
    orderFlowMode: "seven_eleven_full",
    shippingFeeTwd: 60,
    depositPercent: 50,
  };
  const first = context.calculateOrderPaymentTotals_(500, settings);
  const second = context.calculateOrderPaymentTotals_(300, settings);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), {
    shippingFee: 60,
    orderTotal: 560,
    depositTotal: 560,
    estimatedBalance: 0,
  });
  assert.equal(second.orderTotal, 360);
  assert.equal(first.shippingFee + second.shippingFee, 120);
});

test("原 iOPEN Mall 訂金計算維持不含店到店運費", () => {
  const totals = context.calculateOrderPaymentTotals_(1001, {
    orderFlowMode: "mall_deposit",
    shippingFeeTwd: 60,
    depositPercent: 50,
  });
  assert.equal(totals.shippingFee, 0);
  assert.equal(totals.orderTotal, 1001);
  assert.equal(totals.depositTotal, 501);
  assert.equal(totals.estimatedBalance, 500);
});

test("7-11 模式後端要求真實姓名、六位店號與店名", () => {
  const settings = { orderFlowMode: "seven_eleven_full" };
  const valid = {
    items: [{ productId: "p1", qty: 1 }],
    customerName: "王小明",
    recipientName: "王小明",
    phone: "0912345678",
    pickupStoreCode: "123456",
    pickupStoreName: "幸福門市",
  };
  assert.doesNotThrow(() => context.validatePreorderFields_(valid, settings));
  assert.throws(
    () => context.validatePreorderFields_({ ...valid, pickupStoreCode: "12345" }, settings),
    /INVALID_PICKUP_DETAILS/,
  );
  assert.throws(
    () => context.validatePreorderFields_({ ...valid, recipientName: "" }, settings),
    /INVALID_PICKUP_DETAILS/,
  );
});

test("訂單欄位與匯出欄位包含模式、取件資料、運費及含運總額", () => {
  assert.equal(context.ORDER_HEADERS_.length, context.ORDER_EXPORT_HEADERS_.length);
  assert.deepEqual(Array.from(context.ORDER_HEADERS_.slice(-6)), [
    "orderFlowMode",
    "recipientName",
    "pickupStoreCode",
    "pickupStoreName",
    "shippingFee",
    "orderTotal",
  ]);
});

test("已收全款且寄出前整張取消會把商品與運費全部列為待退款", () => {
  const row = Array(context.ORDER_HEADERS_.length).fill("");
  row[6] = '[{"productId":"p1","qty":1}]';
  row[10] = 560;
  row[15] = "已收到全款";
  row[17] = "待寄出";
  row[40] = "seven_eleven_full";
  row[44] = 60;
  row[45] = 560;
  const writes = new Map();
  const sheet = {
    getRange(_row, column, _rows = 1, columns = 1) {
      return {
        setValue(value) {
          row[column - 1] = value;
          writes.set(column, value);
        },
        setValues(values) {
          for (let index = 0; index < columns; index += 1) row[column - 1 + index] = values[0][index];
        },
      };
    },
  };
  context.prepareInventoryRestock_ = () => ({ updates: [] });
  context.applyInventoryRestock_ = () => {};
  context.formatDateTime_ = () => "2026-08-01 18:00:00";
  const result = context.cancelOrderRowLocked_(sheet, 2, row);
  assert.equal(row[15], "已取消");
  assert.equal(writes.get(27), 560);
  assert.equal(result.cashRefundDue, 560);
});

test("已寄出後取消不自動退回運費", () => {
  const row = Array(context.ORDER_HEADERS_.length).fill("");
  row[6] = '[{"productId":"p1","qty":1}]';
  row[10] = 560;
  row[15] = "已寄出";
  row[17] = "已寄出";
  row[40] = "seven_eleven_full";
  row[44] = 60;
  row[45] = 560;
  const sheet = {
    getRange(_row, column, _rows = 1, columns = 1) {
      return {
        setValue(value) { row[column - 1] = value; },
        setValues(values) {
          for (let index = 0; index < columns; index += 1) row[column - 1 + index] = values[0][index];
        },
      };
    },
  };
  context.prepareInventoryRestock_ = () => ({ updates: [] });
  context.applyInventoryRestock_ = () => {};
  context.formatDateTime_ = () => "2026-08-01 18:00:00";
  const result = context.cancelOrderRowLocked_(sheet, 2, row);
  assert.equal(result.cashRefundDue, 0);
});

test("前台與後台都具備 7-11 全款模式的必要入口", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const storefront = fs.readFileSync("storefront.js", "utf8");
  const admin = fs.readFileSync("admin.js", "utf8");
  assert.match(html, /id="pickupStoreCode"/);
  assert.match(html, /id="pickupStoreName"/);
  assert.match(storefront, /seven_eleven_full/);
  assert.match(admin, /全款已入帳/);
  assert.match(admin, /7-11 門市/);
  assert.match(admin, /取消缺貨品項/);
  assert.match(admin, /剩餘商品仍保留每單 NT \$60 運費/);
});

test("7-11 取消通知使用全款用語，不顯示訂金或尾款", () => {
  const card = context.buildUnifiedCancellationCard_({
    orderNo: "QK-711-CANCEL",
    createdAt: "2026-08-01 12:00:00",
    customerName: "王小明",
    recipientName: "王小明",
    pickupStoreCode: "123456",
    pickupStoreName: "幸福門市",
    itemsSummary: "商品 A × 1",
    totalQty: 1,
    estimatedTotal: 500,
    depositTotal: 560,
    shippingFee: 60,
    orderTotal: 560,
    orderFlowMode: "seven_eleven_full",
    reason: "管理員取消。",
  });
  const labels = card.contents.body.contents
    .filter((entry) => entry.type === "box" && entry.layout === "horizontal")
    .map((entry) => entry.contents[0].text);
  assert.ok(labels.includes("原訂單全款"));
  assert.equal(labels.includes("原訂金"), false);
  assert.equal(labels.includes("原後續應付"), false);
});

console.log(`\n${passed} seven-eleven full-payment tests passed.`);
