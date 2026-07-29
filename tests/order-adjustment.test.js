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
          row[column - 1] = value;
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
    getSheetByName: (name) =>
      name === "LineInboundEvents" ? eventSheet : sheet,
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
  return { context, row, eventRows, pushes };
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
  const { context, row, eventRows, pushes } = createHarness(
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
  assert.equal(pushes.length, 1);
  assert.match(pushes[0][1].altText, /訂單已取消/);
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
  assert.match(buttons[0].action.text, /^您好，我想索取匯款資訊/);
  assert.match(buttons[0].action.text, /訂單編號：QK-TEST/);
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
