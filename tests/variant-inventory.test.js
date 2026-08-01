const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { console };
vm.createContext(context);
vm.runInContext(fs.readFileSync("Code.gs", "utf8"), context);

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function productRow(options, status = "上架") {
  const row = Array(context.PRODUCT_HEADERS_.length).fill("");
  Object.assign(row, {
    0: "p1",
    1: "多款商品",
    2: "吊飾",
    3: "https://example.com/cover.jpg",
    5: options.map((option) => option.name).join("\n"),
    7: status,
    8: 1,
    11: 100,
    12: options.reduce((sum, option) => sum + option.stockQuantity, 0),
    13: JSON.stringify(["https://example.com/cover.jpg"]),
    14: JSON.stringify(options),
  });
  return row;
}

function productSheetHarness(row) {
  return {
    row,
    getLastRow: () => 2,
    getRange(_rowNumber, column, _rowCount, columnCount = 1) {
      return {
        getValues: () => [row.slice(column - 1, column - 1 + columnCount)],
        getValue: () => row[column - 1],
        getDisplayValues: () => [row.slice(column - 1, column - 1 + columnCount).map((value) => String(value ?? ""))],
        getDisplayValue: () => String(row[column - 1] ?? ""),
        setValue(value) {
          row[column - 1] = value;
          return this;
        },
      };
    },
  };
}

const baseProduct = {
  name: "多款商品",
  category: "吊飾",
  imageUrl: "https://example.com/cover.jpg",
  imageUrls: ["https://example.com/cover.jpg"],
  priceTwd: 100,
  krwPrice: 0,
  description: "",
  active: true,
  sortOrder: 1,
  stockQuantity: 99,
  variants: [],
  variantInventoryEnabled: true,
  variantOptions: [
    { id: "v-red123", name: "紅色", stockQuantity: 2, imageUrl: "https://example.com/red.jpg" },
    { id: "v-blue12", name: "藍色", stockQuantity: 3, imageUrl: "" },
  ],
};

test("款式商品的總庫存由各款式加總，不採用前端傳入總數", () => {
  const product = context.validateProduct_(baseProduct);
  assert.equal(product.stockQuantity, 5);
  assert.equal(product.variantInventoryEnabled, true);
  assert.deepEqual(Array.from(product.variants), ["紅色", "藍色"]);
});

test("款式名稱重複或庫存不是整數時拒絕保存", () => {
  assert.throws(() => context.validateProduct_({
    ...baseProduct,
    variantOptions: [
      { name: "紅色", stockQuantity: 1 },
      { name: "紅色", stockQuantity: 2 },
    ],
  }), /INVALID_PRODUCT/);
  assert.throws(() => context.validateProduct_({
    ...baseProduct,
    variantOptions: [{ name: "紅色", stockQuantity: 1.5 }],
  }), /INVALID_PRODUCT/);
});

test("舊商品沒有款式 JSON 時仍沿用原總庫存與款式文字", () => {
  const row = productRow([], "上架");
  row[5] = "紅色\n藍色";
  row[12] = 7;
  row[14] = "";
  const product = context.rowToProduct_(row, 0.022);
  assert.equal(product.variantInventoryEnabled, false);
  assert.equal(product.stockQuantity, 7);
  assert.deepEqual(Array.from(product.variants), ["紅色", "藍色"]);
});

