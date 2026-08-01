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

function createHarness(status, overrides = {}, options = {}) {
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

  let failCancelOnce = Boolean(options.failOrderCancelWrite);
  const sheet = {
    getLastRow: () => 2,
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
          if (column === 16 && value === "已取消" && failCancelOnce) {
            failCancelOnce = false;
            throw new Error("simulated order write failure");
          }
          row[column - 1] = value;
          return this;
        },
      };
    },
  };
  const productRow = Array(context.PRODUCT_HEADERS_.length).fill("");
  Object.assign(productRow, {
    0: "p1",
    1: "商品 A",
    5: JSON.stringify(["紅"]),
    7: "上架",
    8: 1,
    11: 100,
    12: options.productStock === undefined ? 5 : options.productStock,
    13: "[]",
  });
  const productSheet = {
    getLastRow: () => 2,
    getRange(_rowNumber, column, _rowCount, columnCount = 1) {
      return {
        getValues: () => [
          productRow.slice(column - 1, column - 1 + columnCount),
        ],
        getDisplayValues: () => [
          productRow
            .slice(column - 1, column - 1 + columnCount)
            .map((value) => String(value ?? "")),
        ],
        setValues(values) {
          values[0].forEach((value, index) => {
            productRow[column - 1 + index] = value;
          });
          return this;
        },
        setValue(value) {
          productRow[column - 1] = value;
          return this;
        },
      };
    },
  };
  const eventRows = options.eventRows || [
    [
      "event-1",
      "U123",
      dateTimeHoursAgo(1),
      "text",
      "message-1",
      "您好，我想索取匯款資訊",
      "QK-TEST",
      "待核對",
      "",
    ],
  ];
  const eventSheet = {
    getLastRow: () => eventRows.length + 1,
    getRange(rowNumber, column, rowCount, columnCount = 1) {
      const start = rowNumber - 2;
      return {
        getDisplayValues: () =>
          eventRows
            .slice(start, start + rowCount)
            .map((eventRow) =>
              eventRow.slice(column - 1, column - 1 + columnCount),
            ),
        setValues(values) {
          values.forEach((valuesRow, rowOffset) => {
            valuesRow.forEach((value, columnOffset) => {
              eventRows[start + rowOffset][column - 1 + columnOffset] = value;
            });
          });
          return this;
        },
      };
    },
  };
  const pushes = [];
  context.requireAdmin_ = () => {};
  context.verifyLineIdToken_ = () => ({ sub: "U123" });
  context.Utilities = {
    parseDate: (text) => new Date(String(text).replace(" ", "T")),
  };
  context.Session = { getScriptTimeZone: () => "Asia/Taipei" };
  context.setupQuokkaPreorder = () => {};
  context.spreadsheet_ = () => ({
    getSheetByName: (name) => {
      if (name === "LineInboundEvents") return eventSheet;
      if (name === "Products") return productSheet;
      return sheet;
    },
  });
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
  context.pushLineMessage_ = (...args) => {
    pushes.push(args);
    return Boolean(options.pushResult);
  };
  context.json_ = (payload) => payload;
  context.invalidatePublicCatalogCache_ = () => {};
  return { context, row, productRow, eventRows, pushes };
}

