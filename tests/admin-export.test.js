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

function createContext(rows) {
  const context = { console, Date };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("Code.gs", "utf8"), context);
  let authorized = false;
  const sheet = {
    getLastRow: () => rows.length + 1,
    getRange: () => ({ getDisplayValues: () => rows.map((row) => row.slice()) }),
  };
  context.requireAdmin_ = (idToken, sessionToken) => {
    assert.equal(idToken, "id-token");
    assert.equal(sessionToken, "session-token");
    authorized = true;
  };
  context.setupQuokkaPreorder = () => {};
  context.spreadsheet_ = () => ({ getSheetByName: () => sheet });
  context.Utilities = {
    parseDate: (text) => new Date(String(text).replace(" ", "T")),
    formatDate: () => "20260801-150000",
  };
  context.Session = { getScriptTimeZone: () => "Asia/Taipei" };
  context.json_ = (payload) => payload;
  return { context, wasAuthorized: () => authorized };
}

function orderRow(overrides = {}) {
  const row = Array(40).fill("");
  Object.assign(row, {
    0: "QK-001",
    1: "2026-08-01 10:00:00",
    2: "U001",
    3: "Echo LINE",
    4: "Echo",
    5: "0900000001",
    6: '[{"name":"商品 A","qty":1}]',
    7: "商品 A × 1",
    8: "1",
    9: "500",
    10: "250",
    11: "250",
    14: "一般備註",
    15: "待收訂金",
    17: "未開設賣場",
  });
  Object.keys(overrides).forEach((key) => { row[Number(key)] = overrides[key]; });
  return row;
}

test("訂單匯出需要管理員驗證並包含全部正式欄位", () => {
  const rows = [orderRow(), orderRow({ 0: "QK-002", 4: '=HYPERLINK("bad")' })];
  const { context, wasAuthorized } = createContext(rows);
  const result = context.handleAdminExportData_({
    exportType: "orders",
    idToken: "id-token",
    adminSessionToken: "session-token",
  });
  assert.equal(wasAuthorized(), true);
  assert.equal(result.ok, true);
  assert.equal(result.rowCount, 2);
  assert.equal(result.fileName, "orders-20260801-150000.csv");
  assert.equal(context.ORDER_EXPORT_HEADERS_.length, context.ORDER_HEADERS_.length);
  assert.match(result.csv, /"訂單編號"/);
  assert.match(result.csv, /"QK-002"/);
  assert.match(result.csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.equal(context.csvCell_("  =1+1"), '"\'  =1+1"');
});

test("客戶匯出依 LINE User ID 去重並使用最新聯絡資料", () => {
  const rows = [
    orderRow({ 0: "QK-001", 1: "2026-08-01 10:00:00", 4: "舊姓名", 9: "500", 15: "已收到訂金" }),
    orderRow({ 0: "QK-002", 1: "2026-08-02 10:00:00", 4: "新姓名", 5: "0911222333", 9: "700", 15: "訂單已完成" }),
    orderRow({ 0: "QK-003", 1: "2026-08-03 10:00:00", 2: "U002", 3: "取消顧客", 4: "取消顧客", 5: "0922000000", 9: "900", 15: "已取消" }),
  ];
  const { context } = createContext(rows);
  const result = context.handleAdminExportData_({
    exportType: "customers",
    idToken: "id-token",
    adminSessionToken: "session-token",
  });
  assert.equal(result.rowCount, 2);
  const customerRows = context.buildCustomerExportRows_(rows);
  const echo = customerRows.find((row) => row[0] === "U001");
  const cancelled = customerRows.find((row) => row[0] === "U002");
  assert.deepEqual(Array.from(echo), ["U001", "Echo LINE", "新姓名", "0911222333", "2026-08-01 10:00:00", "2026-08-02 10:00:00", 2, 2, 0, 1, 1200, "訂單已完成"]);
  assert.equal(cancelled[7], 0);
  assert.equal(cancelled[8], 1);
  assert.equal(cancelled[10], 0);
});

test("沒有 LINE User ID 時以正規化電話去重", () => {
  const rows = [
    orderRow({ 2: "", 5: "0912-345-678" }),
    orderRow({ 0: "QK-002", 1: "2026-08-02 10:00:00", 2: "", 5: "0912345678" }),
  ];
  const { context } = createContext(rows);
  assert.equal(context.buildCustomerExportRows_(rows).length, 1);
});

test("不接受未知匯出類型", () => {
  const { context } = createContext([]);
  assert.throws(
    () => context.handleAdminExportData_({ exportType: "unknown", idToken: "id-token", adminSessionToken: "session-token" }),
    /INVALID_EXPORT_TYPE/,
  );
});

test("未通過後端管理員驗證時不能讀取或匯出個資", () => {
  const { context } = createContext([orderRow()]);
  let spreadsheetRead = false;
  context.requireAdmin_ = () => { throw new Error("ADMIN_FORBIDDEN"); };
  context.spreadsheet_ = () => {
    spreadsheetRead = true;
    return { getSheetByName: () => null };
  };
  assert.throws(
    () => context.handleAdminExportData_({ exportType: "orders" }),
    /ADMIN_FORBIDDEN/,
  );
  assert.equal(spreadsheetRead, false);
});

test("空訂單仍輸出可開啟的標題列 CSV", () => {
  const { context } = createContext([]);
  const result = context.handleAdminExportData_({
    exportType: "orders",
    idToken: "id-token",
    adminSessionToken: "session-token",
  });
  assert.equal(result.rowCount, 0);
  assert.equal(result.csv.split("\r\n").length, 1);
  assert.match(result.csv, /^"訂單編號",/);
});

test("CSV 正確處理逗號、引號與換行", () => {
  const { context } = createContext([]);
  assert.equal(context.csvCell_('備註,"雙引號"\n第二行'), '"備註,""雙引號""\n第二行"');
});

test("後台具有兩個完整資料匯出入口", () => {
  const html = fs.readFileSync("admin.html", "utf8");
  const script = fs.readFileSync("admin.js", "utf8");
  const settingsStart = html.indexOf('id="adminSettingsPage"');
  const passwordFormStart = html.indexOf('id="passwordForm"');
  const exportStart = html.indexOf('class="admin-export-card"');
  const settingsEnd = html.indexOf("\n      </section>\n      </div>", settingsStart);
  assert.match(html, /id="exportOrders"/);
  assert.match(html, /id="exportCustomers"/);
  assert.ok(settingsStart >= 0 && exportStart > passwordFormStart && exportStart < settingsEnd);
  assert.match(script, /action: "adminExportData"/);
  assert.match(script, /new Blob\(\["\\uFEFF", csv\]/);
});

console.log(`\n${passed} admin export tests passed.`);
