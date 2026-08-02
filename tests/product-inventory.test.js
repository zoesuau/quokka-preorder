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

const baseProduct = {
  name: "測試商品",
  category: "吊飾",
  imageUrl: "https://example.com/cover.jpg",
  imageUrls: [
    "https://example.com/cover.jpg",
    "https://example.com/detail.jpg",
  ],
  krwPrice: 1000,
  priceTwd: 100,
  variants: [],
  description: "",
  active: true,
  sortOrder: 1,
  featuredOrder: 0,
  stockQuantity: 1,
};

test("庫存為 0 時後端強制下架", () => {
  const product = context.validateProduct_({ ...baseProduct, stockQuantity: 0 });
  assert.equal(product.active, false);
});

test("置頂順序允許留白但拒絕負數與小數", () => {
  assert.equal(context.validateProduct_(baseProduct).featuredOrder, 0);
  assert.throws(() => context.validateProduct_({ ...baseProduct, featuredOrder: -1 }), /INVALID_PRODUCT/);
  assert.throws(() => context.validateProduct_({ ...baseProduct, featuredOrder: 1.5 }), /INVALID_PRODUCT/);
});

test("既有未設定庫存的商品維持原上架狀態", () => {
  const row = ["p1", "舊商品", "吊飾", "https://example.com/legacy.jpg", 1000, "", "", "上架", 1, "2026", "2026", 100, "", ""];
  const product = context.rowToProduct_(row, 0.022);
  assert.equal(product.active, true);
  assert.equal(product.stockQuantity, null);
  assert.deepEqual(Array.from(product.imageUrls), ["https://example.com/legacy.jpg"]);
});

test("封存商品保留資料但不可上架", () => {
  const row = ["p1", "封存商品", "吊飾", "https://example.com/legacy.jpg", 1000, "", "", "已封存", 1, "2026", "2026", 100, 3, "[]"];
  const product = context.rowToProduct_(row, 0.022);
  assert.equal(product.active, false);
  assert.equal(product.archived, true);
  assert.equal(product.stockQuantity, 3);
});

test("新商品可保存多張照片且第一張是封面", () => {
  const product = context.validateProduct_(baseProduct);
  assert.equal(product.imageUrl, baseProduct.imageUrls[0]);
  assert.deepEqual(Array.from(product.imageUrls), baseProduct.imageUrls);
});

test("超過 10 張照片會被拒絕", () => {
  assert.throws(() => context.validateProduct_({
    ...baseProduct,
    imageUrls: Array.from({ length: 11 }, (_, index) => `https://example.com/${index}.jpg`),
  }), /INVALID_PRODUCT/);
});

function createStockUpdateHarness(initialStatus = "上架") {
  const row = ["p1", "測試商品", "吊飾", "https://example.com/cover.jpg", 1000, "", "", initialStatus, 1, "created", "updated", 100, 9, "[]"];
  const sheet = {
    getRange(rowNumber, column, rowCount, columnCount) {
      assert.equal(rowNumber, 2);
      if (columnCount) {
        assert.equal(column, 1);
        assert.equal(columnCount, context.PRODUCT_HEADERS_.length);
        return { getValues: () => [row.slice()] };
      }
      return {
        getValue: () => row[column - 1],
        getDisplayValue: () => String(row[column - 1] ?? ""),
        setValue: (value) => { row[column - 1] = value; },
      };
    },
  };
  let cacheInvalidations = 0;
  context.requireAdmin_ = () => {};
  context.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  context.setupQuokkaPreorder = () => {};
  context.spreadsheet_ = () => ({ getSheetByName: () => sheet });
  context.findProductRow_ = () => 2;
  context.formatDateTime_ = () => "now";
  context.invalidatePublicCatalogCache_ = () => { cacheInvalidations += 1; };
  context.readSettings_ = () => ({ exchangeRate: 0.022 });
  context.rowToProduct_ = (savedRow) => ({ id: savedRow[0], active: savedRow[7] === "上架", archived: savedRow[7] === "已封存", stockQuantity: savedRow[12] });
  context.json_ = (payload) => payload;
  return { row, getCacheInvalidations: () => cacheInvalidations };
}

test("卡片庫存設為 0 時同步下架並清除公開目錄快取", () => {
  const harness = createStockUpdateHarness("上架");
  const result = context.handleAdminUpdateProductStock_({ productId: "p1", stockQuantity: 0 });
  assert.equal(result.ok, true);
  assert.equal(result.product.stockQuantity, 0);
  assert.equal(result.product.active, false);
  assert.equal(harness.row[7], "下架");
  assert.equal(harness.getCacheInvalidations(), 1);
});

test("卡片增加庫存時保留原本下架狀態", () => {
  createStockUpdateHarness("下架");
  const result = context.handleAdminUpdateProductStock_({ productId: "p1", stockQuantity: 5 });
  assert.equal(result.product.stockQuantity, 5);
  assert.equal(result.product.active, false);
});

test("封存商品調整庫存後仍保持封存", () => {
  const harness = createStockUpdateHarness("已封存");
  const result = context.handleAdminUpdateProductStock_({ productId: "p1", stockQuantity: 0 });
  assert.equal(result.product.archived, true);
  assert.equal(harness.row[7], "已封存");
});

test("封存與恢復只改狀態，不刪除商品資料列", () => {
  const harness = createStockUpdateHarness("上架");
  const archived = context.handleAdminArchiveProduct_({ productId: "p1", archived: true });
  assert.equal(archived.product.archived, true);
  assert.equal(harness.row[7], "已封存");
  const restored = context.handleAdminArchiveProduct_({ productId: "p1", archived: false });
  assert.equal(restored.product.archived, false);
  assert.equal(restored.product.active, false);
  assert.equal(harness.row[7], "下架");
  assert.equal(harness.getCacheInvalidations(), 2);
});

test("封存商品拒絕由舊頁面的上下架開關重新上架", () => {
  createStockUpdateHarness("已封存");
  assert.throws(
    () => context.handleAdminToggleProduct_({ productId: "p1", active: true }),
    /PRODUCT_ARCHIVED/,
  );
});

test("卡片庫存拒絕負數與小數", () => {
  createStockUpdateHarness();
  assert.throws(() => context.handleAdminUpdateProductStock_({ productId: "p1", stockQuantity: "" }), /INVALID_PRODUCT/);
  assert.throws(() => context.handleAdminUpdateProductStock_({ productId: "p1", stockQuantity: -1 }), /INVALID_PRODUCT/);
  assert.throws(() => context.handleAdminUpdateProductStock_({ productId: "p1", stockQuantity: 1.5 }), /INVALID_PRODUCT/);
});

console.log(`\n${passed} product inventory tests passed.`);
