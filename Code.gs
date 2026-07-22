/**
 * 鼠購易｜韓國小物預購 GAS 後端
 *
 * 部署前請在「專案設定 → 指令碼屬性」加入：
 * LINE_CHANNEL_ID       LINE Login Channel ID（數字）
 * LINE_MESSAGING_ACCESS_TOKEN  Messaging API 長效權杖
 * ADMIN_LINE_USER_IDS   可使用後台的 LINE User ID，多個以逗號分隔
 * SPREADSHEET_ID        選填；綁定試算表時可不填
 */

var PRODUCT_HEADERS_ = [
  "id", "name", "category", "imageUrl", "krwPrice", "variants",
  "description", "status", "sortOrder", "createdAt", "updatedAt", "priceTwd"
];

var ORDER_HEADERS_ = [
  "orderNo", "createdAt", "lineUserId", "lineDisplayName", "customerName",
  "phone", "itemsJson", "itemsSummary", "totalQty", "estimatedTotal",
  "depositTotal", "estimatedBalance", "paymentMethod", "transferLast5",
  "note", "status", "socialProfileId", "shippingStatus", "shippedAt"
];

var SETTING_HEADERS_ = ["key", "value", "label"];
var DEFAULT_SETTINGS_ = {
  exchangeRate: 0.022,
  preorderNotice: "商品下訂後才會採購。下單先付商品總額的 50% 訂金，回國後再支付剩餘商品款。",
  bankTransferInfo: "",
  bankName: "",
  bankCode: "",
  bankAccount: "",
  bankAccountName: "",
  bankQrUrl: "",
  iopenMallUrl: ""
};
var PRODUCT_IMAGE_FOLDER_ = "quokka-preorder-product-images";

function doGet(e) {
  var action = String(e && e.parameter && e.parameter.action || "").trim();
  if (action === "readPublicCatalog") return handleReadPublicCatalog_();
  return json_({ ok: false, error: "UNSUPPORTED_ACTION" });
}

function doPost(e) {
  try {
    var data = JSON.parse(e && e.postData ? e.postData.contents : "{}");
    var action = String(data.action || "").trim();

    if (action === "createPreorder") return handleCreatePreorder_(data);
    if (action === "confirmPreorderPayment") return handleConfirmPreorderPayment_(data);
    if (action === "readMyPreorders") return handleReadMyPreorders_(data);
    if (action === "adminLogin") return handleAdminLogin_(data);
    if (action === "adminReadProducts") return handleAdminReadProducts_(data);
    if (action === "adminToggleOrderShipping") return handleAdminToggleOrderShipping_(data);
    if (action === "adminSaveProduct") return handleAdminSaveProduct_(data);
    if (action === "adminToggleProduct") return handleAdminToggleProduct_(data);
    if (action === "adminUploadProductImage") return handleAdminUploadProductImage_(data);
    if (action === "adminSaveSettings") return handleAdminSaveSettings_(data);

    return json_({ ok: false, error: "UNSUPPORTED_ACTION" });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: safeError_(error) });
  }
}

function handleAdminLogin_(data) {
  var expectedCode = PropertiesService.getScriptProperties().getProperty("ADMIN_ACCESS_CODE") || "";
  var providedCode = String(data && data.accessCode || "").trim();
  if (!expectedCode) throw new Error("ADMIN_ACCESS_CODE_MISSING");
  if (!providedCode || providedCode !== expectedCode) throw new Error("ADMIN_LOGIN_FAILED");
  var token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put("admin-session-" + token, "1", 21600);
  return json_({ ok: true, adminSessionToken: token, expiresIn: 21600 });
}

function setupQuokkaPreorder() {
  var ss = spreadsheet_();
  ensureSheet_(ss, "Products", PRODUCT_HEADERS_);
  ensureSheet_(ss, "Preorders", ORDER_HEADERS_);
  ensureSettingsSheet_(ss);
  return "設定完成";
}

