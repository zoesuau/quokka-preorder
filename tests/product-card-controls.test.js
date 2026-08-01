const assert = require("node:assert/strict");
const fs = require("node:fs");

const adminJs = fs.readFileSync("admin.js", "utf8");
const adminHtml = fs.readFileSync("admin.html", "utf8");
const adminCss = fs.readFileSync("admin.css", "utf8");
const gas = fs.readFileSync("Code.gs", "utf8");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("商品卡片直接提供庫存、編輯與上下架控制", () => {
  assert.match(adminJs, /data-stock=/);
  assert.match(adminJs, /data-edit=/);
  assert.match(adminJs, /data-toggle=/);
  assert.match(adminJs, /上架中/);
  assert.match(adminJs, /已下架/);
  assert.match(adminJs, /admin-product-meta/);
  assert.match(adminJs, /admin-product-primary/);
});

test("庫存視窗提供 0 到 5 快選與自訂整數輸入", () => {
  for (let quantity = 0; quantity <= 5; quantity += 1) {
    assert.match(adminHtml, new RegExp(`data-stock-quick="${quantity}"`));
  }
  assert.match(adminHtml, /id="stockEditorQuantity"[^>]+min="0"[^>]+max="999999"[^>]+step="1"/);
  assert.match(adminJs, /adminUpdateProductStock/);
});

test("庫存快速更新使用專用後端動作並清除公開目錄快取", () => {
  assert.match(gas, /action === "adminUpdateProductStock"/);
  const start = gas.indexOf("function handleAdminUpdateProductStock_(");
  const next = gas.indexOf("\nfunction ", start + 1);
  const source = gas.slice(start, next);
  assert.match(source, /LockService\.getScriptLock/);
  assert.match(source, /stockQuantity === 0/);
  assert.match(source, /setValue\("下架"\)/);
  assert.match(source, /invalidatePublicCatalogCache_\(\)/);
});

test("卡片主要觸控控制具有可用尺寸與鍵盤焦點", () => {
  assert.match(adminCss, /\.admin-product-edit[^}]+min-height: 44px/);
  assert.match(adminCss, /\.stock-button[^}]+min-height: 44px/);
  assert.match(adminCss, /\.admin-status-switch[^}]+min-height: 44px/);
  assert.match(adminCss, /\.stock-quick-options button[^}]+min-height: 44px/);
  assert.match(adminCss, /\.stock-button:focus-visible/);
  assert.match(adminCss, /\.admin-status-switch input:focus-visible \+ i/);
});

test("商品卡片固定兩排且縮小按鈕視覺佔位", () => {
  assert.match(adminCss, /\.admin-product-card[^}]+min-height: 104px/);
  assert.match(adminCss, /\.admin-product-card > img[^}]+width: 72px[^}]+height: 72px/);
  assert.match(adminCss, /\.admin-product-info[^}]+grid-template-rows: 44px 44px/);
  assert.match(adminCss, /\.admin-product-edit > span[^}]+padding: 3px 7px/);
  assert.match(adminCss, /\.stock-button > span[^}]+padding: 3px 7px/);
  assert.match(adminCss, /-webkit-line-clamp: 2/);
});

console.log(`\n${passed} product card control tests passed.`);
