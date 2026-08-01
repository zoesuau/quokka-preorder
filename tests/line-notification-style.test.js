const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { console };
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

function sampleOrder(overrides = {}) {
  return {
    orderNo: "TEST-NOTIFY-001",
    customerName: "通知測試顧客",
    createdAt: "2026-08-01 14:00:00",
    itemsSummary: "測試商品 × 1",
    totalQty: 1,
    estimatedTotal: 1000,
    depositTotal: 500,
    estimatedBalance: 500,
    depositPercent: 50,
    ...overrides,
  };
}

function messageBox(card) {
  return card.contents.body.contents[0];
}

test("收到預購訂單維持原本無底色的訊息文字", () => {
  const card = context.buildUnifiedOrderSuccessCard_(sampleOrder());
  assert.equal(messageBox(card).type, "text");
  assert.equal(card.contents.styles.header.backgroundColor, "#47748E");
  assert.equal(card.contents.body.backgroundColor, "#FFFDF7");
});

test("付款提醒使用淡粉紅底與紅色文字", () => {
  const card = context.buildUnifiedReminderCard_(
    sampleOrder(),
    "請於期限前完成匯款。",
    "訂金付款提醒",
    "",
  );
  assert.equal(messageBox(card).type, "box");
  assert.equal(messageBox(card).backgroundColor, "#FBE6EA");
  assert.equal(messageBox(card).contents[0].color, "#C13E4D");
});

test("收到訂金的確認區塊使用蛋黃底色", () => {
  const card = context.buildUnifiedDepositReceivedCard_(sampleOrder());
  assert.equal(messageBox(card).backgroundColor, "#FFF0B8");
  assert.equal(messageBox(card).contents[0].color, "#805B00");
});

test("iOPEN Mall 賣場按鈕使用珊瑚紅色", () => {
  const card = context.buildUnifiedMallReadyCard_(
    sampleOrder(),
    "https://mall.example.test/order",
  );
  assert.equal(card.contents.footer.contents[0].color, "#E45F47");
  assert.equal(card.contents.footer.contents[0].action.type, "uri");
});

test("iOPEN Mall 付款提醒沿用同一個珊瑚紅賣場按鈕", () => {
  const card = context.buildUnifiedReminderCard_(
    sampleOrder(),
    "請於期限前完成賣場付款。",
    "iOPEN Mall 付款提醒",
    "https://mall.example.test/order",
  );
  assert.equal(card.contents.footer.contents[0].color, "#E45F47");
  assert.equal(messageBox(card).backgroundColor, "#FBE6EA");
});

test("取消通知整張改為灰階並保留小範圍警示", () => {
  const card = context.buildUnifiedCancellationCard_(
    sampleOrder({ reason: "此筆測試訂單已取消。" }),
  );
  assert.equal(card.contents.styles.header.backgroundColor, "#7C858A");
  assert.equal(card.contents.body.backgroundColor, "#F5F6F6");
  assert.equal(card.contents.header.contents[1].color, "#EEF0F1");
  assert.equal(messageBox(card).backgroundColor, "#E4E6E7");
  assert.equal(messageBox(card).contents[0].color, "#A33F49");
  assert.equal(card.contents.body.contents[8].contents[1].color, "#667178");
});

console.log(`\n${passed} notification style tests passed.`);