function handleReadPublicCatalog_() {
  try {
    setupQuokkaPreorder();
    var products = readProducts_().filter(function (product) {
      return product.active === true;
    });
    return json_({ ok: true, products: products, settings: readSettings_() });
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: "CATALOG_UNAVAILABLE" });
  }
}

function handleCreatePreorder_(data) {
  var profile = verifyLineIdToken_(data.idToken);
  var lock = LockService.getScriptLock();
  var orderResult;
  lock.waitLock(20000);
  try {
    setupQuokkaPreorder();
    validatePreorderFields_(data);
    var catalog = readProducts_();
    var productMap = {};
    catalog.forEach(function (product) { productMap[product.id] = product; });

    var cleanItems = [];
    var totalQty = 0;
    var estimatedTotal = 0;
    data.items.forEach(function (sourceItem) {
      var productId = String(sourceItem && sourceItem.productId || "").trim();
      var product = productMap[productId];
      var qty = Number(sourceItem && sourceItem.qty);
      if (!product || !product.active || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        throw new Error("PRODUCT_CHANGED");
      }
      var variant = String(sourceItem.variant || "").trim();
      if (product.variants.length && product.variants.indexOf(variant) === -1) {
        throw new Error("PRODUCT_CHANGED");
      }
      var unitTwd = product.priceTwd;
      cleanItems.push({
        productId: product.id,
        name: product.name,
        variant: variant,
        qty: qty,
        unitPriceTwd: unitTwd,
        subtotalTwd: unitTwd * qty
      });
      totalQty += qty;
      estimatedTotal += unitTwd * qty;
    });

    if (!cleanItems.length || totalQty > 100) throw new Error("INVALID_ITEMS");
    var depositTotal = Math.round(estimatedTotal * 0.5);
    var estimatedBalance = estimatedTotal - depositTotal;
    var now = new Date();
    var orderNo = createOrderNo_(now);
    var itemsSummary = cleanItems.map(function (item) {
      return item.name + (item.variant ? "｜" + item.variant : "") + " × " + item.qty;
    }).join("\n");
    var sheet = spreadsheet_().getSheetByName("Preorders");
    sheet.appendRow([
      orderNo,
      formatDateTime_(now),
      profile.sub,
      String(data.lineDisplayName || profile.name || "").trim().slice(0, 80),
      cleanText_(data.customerName, 30),
      cleanText_(data.phone, 20),
      JSON.stringify(cleanItems),
      itemsSummary,
      totalQty,
      estimatedTotal,
      depositTotal,
      estimatedBalance,
      "",
      "",
      cleanText_(data.note, 300),
      "待人工確認",
      "",
      "未出貨",
      ""
    ]);
    orderResult = {
      orderNo: orderNo,
      customerName: cleanText_(data.customerName, 30),
      itemsSummary: itemsSummary,
      totalQty: totalQty,
      estimatedTotal: estimatedTotal,
      depositTotal: depositTotal,
      estimatedBalance: estimatedBalance
    };
  } finally {
    lock.releaseLock();
  }
  var botMessageSent = pushOrderSuccessCard_(profile.sub, orderResult);
  return json_({
    ok: true,
    orderNo: orderResult.orderNo,
    estimatedTotal: orderResult.estimatedTotal,
    depositTotal: orderResult.depositTotal,
    estimatedBalance: orderResult.estimatedBalance,
    botMessageSent: botMessageSent
  });
}

function pushOrderSuccessCard_(lineUserId, order) {
  var accessToken = PropertiesService.getScriptProperties().getProperty("LINE_MESSAGING_ACCESS_TOKEN") || "";
  if (!accessToken || !lineUserId) return false;
  var message = buildOrderSuccessMessage_(order);
  var payload = { to: lineUserId, messages: [message] };
  try {
    var response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + accessToken },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      console.log("LINE push sent: " + order.orderNo);
      return true;
    }
    console.error("LINE push failed: " + code + " " + response.getContentText());
  } catch (error) {
    console.error("LINE push failed: " + safeError_(error));
  }
  return false;
}