function dateTimeHoursAgo(hours) {
  const date = new Date(Date.now() - hours * 3600000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function request(items, extra = {}) {
  return {
    orderNo: "QK-TEST",
    adjustmentId: "adjustment-1",
    expectedRevision: 0,
    reason: "admin_correction",
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

test("待收訂金調整會沿用訂單成立時的訂金比例", () => {
  const { context, row } = createHarness("待收訂金", { 34: 30 });
  context.handleAdminAdjustOrder_(
    request(
      [
        { productId: "p1", variant: "紅", qty: 1 },
        { productId: "p2", variant: "", qty: 1 },
      ],
      { expectedStatus: "待收訂金" },
    ),
  );
  assert.equal(row[9], 175);
  assert.equal(row[10], 53);
  assert.equal(row[11], 122);
});

test("新訂單會保存成立當時的訂金與付款期限規則", () => {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("Code.gs", "utf8"), context);
  let appendedRow;
  context.verifyLineIdToken_ = () => ({ sub: "U123", name: "Zoe" });
  context.LockService = {
    getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
  };
  context.setupQuokkaPreorder = () => {};
  context.readSettings_ = () => ({
    saleClosed: false,
    depositPercent: 30,
    paymentReminderHours: 10,
    paymentDeadlineHours: 20,
    paymentGraceHours: 2,
  });
  context.readProducts_ = () => [
    {
      id: "p1",
      name: "商品 A",
      priceTwd: 200,
      variants: [],
      active: true,
    },
  ];
  const orderSheet = {
      appendRow(row) {
        appendedRow = row;
      },
      getLastRow() { return 2; },
    };
  const requestSheet = { appendRow() {}, getLastRow() { return 1; } };
  context.spreadsheet_ = () => ({
    getSheetByName(name) { return name === "Preorders" ? orderSheet : null; },
  });
  context.ensureSheet_ = () => requestSheet;
  context.findOrderRequestRow_ = () => 0;
  context.readSaleClosedFlag_ = () => false;
  context.prepareInventoryReservation_ = () => ({
    cleanItems: [{ productId: "p1", name: "商品 A", variant: "", qty: 1, unitPriceTwd: 200, subtotalTwd: 200 }],
    totalQty: 1,
    estimatedTotal: 200,
    updates: [],
    productSheet: null,
  });
  context.sha256_ = () => "digest";
  context.Utilities = {
    getUuid: () => "12345678901234567890",
  };
  context.formatDateTime_ = (date) => String(date.getTime());
  context.pushOrderSuccessCard_ = () => false;
  context.json_ = (payload) => payload;
  context.createOrderNo_ = () => "QK-NEW";

  const result = context.handleCreatePreorder_({
    requestId: "ORDER-20260801-203015-TEST0001",
    idToken: "token",
    lineDisplayName: "Zoe",
    customerName: "Zoe",
    phone: "0900000000",
    items: [{ productId: "p1", variant: "", qty: 1 }],
  });

  assert.equal(result.depositTotal, 60);
  assert.equal(result.estimatedBalance, 140);
  assert.equal(appendedRow.length, context.ORDER_HEADERS_.length);
  assert.equal(appendedRow[34], 30);
  assert.notEqual(appendedRow[35], "");
  assert.notEqual(appendedRow[36], "");
  assert.notEqual(appendedRow[37], "");
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
    adjustmentId: "shortage-1",
    expectedRevision: 0,
    expectedStatus: "已收到訂金",
    cancellations: [{ index: 0, qty: 1 }],
  });
  assert.equal(row[33], 1);
  assert.equal(JSON.parse(row[6])[0].qty, 1);
});

test("一般調整只接受顧客變更或管理修正", () => {
  const { context } = createHarness("待收訂金");
  assert.throws(
    () =>
      context.handleAdminAdjustOrder_(
        request([{ productId: "p1", variant: "紅", qty: 1 }], {
          expectedStatus: "待收訂金",
          reason: "shortage",
        }),
      ),
    /INVALID_ORDER_ADJUSTMENT/,
  );
});

test("缺貨調整拒絕舊版本並防止重複處理", () => {
  const { context } = createHarness("已收到訂金", { 33: 2 });
  assert.throws(
    () =>
      context.handleAdminAdjustOrderShortage_({
        orderNo: "QK-TEST",
        adjustmentId: "shortage-stale",
        expectedRevision: 1,
        expectedStatus: "已收到訂金",
        cancellations: [{ index: 0, qty: 1 }],
      }),
    /ORDER_CHANGED/,
  );

  const existing = JSON.stringify([{ adjustmentId: "shortage-duplicate" }]);
  const duplicateHarness = createHarness("已收到訂金", { 24: existing });
  const duplicate = duplicateHarness.context.handleAdminAdjustOrderShortage_({
    orderNo: "QK-TEST",
    adjustmentId: "shortage-duplicate",
    expectedRevision: 0,
    expectedStatus: "已收到訂金",
    cancellations: [{ index: 0, qty: 1 }],
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicateHarness.row[9], 200);
});

function cardMoneyLabels(card) {
  return Array.from(card.contents.body.contents)
    .filter(
      (entry) =>
        entry.type === "box" &&
        entry.layout === "horizontal" &&
        Array.isArray(entry.contents) &&
        entry.contents[0]?.type === "text",
    )
    .map((entry) => entry.contents[0].text)
    .filter((label) => !["訂購人", "訂單時間"].includes(label));
}

test("一般調整 LINE 卡片使用固定金額欄位順序", () => {
  const { context } = createHarness("待確認訂金");
  const card = context.buildUnifiedOrderAdjustmentCard_({
    orderNo: "QK-TEST",
    createdAt: "2026-07-29 10:00:00",
    customerName: "Zoe",
    itemsSummary: "商品 A｜紅 × 1",
    totalQty: 1,
    adjustedTotal: 100,
    adjustedBalance: 0,
    originalOrderTotal: 200,
    receivedDeposit: 100,
    changeAmount: 100,
    changeType: "decrease",
    status: "待確認訂金",
    reasonLabel: "管理修正",
    changes: [],
  });
  assert.deepEqual(cardMoneyLabels(card), [
    "原訂單金額",
    "已回報訂金",
    "商品件數",
    "調整後訂單總額",
    "調整後訂單訂金",
    "這次扣除金額",
    "調整後應付尾款",
  ]);
});

test("缺貨 LINE 卡片共用金額順序並在溢付時另列待退款", () => {
  const { context } = createHarness("已收到訂金");
  const card = context.buildUnifiedShortageCard_({
    orderNo: "QK-TEST",
    createdAt: "2026-07-29 10:00:00",
    customerName: "Zoe",
    itemsSummary: "品項已全數取消",
    totalQty: 0,
    adjustedTotal: 0,
    adjustedBalance: 0,
    originalOrderTotal: 200,
    receivedDeposit: 100,
    changeAmount: 200,
    changeType: "decrease",
    status: "已收到訂金",
    cashRefundDue: 100,
    allItemsCancelled: true,
    cancelledItems: [
      { name: "商品 A", variant: "紅", qty: 2, subtotalTwd: 200 },
    ],
  });
  assert.deepEqual(cardMoneyLabels(card), [
    "原訂單金額",
    "已收訂金",
    "商品件數",
    "調整後訂單總額",
    "調整後訂單訂金",
    "這次扣除金額",
    "調整後應付尾款",
    "待退款",
  ]);
});

test("確認收到訂金會同步更新狀態、核對警示並發送通知", () => {
  const { context, row, eventRows, pushes } = createHarness(
    "待收訂金",
    { 1: dateTimeHoursAgo(20) },
    { pushResult: true },
  );
  const result = context.handleAdminResolveLineAlert_({
    orderNo: "QK-TEST",
    decision: "received",
  });
  assert.equal(result.ok, true);
  assert.equal(result.order.status, "已收到訂金");
  assert.equal(result.order.resolved, 1);
  assert.equal(row[15], "已收到訂金");
  assert.equal(eventRows[0][7], "已核對");
  assert.equal(eventRows[0][8], "2026-07-29 14:00:00");
  assert.equal(pushes.length, 1);
  assert.match(pushes[0][1].altText, /已收到訂金/);
});

test("25小時內的非付款訊息只標記已查看", () => {
  const { context, row, eventRows, pushes } = createHarness("待收訂金", {
    1: dateTimeHoursAgo(24.5),
  });
  const result = context.handleAdminResolveLineAlert_({
    orderNo: "QK-TEST",
    decision: "reviewed",
  });
  assert.equal(result.ok, true);
  assert.equal(result.order.status, "待收訂金");
  assert.equal(row[15], "待收訂金");
  assert.equal(eventRows[0][7], "已核對");
  assert.equal(pushes.length, 0);
});

test("滿25小時後不能只解除保護", () => {
  const { context, row, eventRows } = createHarness("待收訂金", {
    1: dateTimeHoursAgo(25.01),
  });
  assert.throws(
    () =>
      context.handleAdminResolveLineAlert_({
        orderNo: "QK-TEST",
        decision: "reviewed",
      }),
    /ORDER_PAYMENT_OVERDUE/,
  );
  assert.equal(row[15], "待收訂金");
  assert.equal(eventRows[0][7], "待核對");
});

test("滿25小時的非付款訊息可立即取消、清除警示並通知", () => {
  const { context, row, productRow, eventRows, pushes } = createHarness(
    "待收訂金",
    { 1: dateTimeHoursAgo(26) },
    { pushResult: true },
  );
  const result = context.handleAdminResolveLineAlert_({
    orderNo: "QK-TEST",
    decision: "cancel_overdue",
  });
  assert.equal(result.ok, true);
  assert.equal(result.order.status, "已取消");
  assert.equal(row[15], "已取消");
  assert.equal(row[17], "未開設賣場");
  assert.equal(row[20], "2026-07-29 14:00:00");
  assert.equal(eventRows[0][7], "已核對");
  assert.equal(productRow[12], 7);
  assert.equal(pushes.length, 1);
  assert.match(pushes[0][1].altText, /訂單已取消/);
});

test("同一張逾期取消訂單重複處理時庫存只加回一次", () => {
  const { context, productRow } = createHarness(
    "待收訂金",
    { 1: dateTimeHoursAgo(26) },
    { pushResult: true },
  );
  context.handleAdminResolveLineAlert_({
    orderNo: "QK-TEST",
    decision: "cancel_overdue",
  });
  const duplicate = context.handleAdminResolveLineAlert_({
    orderNo: "QK-TEST",
    decision: "cancel_overdue",
  });
  assert.equal(productRow[12], 7);
  assert.equal(duplicate.order.duplicate, true);
});

test("一般取消會回補庫存，重複取消不會再次回補或通知", () => {
  const { context, productRow, pushes } = createHarness("待收訂金", {}, {
    pushResult: true,
  });
  const first = context.cancelOrder_("QK-TEST", "管理員取消");
  const duplicate = context.cancelOrder_("QK-TEST", "管理員取消");
  assert.equal(first.stockRestoredQty, 2);
  assert.equal(productRow[12], 7);
  assert.equal(duplicate.duplicate, true);
  assert.equal(pushes.length, 1);
});

test("取消售罄訂單會回補數量並重新上架；無限庫存仍保持空白", () => {
  const finite = createHarness("待收訂金", {}, { productStock: 0 });
  finite.productRow[7] = "下架";
  finite.context.cancelOrder_("QK-TEST", "管理員取消");
  assert.equal(finite.productRow[12], 2);
  assert.equal(finite.productRow[7], "上架");

  const unlimited = createHarness("待收訂金", {}, { productStock: "" });
  unlimited.context.cancelOrder_("QK-TEST", "管理員取消");
  assert.equal(unlimited.productRow[12], "");
});

test("取消含封存商品的舊訂單會回補庫存但不恢復販售", () => {
  const archived = createHarness("待收訂金", {}, { productStock: 0 });
  archived.productRow[7] = "已封存";
  archived.context.cancelOrder_("QK-TEST", "管理員取消");
  assert.equal(archived.productRow[12], 2);
  assert.equal(archived.productRow[7], "已封存");
});

test("取消狀態寫入失敗時會回滾已加回的庫存", () => {
  const { context, row, productRow, pushes } = createHarness(
    "待收訂金",
    {},
    { failOrderCancelWrite: true },
  );
  assert.throws(
    () => context.cancelOrder_("QK-TEST", "管理員取消"),
    /ORDER_CANCEL_WRITE_FAILED/,
  );
  assert.equal(row[15], "待收訂金");
  assert.equal(productRow[12], 5);
  assert.equal(pushes.length, 0);
});

test("未滿25小時不能提前使用逾期取消", () => {
  const { context, row, eventRows } = createHarness("待收訂金", {
    1: dateTimeHoursAgo(24.9),
  });
  assert.throws(
    () =>
      context.handleAdminResolveLineAlert_({
        orderNo: "QK-TEST",
        decision: "cancel_overdue",
      }),
    /ORDER_CANCEL_NOT_DUE/,
  );
  assert.equal(row[15], "待收訂金");
  assert.equal(eventRows[0][7], "待核對");
});

test("警示已被其他頁面處理時不會再改訂單狀態", () => {
  const { context, row, pushes } = createHarness(
    "待收訂金",
    { 1: dateTimeHoursAgo(20) },
    { eventRows: [], pushResult: true },
  );
  assert.throws(
    () =>
      context.handleAdminResolveLineAlert_({
        orderNo: "QK-TEST",
        decision: "received",
      }),
    /LINE_ALERT_ALREADY_RESOLVED/,
  );
  assert.equal(row[15], "待收訂金");
  assert.equal(pushes.length, 0);
});

test("本次停用顧客匯款回報入口與藍色狀態轉換", () => {
  const backendSource = fs.readFileSync("Code.gs", "utf8");
  const storefrontSource = fs.readFileSync("storefront.js", "utf8");
  const storefrontHtml = fs.readFileSync("index.html", "utf8");
  assert.equal(backendSource.includes('if (action === "confirmPreorderPayment")'), false);
  assert.equal(backendSource.includes("已匯款，前往回報"), false);
  assert.equal(backendSource.includes("if (status !== ORDER_STATUS_PENDING_) return;"), true);
  assert.equal(storefrontSource.includes("data-report-payment"), false);
  assert.equal(storefrontSource.includes('action: "confirmPreorderPayment"'), false);
  assert.equal(storefrontHtml.includes("paymentReportDialog"), false);
});

test("LINE 核對只在待收訂金卡片顯示直接操作按鈕", () => {
  const adminSource = fs.readFileSync("admin.js", "utf8");
  assert.equal(adminSource.includes("（顧客回報）"), false);
  assert.equal(adminSource.includes("data-resolve-line-order"), false);
  assert.equal(adminSource.includes('status === "待收訂金" && Number(order.lineAlertCount || 0) > 0'), true);
  assert.equal(adminSource.includes("訂金已入帳"), true);
  assert.equal(adminSource.includes("尚未入帳"), true);
  assert.equal(adminSource.includes("選擇處理方式"), false);
  assert.equal(adminSource.includes("line-alert-menu"), false);
});

test("訂單成立卡片只保留傳送匯款資訊訊息按鈕", () => {
  const { context } = createHarness("待收訂金");
  const card = context.buildUnifiedOrderSuccessCard_({
    orderNo: "QK-TEST",
    createdAt: "2026-07-29 10:00:00",
    customerName: "Zoe",
    itemsSummary: "商品 A｜紅 × 1",
    totalQty: 1,
    estimatedTotal: 200,
    depositTotal: 100,
    estimatedBalance: 100,
  });
  const buttons = card.contents.footer.contents;
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].action.type, "message");
  assert.equal(buttons[0].action.label, "匯款資訊");
  assert.equal(buttons[0].action.text, "您好，我想索取匯款資訊");
});

test("歷史訂單捷徑先讀訂單，商品目錄延後背景載入", () => {
  const storefrontSource = fs.readFileSync("storefront.js", "utf8");
  const initStart = storefrontSource.indexOf("async function init()");
  const shortcutStart = storefrontSource.indexOf("if (ordersShortcut) showOrdersLoading()", initStart);
  const regularCatalogLoad = storefrontSource.indexOf("if (!ordersShortcut) await ensureCatalogLoaded()", initStart);
  const ordersLoad = storefrontSource.indexOf("await showMyOrders()", initStart);
  const backgroundCatalogLoad = storefrontSource.indexOf("void ensureCatalogLoaded()", ordersLoad);
  assert.ok(initStart >= 0);
  assert.ok(shortcutStart > initStart);
  assert.ok(regularCatalogLoad > shortcutStart);
  assert.ok(ordersLoad > regularCatalogLoad);
  assert.ok(backgroundCatalogLoad > ordersLoad);
  assert.equal(storefrontSource.includes("state.settings.saleClosed && !viewingOrders"), true);
});

console.log(`\n${passed} 個訂單調整測試全部通過`);
