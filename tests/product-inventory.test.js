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
  stockQuantity: 1,
};

test("庫存為 0 時後端強制下架", () => {
  const product = context.validateProduct_({ ...baseProduct, stockQuantity: 0 });
  assert.equal(product.active, false);
});

test("既有未設定庫存的商品維持原上架狀態", () => {
  const row = ["p1", "舊商品", "吊飾", "https://example.com/legacy.jpg", 1000, "", "", "上架", 1, "2026", "2026", 100, "", ""];
  const product = context.rowToProduct_(row, 0.022);
  assert.equal(product.active, true);
  assert.equal(product.stockQuantity, null);
  assert.deepEqual(Array.from(product.imageUrls), ["https://example.com/legacy.jpg"]);
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

console.log(`\n${passed} product inventory tests passed.`);