function buildOrderSuccessMessage_(order) {
  var transferRequestText = "您好，我想索取匯款資訊\n訂單編號：" + order.orderNo + "\n收件人姓名：" + order.customerName;
  var reportText = "您好，我要回報匯款\n訂單編號：" + order.orderNo + "\n收件人姓名：" + order.customerName + "\n匯款後三碼：";
  var reportUrl = "https://line.me/R/oaMessage/%40527tnlnn/?" + encodeURIComponent(reportText);
  var bodyContents = [
    { type: "text", text: order.itemsSummary, wrap: true, size: "sm", color: "#304B59" },
    { type: "separator", margin: "lg", color: "#E6DED5" },
    moneyRow_("商品總件數", formatMoney_(order.totalQty) + " 件"),
    moneyRow_("商品總額", "NT$" + formatMoney_(order.estimatedTotal)),
    moneyRow_("本次訂金（50%）", "NT$" + formatMoney_(order.depositTotal), "#EF0025"),
    moneyRow_("回國後剩餘商品款", "NT$" + formatMoney_(order.estimatedBalance)),
    { type: "separator", margin: "lg", color: "#E6DED5" },
    { type: "text", text: "需要匯款嗎？", weight: "bold", size: "sm", margin: "lg", color: "#304B59" },
    { type: "text", text: "請按下方「匯款資訊」，系統會送出文字訊息，由管理方提供帳戶。", wrap: true, size: "xs", margin: "sm", color: "#75858D" }
  ];
  return {
      type: "flex",
      altText: "訂單已成立｜" + order.orderNo + "｜應付訂金 NT$" + formatMoney_(order.depositTotal),
      contents: {
        type: "bubble",
        styles: {
          header: { backgroundColor: "#47748E" },
          footer: { separator: true, separatorColor: "#E6DED5" }
        },
        header: {
          type: "box", layout: "vertical", paddingAll: "18px",
          contents: [
            { type: "text", text: "預購訂單已成立", color: "#FFFFFF", weight: "bold", size: "xl" },
            { type: "text", text: order.orderNo, color: "#DCECF3", size: "sm", margin: "sm" }
          ]
        },
        body: {
          type: "box", layout: "vertical", paddingAll: "18px", backgroundColor: "#FFFDF7",
          contents: bodyContents
        },
        footer: {
          type: "box", layout: "vertical", paddingAll: "14px", spacing: "sm",
          contents: [
            {
              type: "button", style: "primary", color: "#47748E", height: "sm",
              action: { type: "message", label: "匯款資訊", text: transferRequestText }
            },
            {
              type: "button", style: "secondary", height: "sm",
              action: { type: "uri", label: "已匯款，前往回報", uri: reportUrl }
            }
          ]
        }
      }
    };
}

function moneyRow_(label, value, valueColor) {
  return {
    type: "box", layout: "horizontal", margin: "md",
    contents: [
      { type: "text", text: label, size: "sm", color: "#75858D", flex: 3 },
      { type: "text", text: value, size: "sm", color: valueColor || "#304B59", weight: "bold", align: "end", flex: 2 }
    ]
  };
}