test("同商品不同款式只扣選中的款式並更新總庫存", () => {
  const row = productRow(baseProduct.variantOptions);
  const sheet = productSheetHarness(row);
  context.spreadsheet_ = () => ({ getSheetByName: () => sheet });
  const reservation = context.prepareInventoryReservation_([
    { productId: "p1", variant: "紅色", variantId: "v-red123", qty: 2 },
  ], { exchangeRate: 0.022 });
  const update = reservation.updates[0];
  const next = JSON.parse(update.newVariantOptionsJson);
  assert.equal(next.find((option) => option.id === "v-red123").stockQuantity, 0);
  assert.equal(next.find((option) => option.id === "v-blue12").stockQuantity, 3);
  assert.equal(update.newStock, 3);
  assert.equal(update.newStatus, "上架");
  const beforeJson = row[14];
  context.applyInventoryReservationUpdate_(sheet, update, false);
  assert.equal(JSON.parse(row[14]).find((option) => option.id === "v-red123").stockQuantity, 0);
  assert.equal(row[12], 3);
  context.applyInventoryReservationUpdate_(sheet, update, true);
  assert.equal(row[14], beforeJson);
  assert.equal(row[12], 5);
});

test("同款式多筆會合併檢查，最後一件不會被超賣", () => {
  const row = productRow([{ id: "v-red123", name: "紅色", stockQuantity: 1, imageUrl: "" }]);
  const sheet = productSheetHarness(row);
  context.spreadsheet_ = () => ({ getSheetByName: () => sheet });
  assert.throws(() => context.prepareInventoryReservation_([
    { productId: "p1", variant: "紅色", variantId: "v-red123", qty: 1 },
    { productId: "p1", variant: "紅色", variantId: "v-red123", qty: 1 },
  ], { exchangeRate: 0.022 }), /OUT_OF_STOCK/);
});

test("整筆取消只回補原款式，並可完整回滾", () => {
  const row = productRow([
    { id: "v-red123", name: "紅色", stockQuantity: 0, imageUrl: "https://example.com/red.jpg" },
    { id: "v-blue12", name: "藍色", stockQuantity: 3, imageUrl: "" },
  ]);
  row[12] = 3;
  const sheet = productSheetHarness(row);
  context.spreadsheet_ = () => ({ getSheetByName: () => sheet });
  const beforeJson = row[14];
  const plan = context.prepareInventoryRestock_(JSON.stringify([
    { productId: "p1", variant: "紅色", variantId: "v-red123", variantImageUrl: "https://example.com/red.jpg", qty: 2 },
  ]));
  context.applyInventoryRestock_(plan, false);
  let options = JSON.parse(row[14]);
  assert.equal(options.find((option) => option.id === "v-red123").stockQuantity, 2);
  assert.equal(options.find((option) => option.id === "v-blue12").stockQuantity, 3);
  assert.equal(row[12], 5);
  context.applyInventoryRestock_(plan, true);
  assert.equal(row[14], beforeJson);
  assert.equal(row[12], 3);
});

test("款式商品禁止使用商品卡片直接覆寫總庫存", () => {
  const row = productRow(baseProduct.variantOptions);
  const sheet = productSheetHarness(row);
  context.requireAdmin_ = () => {};
  context.setupQuokkaPreorder = () => {};
  context.spreadsheet_ = () => ({ getSheetByName: () => sheet });
  context.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  assert.throws(() => context.handleAdminUpdateProductStock_({ productId: "p1", stockQuantity: 9 }), /VARIANT_STOCK_REQUIRED/);
});

test("前台會依款式換圖、停用售罄選項並送出款式識別碼", () => {
  const storefront = fs.readFileSync("storefront.js", "utf8");
  assert.match(storefront, /selected\?\.imageUrl/);
  assert.match(storefront, /option\.stockQuantity\) === 0 \? "disabled"/);
  assert.match(storefront, /variantId: item\.variantId \|\| ""/);
  assert.match(storefront, /item\.variantImageUrl \|\| productImageUrls/);
});

test("後台提供款式新增、個別庫存與個別照片操作", () => {
  const admin = fs.readFileSync("admin.js", "utf8");
  const html = fs.readFileSync("admin.html", "utf8");
  assert.match(admin, /function addVariantOption\(/);
  assert.match(admin, /async function uploadVariantImage\(/);
  assert.match(html, /id="variantOptionList"/);
  assert.match(html, /id="variantImageInput"/);
});

console.log(`\n${passed} variant inventory tests passed.`);
