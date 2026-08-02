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

function ids(products) {
  return Array.from(products, (product) => product.id);
}

test("分類依人工順序，未設定的新分類排在最後", () => {
  const products = [
    { id: "stationery", category: "文具", name: "三角尺" },
    { id: "new-category", category: "包袋", name: "小包" },
    { id: "charm", category: "吊飾", name: "小吊飾" },
  ];
  const sorted = context.sortProductsForDisplay_(products, {
    categoryOrder: ["吊飾", "文具"],
  });
  assert.deepEqual(ids(sorted), ["charm", "stationery", "new-category"]);
});

test("同分類置頂商品優先並依置頂數字排列", () => {
  const products = [
    { id: "normal", category: "文具", name: "一盒彩筆", featuredOrder: 0 },
    { id: "second", category: "文具", name: "十元筆", featuredOrder: 2 },
    { id: "first", category: "文具", name: "五色筆", featuredOrder: 1 },
  ];
  const sorted = context.sortProductsForDisplay_(products, {
    categoryOrder: ["文具"],
  });
  assert.deepEqual(ids(sorted), ["first", "second", "normal"]);
});

test("同分類未置頂商品依台灣繁中筆畫排列", () => {
  const products = [
    { id: "five", category: "文具", name: "五色筆" },
    { id: "three", category: "文具", name: "三角尺" },
    { id: "eight", category: "文具", name: "八開畫紙" },
  ];
  const sorted = context.sortProductsForDisplay_(products, {
    categoryOrder: ["文具"],
  });
  assert.deepEqual(ids(sorted), ["eight", "three", "five"]);
});

test("舊 sortOrder 不會阻止新筆畫排序", () => {
  const products = [
    { id: "five", category: "文具", name: "五色筆", sortOrder: 1 },
    { id: "three", category: "文具", name: "三角尺", sortOrder: 99 },
  ];
  const sorted = context.sortProductsForDisplay_(products, {
    categoryOrder: ["文具"],
  });
  assert.deepEqual(ids(sorted), ["three", "five"]);
});

test("分類設定會去除空白、重複並限制長度", () => {
  const normalized = context.normalizeCategoryOrder_([
    " 吊飾 ",
    "吊飾",
    "",
    "文具",
  ]);
  assert.deepEqual(Array.from(normalized), ["吊飾", "文具"]);
});

test("後台具備分類排序控制與選填置頂欄位", () => {
  const html = fs.readFileSync("admin.html", "utf8");
  const script = fs.readFileSync("admin.js", "utf8");
  assert.match(html, /id="categoryOrderList"/);
  assert.match(html, /置頂順序（選填）/);
  assert.match(script, /data-category-move/);
  assert.match(script, /featuredOrder/);
});

console.log(`\n${passed} product sorting tests passed.`);