function formatMoney_(value) {
  return Math.round(number_(value)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function handleConfirmPreorderPayment_(data) {
  var profile = verifyLineIdToken_(data.idToken);
  var orderNo = String(data.orderNo || "").trim();
  var transferLast5 = String(data.transferLast5 || "").trim();
  if (!orderNo) throw new Error("ORDER_NOT_FOUND");
  if (!/^\d{5}$/.test(transferLast5)) throw new Error("INVALID_TRANSFER_LAST5");
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Preorders");
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error("ORDER_NOT_FOUND");
    var values = sheet.getRange(2, 1, lastRow - 1, ORDER_HEADERS_.length).getDisplayValues();
    for (var index = values.length - 1; index >= 0; index--) {
      var row = values[index];
      if (String(row[0]).trim() !== orderNo) continue;
      if (String(row[2]).trim() !== profile.sub) throw new Error("ORDER_FORBIDDEN");
      sheet.getRange(index + 2, 13).setValue("銀行轉帳");
      sheet.getRange(index + 2, 14).setValue(transferLast5);
      sheet.getRange(index + 2, 16).setValue("待確認訂金");
      return json_({ ok: true, orderNo: orderNo, status: "待確認訂金" });
    }
    throw new Error("ORDER_NOT_FOUND");
  } finally {
    lock.releaseLock();
  }
}

function handleReadMyPreorders_(data) {
  var profile = verifyLineIdToken_(data.idToken);
  setupQuokkaPreorder();
  var sheet = spreadsheet_().getSheetByName("Preorders");
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return json_({ ok: true, orders: [] });
  var rows = sheet.getRange(2, 1, lastRow - 1, ORDER_HEADERS_.length).getDisplayValues();
  var orders = [];
  for (var index = rows.length - 1; index >= 0 && orders.length < 50; index--) {
    var row = rows[index];
    if (String(row[2]).trim() !== profile.sub) continue;
    orders.push({
      orderNo: row[0], createdAt: row[1], itemsSummary: row[7],
      estimatedTotal: number_(row[9]), depositTotal: number_(row[10]),
      estimatedBalance: number_(row[11]), status: row[15]
    });
  }
  return json_({ ok: true, orders: orders });
}

function handleAdminReadProducts_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  setupQuokkaPreorder();
  return json_({
    ok: true,
    products: readProducts_(),
    orders: readAdminOrders_(),
    settings: readSettings_(),
    purchaseSummary: readPurchaseSummary_()
  });
}

function readAdminOrders_() {
  var sheet = spreadsheet_().getSheetByName("Preorders");
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, ORDER_HEADERS_.length).getDisplayValues();
  return rows.filter(function (row) { return String(row[0] || "").trim(); }).map(function (row) {
    var items = [];
    try { items = JSON.parse(row[6] || "[]"); } catch (error) { items = []; }
    return {
      orderNo: row[0], createdAt: row[1], lineDisplayName: row[3], customerName: row[4],
      phone: row[5], items: Array.isArray(items) ? items : [], itemsSummary: row[7],
      totalQty: number_(row[8]), estimatedTotal: number_(row[9]), depositTotal: number_(row[10]),
      estimatedBalance: number_(row[11]), paymentMethod: row[12], transferLast5: row[13],
      note: row[14], status: row[15], socialProfileId: row[16],
      shippingStatus: String(row[17] || "").trim() === "已出貨" ? "已出貨" : "未出貨",
      shippedAt: row[18]
    };
  }).reverse().slice(0, 300);
}

function handleAdminToggleOrderShipping_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var orderNo = String(data.orderNo || "").trim();
  if (!orderNo || typeof data.shipped !== "boolean") throw new Error("INVALID_ORDER_STATUS");
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Preorders");
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error("ORDER_NOT_FOUND");
    var orderNos = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (var index = 0; index < orderNos.length; index++) {
      if (String(orderNos[index][0] || "").trim() !== orderNo) continue;
      var rowNumber = index + 2;
      var shippingStatus = data.shipped ? "已出貨" : "未出貨";
      var shippedAt = data.shipped ? formatDateTime_(new Date()) : "";
      sheet.getRange(rowNumber, 18, 1, 2).setValues([[shippingStatus, shippedAt]]);
      return json_({ ok: true, order: { orderNo: orderNo, shippingStatus: shippingStatus, shippedAt: shippedAt } });
    }
    throw new Error("ORDER_NOT_FOUND");
  } finally {
    lock.releaseLock();
  }
}

function readPurchaseSummary_() {
  var sheet = spreadsheet_().getSheetByName("Preorders");
  var lastRow = sheet ? sheet.getLastRow() : 0;
  if (lastRow < 2) return { orderCount: 0, totalQty: 0, items: [] };
  var rows = sheet.getRange(2, 1, lastRow - 1, ORDER_HEADERS_.length).getDisplayValues();
  var orderCount = 0;
  var totalQty = 0;
  var grouped = {};
  rows.forEach(function (row) {
    if (!String(row[0] || "").trim()) return;
    if (String(row[15] || "").trim() === "已取消") return;
    orderCount += 1;
    totalQty += number_(row[8]);
    try {
      var items = JSON.parse(row[6] || "[]");
      if (!Array.isArray(items)) return;
      items.forEach(function (item) {
        var productId = String(item.productId || "").trim();
        var name = String(item.name || "未命名商品").trim();
        var variant = String(item.variant || "").trim();
        var key = productId + "\n" + name + "\n" + variant;
        if (!grouped[key]) grouped[key] = { name: name, variant: variant, qty: 0 };
        grouped[key].qty += number_(item.qty);
      });
    } catch (error) {
      console.warn("Invalid itemsJson in order " + String(row[0] || ""));
    }
  });
  var items = Object.keys(grouped).map(function (key) { return grouped[key]; });
  items.sort(function (a, b) {
    return b.qty - a.qty || a.name.localeCompare(b.name) || a.variant.localeCompare(b.variant);
  });
  return { orderCount: orderCount, totalQty: totalQty, items: items };
}

function handleAdminSaveProduct_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var product = validateProduct_(data.product);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Products");
    var now = formatDateTime_(new Date());
    var rowNumber = product.id ? findProductRow_(sheet, product.id) : 0;
    if (product.id && !rowNumber) throw new Error("PRODUCT_NOT_FOUND");
    if (!product.id) product.id = "p-" + Utilities.getUuid().slice(0, 12);
    var createdAt = rowNumber ? sheet.getRange(rowNumber, 10).getDisplayValue() : now;
    var row = [
      product.id, product.name, product.category, product.imageUrl, "",
      product.variants.join("\n"), product.description, product.active ? "上架" : "下架",
      product.sortOrder, createdAt, now, product.priceTwd
    ];
    if (rowNumber) sheet.getRange(rowNumber, 1, 1, PRODUCT_HEADERS_.length).setValues([row]);
    else sheet.appendRow(row);
    return json_({ ok: true, product: rowToProduct_(row, readSettings_().exchangeRate) });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminToggleProduct_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var productId = String(data.productId || "").trim();
  if (!productId || typeof data.active !== "boolean") throw new Error("INVALID_PRODUCT");
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Products");
    var rowNumber = findProductRow_(sheet, productId);
    if (!rowNumber) throw new Error("PRODUCT_NOT_FOUND");
    sheet.getRange(rowNumber, 8).setValue(data.active ? "上架" : "下架");
    sheet.getRange(rowNumber, 11).setValue(formatDateTime_(new Date()));
    var row = sheet.getRange(rowNumber, 1, 1, PRODUCT_HEADERS_.length).getValues()[0];
    return json_({ ok: true, product: rowToProduct_(row, readSettings_().exchangeRate) });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminUploadProductImage_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var mimeType = String(data.mimeType || "").trim();
  var base64Data = String(data.base64Data || "").trim();
  if (["image/jpeg", "image/png", "image/webp"].indexOf(mimeType) === -1 || !base64Data) {
    throw new Error("INVALID_IMAGE");
  }
  if (base64Data.length > 7 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");
  var folder = getOrCreateImageFolder_();
  var safeName = sanitizeFileName_(data.fileName || "product.jpg");
  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, safeName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileId = file.getId();
  return json_({
    ok: true,
    fileId: fileId,
    imageUrl: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1600"
  });
}

function handleAdminSaveSettings_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var source = data.settings || {};
  var currentSettings = readSettings_();
  var settings = {
    exchangeRate: currentSettings.exchangeRate,
    preorderNotice: cleanText_(source.preorderNotice, 300),
    bankTransferInfo: cleanText_(source.bankTransferInfo, 300),
    bankName: cleanText_(source.bankName, 50),
    bankCode: cleanText_(source.bankCode, 10),
    bankAccount: cleanText_(source.bankAccount, 30),
    bankAccountName: cleanText_(source.bankAccountName, 50),
    bankQrUrl: cleanText_(source.bankQrUrl, 500),
    iopenMallUrl: cleanText_(source.iopenMallUrl, 500)
  };
  if (settings.bankQrUrl && !/^https:\/\//i.test(settings.bankQrUrl)) throw new Error("INVALID_SETTINGS");
  if (settings.iopenMallUrl && !/^https:\/\//i.test(settings.iopenMallUrl)) throw new Error("INVALID_SETTINGS");

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Settings");
    var rows = [
      ["exchangeRate", settings.exchangeRate, "韓幣換算率"],
      ["preorderNotice", settings.preorderNotice, "前台預購說明"],
      ["bankTransferInfo", settings.bankTransferInfo, "訂金匯款資訊"],
      ["bankName", settings.bankName, "銀行名稱"],
      ["bankCode", settings.bankCode, "銀行代碼"],
      ["bankAccount", settings.bankAccount, "匯款帳號"],
      ["bankAccountName", settings.bankAccountName, "匯款戶名"],
      ["bankQrUrl", settings.bankQrUrl, "匯款 QR Code"],
      ["iopenMallUrl", settings.iopenMallUrl, "iOPEN Mall 網址"]
    ];
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, SETTING_HEADERS_.length).clearContent();
    sheet.getRange(2, 1, rows.length, SETTING_HEADERS_.length).setValues(rows);
    return json_({ ok: true, settings: readSettings_() });
  } finally {
    lock.releaseLock();
  }
}

function validatePreorderFields_(data) {
  if (!data || !Array.isArray(data.items) || !data.items.length) throw new Error("INVALID_ITEMS");
  if (!String(data.customerName || "").trim() || !String(data.phone || "").trim()) throw new Error("INVALID_CUSTOMER");
}

function validateProduct_(source) {
  source = source || {};
  var variants = Array.isArray(source.variants) ? source.variants : [];
  variants = variants.map(function (value) { return cleanText_(value, 50); }).filter(Boolean);
  if (variants.length > 30) throw new Error("INVALID_PRODUCT");
  var product = {
    id: String(source.id || "").trim(),
    name: cleanText_(source.name, 100),
    category: cleanText_(source.category, 30),
    imageUrl: cleanText_(source.imageUrl, 500),
    priceTwd: Number(source.priceTwd),
    variants: variants,
    description: cleanText_(source.description, 500),
    active: source.active === true,
    sortOrder: Number(source.sortOrder || 0)
  };
  if (!product.name || !product.category || !product.imageUrl) throw new Error("INVALID_PRODUCT");
  if (!/^https:\/\//i.test(product.imageUrl)) throw new Error("INVALID_PRODUCT");
  if (!Number.isInteger(product.priceTwd) || product.priceTwd < 1 || product.priceTwd > 100000000) throw new Error("INVALID_PRODUCT");
  if (!Number.isInteger(product.sortOrder) || product.sortOrder < 0 || product.sortOrder > 9999) throw new Error("INVALID_PRODUCT");
  return product;
}

function readProducts_() {
  var sheet = spreadsheet_().getSheetByName("Products");
  if (!sheet || sheet.getLastRow() < 2) return [];
  var legacyExchangeRate = readSettings_().exchangeRate;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, PRODUCT_HEADERS_.length).getValues();
  return rows.filter(function (row) { return String(row[0] || "").trim(); }).map(function (row) {
    return rowToProduct_(row, legacyExchangeRate);
  }).sort(function (a, b) {
    return a.sortOrder - b.sortOrder || String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
}

function rowToProduct_(row, legacyExchangeRate) {
  var priceTwd = number_(row[11]);
  if (!priceTwd) priceTwd = Math.round(number_(row[4]) * number_(legacyExchangeRate || DEFAULT_SETTINGS_.exchangeRate));
  return {
    id: String(row[0] || "").trim(),
    name: String(row[1] || "").trim(),
    category: String(row[2] || "").trim(),
    imageUrl: String(row[3] || "").trim(),
    priceTwd: priceTwd,
    variants: String(row[5] || "").split(/\n/).map(function (value) { return value.trim(); }).filter(Boolean),
    description: String(row[6] || "").trim(),
    active: String(row[7] || "").trim() === "上架",
    sortOrder: number_(row[8]),
    createdAt: displayDate_(row[9]),
    updatedAt: displayDate_(row[10])
  };
}

function readSettings_() {
  var settings = Object.assign({}, DEFAULT_SETTINGS_);
  var sheet = spreadsheet_().getSheetByName("Settings");
  if (!sheet || sheet.getLastRow() < 2) return settings;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  rows.forEach(function (row) {
    var key = String(row[0] || "").trim();
    if (key === "exchangeRate") settings.exchangeRate = number_(row[1]) || DEFAULT_SETTINGS_.exchangeRate;
    if (key === "preorderNotice") settings.preorderNotice = String(row[1] || "").trim();
    if (key === "bankTransferInfo") settings.bankTransferInfo = String(row[1] || "").trim();
    if (key === "bankName") settings.bankName = String(row[1] || "").trim();
    if (key === "bankCode") settings.bankCode = String(row[1] || "").trim();
    if (key === "bankAccount") settings.bankAccount = String(row[1] || "").trim();
    if (key === "bankAccountName") settings.bankAccountName = String(row[1] || "").trim();
    if (key === "bankQrUrl") settings.bankQrUrl = String(row[1] || "").trim();
    if (key === "iopenMallUrl") settings.iopenMallUrl = String(row[1] || "").trim();
  });
  if (settings.preorderNotice === "商品下訂後才會採購。代購費為商品費用外加；若韓國現場缺貨，該商品代購費將全額退回。") {
    settings.preorderNotice = DEFAULT_SETTINGS_.preorderNotice;
  }
  if (settings.preorderNotice === "商品下訂後才會採購。下單先付商品預估總額的 50% 訂金，回國後再支付剩餘商品款。") {
    settings.preorderNotice = DEFAULT_SETTINGS_.preorderNotice;
  }
  return settings;
}

function requireAdmin_(idToken, adminSessionToken) {
  var token = String(adminSessionToken || "").trim();
  if (token && CacheService.getScriptCache().get("admin-session-" + token) === "1") {
    return { sub: "access-code-admin", name: "Admin" };
  }
  var profile = verifyLineIdToken_(idToken);
  var rawIds = PropertiesService.getScriptProperties().getProperty("ADMIN_LINE_USER_IDS") || "";
  var ids = rawIds.split(",").map(function (value) { return value.trim(); }).filter(Boolean);
  if (!ids.length) throw new Error("ADMIN_CONFIG_MISSING");
  if (ids.indexOf(profile.sub) === -1) throw new Error("ADMIN_FORBIDDEN");
  return profile;
}

function verifyLineIdToken_(idToken) {
  idToken = String(idToken || "").trim();
  if (!idToken) throw new Error("LINE_LOGIN_REQUIRED");
  var channelId = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ID");
  if (!channelId) throw new Error("LINE_CONFIG_MISSING");
  var cache = CacheService.getScriptCache();
  var cacheKey = "line-" + sha256_(idToken).slice(0, 32);
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);
  var response = UrlFetchApp.fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "post",
    payload: { id_token: idToken, client_id: channelId },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error("LINE_TOKEN_INVALID");
  var profile = JSON.parse(response.getContentText());
  if (!profile.sub || String(profile.aud) !== String(channelId)) throw new Error("LINE_TOKEN_INVALID");
  cache.put(cacheKey, JSON.stringify({ sub: profile.sub, name: profile.name || "" }), 300);
  return { sub: profile.sub, name: profile.name || "" };
}

function spreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("SPREADSHEET_CONFIG_MISSING");
  return active;
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var actual = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  headers.forEach(function (header, index) {
    if (!actual[index]) sheet.getRange(1, index + 1).setValue(header);
    else if (actual[index] !== header) throw new Error(name.toUpperCase() + "_HEADER_MISMATCH");
  });
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureSettingsSheet_(ss) {
  var sheet = ensureSheet_(ss, "Settings", SETTING_HEADERS_);
  if (sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, 9, 3).setValues([
      ["exchangeRate", DEFAULT_SETTINGS_.exchangeRate, "韓幣換算率"],
      ["preorderNotice", DEFAULT_SETTINGS_.preorderNotice, "前台預購說明"],
      ["bankTransferInfo", "", "訂金匯款資訊"],
      ["bankName", "", "銀行名稱"],
      ["bankCode", "", "銀行代碼"],
      ["bankAccount", "", "匯款帳號"],
      ["bankAccountName", "", "匯款戶名"],
      ["bankQrUrl", "", "匯款 QR Code"],
      ["iopenMallUrl", "", "iOPEN Mall 網址"]
    ]);
  }
  return sheet;
}

function findProductRow_(sheet, productId) {
  if (sheet.getLastRow() < 2) return 0;
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (var index = 0; index < ids.length; index++) if (ids[index][0] === productId) return index + 2;
  return 0;
}

function getOrCreateImageFolder_() {
  var folders = DriveApp.getFoldersByName(PRODUCT_IMAGE_FOLDER_);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(PRODUCT_IMAGE_FOLDER_);
}

function sanitizeFileName_(value) {
  var name = String(value || "product.jpg").replace(/[\\/:*?"<>|#%{}~&]/g, "-").slice(0, 80) || "product.jpg";
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss-") + name;
}

function createOrderNo_(date) {
  return "QK" + Utilities.formatDate(date, Session.getScriptTimeZone(), "yyMMdd") + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 6).toUpperCase();
}

function cleanText_(value, maxLength) { return String(value || "").trim().slice(0, maxLength); }
function number_(value) { var number = Number(String(value || 0).replace(/,/g, "")); return Number.isFinite(number) ? number : 0; }
function formatDateTime_(date) { return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"); }
function displayDate_(value) { return value instanceof Date ? formatDateTime_(value) : String(value || "").trim(); }
function sha256_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value).map(function (byte) { var v = byte < 0 ? byte + 256 : byte; return ("0" + v.toString(16)).slice(-2); }).join(""); }
function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
function safeError_(error) {
  var message = String(error && error.message || error || "UNKNOWN_ERROR");
  var allowed = [
    "ADMIN_FORBIDDEN", "ADMIN_CONFIG_MISSING", "ADMIN_ACCESS_CODE_MISSING", "ADMIN_LOGIN_FAILED", "LINE_LOGIN_REQUIRED", "LINE_CONFIG_MISSING",
    "LINE_TOKEN_INVALID", "INVALID_ITEMS", "INVALID_CUSTOMER", "INVALID_TRANSFER_LAST5",
    "ORDER_NOT_FOUND", "ORDER_FORBIDDEN", "INVALID_ORDER_STATUS",
    "INVALID_PRODUCT", "PRODUCT_CHANGED", "PRODUCT_NOT_FOUND", "INVALID_IMAGE",
    "IMAGE_TOO_LARGE", "INVALID_SETTINGS", "SPREADSHEET_CONFIG_MISSING"
  ];
  return allowed.indexOf(message) >= 0 ? message : "SERVER_ERROR";
}
