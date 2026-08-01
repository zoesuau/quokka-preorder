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
  "id",
  "name",
  "category",
  "imageUrl",
  "krwPrice",
  "variants",
  "description",
  "status",
  "sortOrder",
  "createdAt",
  "updatedAt",
  "priceTwd",
  "stockQuantity",
  "imageUrlsJson",
];

var ORDER_HEADERS_ = [
  "orderNo",
  "createdAt",
  "lineUserId",
  "lineDisplayName",
  "customerName",
  "phone",
  "itemsJson",
  "itemsSummary",
  "totalQty",
  "estimatedTotal",
  "depositTotal",
  "estimatedBalance",
  "paymentMethod",
  "transferLast5",
  "note",
  "status",
  "socialProfileId",
  "shippingStatus",
  "shippedAt",
  "reminderSentAt",
  "cancelledAt",
  "mallReminderSentAt",
  "originalItemsJson",
  "originalEstimatedTotal",
  "shortageAdjustmentsJson",
  "shortageAdjustedAt",
  "cashRefundDue",
  "cashRefundedAt",
  "shortageNotificationSentAt",
  "paymentReportedAt",
  "orderAdjustmentsJson",
  "orderAdjustedAt",
  "orderAdjustmentNotificationSentAt",
  "orderRevision",
  "depositPercent",
  "paymentReminderAt",
  "paymentDeadlineAt",
  "paymentAutoCancelAt",
  "iopenMallPaymentDays",
  "iopenMallPaymentDeadlineAt",
];

var ORDER_EXPORT_HEADERS_ = [
  "訂單編號",
  "建立時間",
  "LINE User ID",
  "LINE 顯示名稱",
  "訂購人姓名",
  "電話",
  "商品明細 JSON",
  "商品摘要",
  "商品總件數",
  "商品總額",
  "訂金",
  "剩餘商品款",
  "付款方式",
  "匯款末五碼",
  "備註",
  "訂單狀態",
  "社群身分 ID",
  "賣場狀態",
  "開設賣場時間",
  "訂金提醒時間",
  "取消時間",
  "賣場逾期提醒時間",
  "原始商品明細 JSON",
  "原始商品總額",
  "缺貨調整 JSON",
  "缺貨調整時間",
  "待退現金",
  "現金退款完成時間",
  "缺貨通知時間",
  "顧客回報付款時間",
  "訂單調整 JSON",
  "訂單調整時間",
  "訂單調整通知時間",
  "訂單版本",
  "訂金比例",
  "訂金提醒起始時間",
  "顧客付款期限",
  "系統自動取消時間",
  "賣場付款期限天數",
  "賣場付款期限",
];

var CUSTOMER_EXPORT_HEADERS_ = [
  "LINE User ID",
  "LINE 顯示名稱",
  "訂購人姓名",
  "電話",
  "首次下單時間",
  "最近下單時間",
  "總訂單數",
  "有效訂單數",
  "取消訂單數",
  "完成訂單數",
  "有效訂單累計金額",
  "最近訂單狀態",
];

var ORDER_REQUEST_SHEET_NAME_ = "OrderRequestIds";
var ORDER_REQUEST_HEADERS_ = [
  "requestId",
  "orderNo",
  "lineUserId",
  "payloadDigest",
  "createdAt",
  "status",
];

var STRESS_TEST_SHEET_NAME_ = "壓力測試訂單";
var STRESS_TEST_MAX_REQUESTS_ = 20;
var STRESS_TEST_HEADERS_ = [
  "testOrderId",
  "testRequestId",
  "createdAt",
  "testMode",
  "lineDisplayName",
  "customerName",
  "phone",
  "note",
  "itemsJson",
  "itemsSummary",
  "totalQty",
  "estimatedTotal",
  "depositTotal",
  "estimatedBalance",
  "payloadJson",
  "notificationsSent",
  "inventoryMutated",
  "formalOrderCreated",
];
var FORMAL_SIMULATION_SHEET_NAME_ = "正式流程模擬訂單";
var FORMAL_SIMULATION_HEADERS_ = [
  "simulationOrderId",
  "formalOrderNoCandidate",
  "testRequestId",
  "simulationRunId",
  "createdAt",
  "testMode",
  "lineDisplayName",
  "customerName",
  "phone",
  "productId",
  "itemsJson",
  "itemsSummary",
  "totalQty",
  "estimatedTotal",
  "depositTotal",
  "estimatedBalance",
  "depositPercent",
  "productStockSnapshot",
  "simulatedStockLimit",
  "cumulativeRequestedQty",
  "oversellRisk",
  "notificationSent",
  "inventoryMutated",
  "formalOrderCreated",
  "formalIdempotencyImplemented",
  "payloadJson",
];

var ORDER_STATUS_PENDING_ = "待收訂金";
var ORDER_STATUS_PAYMENT_REPORTED_ = "待確認訂金";
var ORDER_STATUS_DEPOSIT_RECEIVED_ = "已收到訂金";
var ORDER_STATUS_SHIPPED_ = "已開設 iOPEN Mall 賣場";
var ORDER_STATUS_SHIPPED_LEGACY_ = "已出貨";
var ORDER_STATUS_COMPLETED_ = "訂單已完成";
var ORDER_STATUS_CANCELLED_ = "已取消";
var ORDER_REMINDER_HOURS_ = 12;
var ORDER_EXPIRES_DISPLAY_HOURS_ = 24;
var ORDER_AUTO_CANCEL_HOURS_ = 25;
var ORDER_PAYMENT_DEADLINE_HOURS_ = 24;

var LINE_EVENT_HEADERS_ = [
  "webhookEventId",
  "lineUserId",
  "receivedAt",
  "messageType",
  "messageId",
  "textPreview",
  "matchedOrderNo",
  "reviewStatus",
  "reviewedAt",
];

var SETTING_HEADERS_ = ["key", "value", "label"];
var PUBLIC_CATALOG_CACHE_KEY_ = "public-catalog-v2";
var PUBLIC_CATALOG_CACHE_SECONDS_ = 300;
var DEFAULT_SETTINGS_ = {
  exchangeRate: 0.022,
  fixedMarkupTwd: 0,
  depositPercent: 50,
  paymentReminderHours: 12,
  paymentDeadlineHours: 24,
  paymentGraceHours: 1,
  iopenMallPaymentDays: 8,
  preorderNotice:
    "商品下訂後才會採購。下單先付商品總額的 50% 訂金，回國後再支付剩餘商品款。",
  saleClosed: false,
  saleClosedNotice: "本次連線已結束，謝謝大家的支持！",
  bankTransferInfo: "",
  bankName: "",
  bankCode: "",
  bankAccount: "",
  bankAccountName: "",
  bankQrUrl: "",
  iopenMallUrl: "https://mall.iopenmall.tw/112415/",
};
var PRODUCT_IMAGE_FOLDER_ = "quokka-preorder-product-images";

function doGet(e) {
  var action = String((e && e.parameter && e.parameter.action) || "").trim();
  if (action === "readPublicCatalog") return handleReadPublicCatalog_();
  return json_({ ok: false, error: "UNSUPPORTED_ACTION" });
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e && e.postData ? e.postData.contents : "{}");
    var action = String(data.action || "").trim();

    if (action === "stressTestHandshake")
      return handleStressTestHandshake_(data);
    if (action === "verifyStressTestResults")
      return handleVerifyStressTestResults_(data);
    if (action === "formalSimulationHandshake")
      return handleFormalSimulationHandshake_(data);
    if (action === "verifyFormalSimulationResults")
      return handleVerifyFormalSimulationResults_(data);
    if (
      action === "createPreorder" &&
      data.testMode === true &&
      data.formalSimulationMode === true
    )
      return handleCreateFormalSimulationPreorder_(data);
    if (action === "createPreorder" && data.testMode === true)
      return handleCreateStressTestPreorder_(data);
    if (action === "createPreorder") return handleCreatePreorder_(data);
    if (action === "recordLineWebhookSignals")
      return handleRecordLineWebhookSignals_(data);
    if (action === "readMyPreorders") return handleReadMyPreorders_(data);
    if (action === "adminLogin") return handleAdminLogin_(data);
    if (action === "adminReadProducts") return handleAdminReadProducts_(data);
    if (action === "adminExportData") return handleAdminExportData_(data);
    if (action === "adminUpdateOrderStatus")
      return handleAdminUpdateOrderStatus_(data);
    if (action === "adminCancelOrder") return handleAdminCancelOrder_(data);
    if (action === "adminAdjustOrderShortage")
      return handleAdminAdjustOrderShortage_(data);
    if (action === "adminAdjustOrder") return handleAdminAdjustOrder_(data);
    if (action === "adminConfirmCashRefund")
      return handleAdminConfirmCashRefund_(data);
    if (action === "adminResolveLineAlert")
      return handleAdminResolveLineAlert_(data);
    if (action === "adminSendOrderReminder")
      return handleAdminSendOrderReminder_(data);
    if (action === "adminSendMallExpiryReminder")
      return handleAdminSendMallExpiryReminder_(data);
    if (action === "adminSaveProduct") return handleAdminSaveProduct_(data);
    if (action === "adminToggleProduct") return handleAdminToggleProduct_(data);
    if (action === "adminUpdateProductStock")
      return handleAdminUpdateProductStock_(data);
    if (action === "adminUploadProductImage")
      return handleAdminUploadProductImage_(data);
    if (action === "adminSaveSettings") return handleAdminSaveSettings_(data);
    if (action === "adminChangeAccessCode")
      return handleAdminChangeAccessCode_(data);

    return json_({ ok: false, error: "UNSUPPORTED_ACTION" });
  } catch (error) {
    console.error(error);
    if (data && data.testMode === true) {
      return json_({
        ok: false,
        success: false,
        testMode: true,
        testRequestId: cleanText_(data.testRequestId, 80),
        error: safeError_(error),
      });
    }
    return json_({ ok: false, error: safeError_(error) });
  }
}

function handleAdminLogin_(data) {
  var expectedCode =
    PropertiesService.getScriptProperties().getProperty("ADMIN_ACCESS_CODE") ||
    "";
  var expectedHash =
    PropertiesService.getScriptProperties().getProperty(
      "ADMIN_ACCESS_CODE_HASH",
    ) || "";
  var accessCodeSalt =
    PropertiesService.getScriptProperties().getProperty(
      "ADMIN_ACCESS_CODE_SALT",
    ) || "";
  var providedCode = String((data && data.accessCode) || "").trim();
  if (!expectedCode && (!expectedHash || !accessCodeSalt))
    throw new Error("ADMIN_ACCESS_CODE_MISSING");
  var loginMatches =
    providedCode &&
    ((expectedHash &&
      accessCodeSalt &&
      hashAccessCode_(providedCode, accessCodeSalt) === expectedHash) ||
      (expectedCode && providedCode === expectedCode));
  if (!loginMatches)
    throw new Error("ADMIN_LOGIN_FAILED");
  var token = Utilities.getUuid() + Utilities.getUuid();
  var sessionVersion =
    PropertiesService.getScriptProperties().getProperty(
      "ADMIN_SESSION_VERSION",
    ) || "1";
  CacheService.getScriptCache().put(
    "admin-session-" + token,
    sessionVersion,
    21600,
  );
  return json_({ ok: true, adminSessionToken: token, expiresIn: 21600 });
}

function setupQuokkaPreorder() {
  var ss = spreadsheet_();
  ensureSheet_(ss, "Products", PRODUCT_HEADERS_);
  ensureSheet_(ss, "Preorders", ORDER_HEADERS_);
  ensureSheet_(ss, ORDER_REQUEST_SHEET_NAME_, ORDER_REQUEST_HEADERS_);
  ensureSheet_(ss, "LineInboundEvents", LINE_EVENT_HEADERS_);
  ensureSettingsSheet_(ss);
  return "設定完成";
}

function handleReadPublicCatalog_() {
  var cached = readPublicCatalogCache_();
  if (cached) return json_(cached);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    cached = readPublicCatalogCache_();
    if (cached) return json_(cached);

    var settings = readSettings_();
    var products = readProducts_(settings).filter(function (product) {
      return product.active === true;
    });
    var payload = {
      ok: true,
      products: products,
      settings: {
        preorderNotice: settings.preorderNotice,
        saleClosed: settings.saleClosed,
        saleClosedNotice: settings.saleClosedNotice,
        depositPercent: settings.depositPercent,
      },
    };
    writePublicCatalogCache_(payload);
    return json_(payload);
  } catch (error) {
    console.error(error);
    return json_({ ok: false, error: "CATALOG_UNAVAILABLE" });
  } finally {
    try {
      lock.releaseLock();
    } catch (error) {
      // waitLock 失敗時沒有鎖可釋放。
    }
  }
}

function readPublicCatalogCache_() {
  try {
    var cached = CacheService.getScriptCache().get(
      PUBLIC_CATALOG_CACHE_KEY_,
    );
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.warn("Public catalog cache read failed", error);
    return null;
  }
}

function writePublicCatalogCache_(payload) {
  try {
    CacheService.getScriptCache().put(
      PUBLIC_CATALOG_CACHE_KEY_,
      JSON.stringify(payload),
      PUBLIC_CATALOG_CACHE_SECONDS_,
    );
  } catch (error) {
    console.warn("Public catalog cache write failed", error);
  }
}

function invalidatePublicCatalogCache_() {
  try {
    CacheService.getScriptCache().remove(PUBLIC_CATALOG_CACHE_KEY_);
  } catch (error) {
    console.warn("Public catalog cache invalidation failed", error);
  }
}

function handleStressTestHandshake_(data) {
  requireStressTestEnabled_(data);
  return json_({
    ok: true,
    success: true,
    testMode: true,
    stressTestSupported: true,
    maxRequests: STRESS_TEST_MAX_REQUESTS_,
    isolatedSheet: STRESS_TEST_SHEET_NAME_,
    safeguards: {
      customerLineNotifications: false,
      adminLineNotifications: false,
      inventoryMutation: false,
      formalOrderCreation: false,
      formalOrderNumberCreation: false,
      scheduledWorkflowEnrollment: false,
    },
    safetySnapshot: createStressSafetySnapshot_(),
    message: "壓力測試模式已啟用，正式訂單、通知與庫存皆已隔離",
  });
}

function handleFormalSimulationHandshake_(data) {
  requireStressTestEnabled_(data);
  return json_({
    ok: true,
    success: true,
    testMode: true,
    formalSimulationMode: true,
    formalSimulationSupported: true,
    maxRequests: STRESS_TEST_MAX_REQUESTS_,
    isolatedSheet: FORMAL_SIMULATION_SHEET_NAME_,
    safeguards: {
      customerLineNotifications: false,
      adminLineNotifications: false,
      inventoryMutation: false,
      formalOrderCreation: false,
      scheduledWorkflowEnrollment: false,
    },
    formalFlowCoverage: {
      scriptLockWaitMs: 30000,
      setup: true,
      settingsAndSaleState: true,
      serverProductAndPriceValidation: true,
      depositCalculation: true,
      formalOrderNumberGenerator: "createOrderNo_",
      lineTokenVerification: false,
      linePush: false,
      formalPreordersWrite: false,
    },
    observedFormalRisks: {
      inventoryDeductionImplemented: true,
      requestIdempotencyImplemented: true,
    },
    safetySnapshot: createStressSafetySnapshot_(),
    message: "正式流程模擬已啟用；只寫入隔離模擬表，不通知、不改庫存、不建正式訂單",
  });
}

function handleCreateFormalSimulationPreorder_(data) {
  requireStressTestEnabled_(data);
  validateStressTestFields_(data);
  validateFormalSimulationFields_(data);
  setupQuokkaPreorder();
  var settings = readSettings_();
  if (settings.saleClosed) throw new Error("SALE_CLOSED");
  validatePreorderFields_(data);
  var prepared = prepareOrderItems_(data.items, readProducts_(settings));
  var cleanItems = prepared.cleanItems;
  var totalQty = prepared.totalQty;
  var estimatedTotal = prepared.estimatedTotal;
  var depositTotal = Math.ceil(
    estimatedTotal * (settings.depositPercent / 100),
  );
  var estimatedBalance = estimatedTotal - depositTotal;
  var itemsSummary = summarizeOrderItems_(cleanItems);
  var product = cleanItems[0];
  var lock = LockService.getScriptLock();
  var lockAcquired = false;
  try {
    lock.waitLock(30000);
    lockAcquired = true;
  } catch (error) {
    throw new Error("LOCK_TIMEOUT");
  }
  try {
    var ss = spreadsheet_();
    var sheet = ensureSheet_(
      ss,
      FORMAL_SIMULATION_SHEET_NAME_,
      FORMAL_SIMULATION_HEADERS_,
    );
    var existingRow = findFormalSimulationRequestRow_(
      sheet,
      data.testRequestId,
    );
    if (existingRow) {
      return json_({
        ok: true,
        success: true,
        duplicate: true,
        testMode: true,
        formalSimulationMode: true,
        testRequestId: data.testRequestId,
        simulationOrderId: sheet
          .getRange(existingRow, 1)
          .getDisplayValue(),
        formalOrderNoCandidate: sheet
          .getRange(existingRow, 2)
          .getDisplayValue(),
        message: "此模擬請求已處理，未重複建立模擬資料",
      });
    }

    var cumulativeRequestedQty =
      sumFormalSimulationRunQty_(
        sheet,
        data.simulationRunId,
        product.productId,
      ) + totalQty;
    var simulatedStockLimit = Number(data.simulatedStockLimit);
    if (cumulativeRequestedQty > simulatedStockLimit)
      return json_({
        ok: false,
        success: false,
        testMode: true,
        formalSimulationMode: true,
        testRequestId: data.testRequestId,
        error: "OUT_OF_STOCK",
        simulatedStockLimit: simulatedStockLimit,
        cumulativeRequestedQty: cumulativeRequestedQty,
        message: "模擬庫存不足，未建立模擬訂單",
      });
    var now = new Date();
    var formalOrderNoCandidate = createOrderNo_(now);
    var simulationOrderId = "SIM-" + formalOrderNoCandidate;
    var productStockSnapshot = simulatedStockLimit;
    var safePayload = {
      action: "createPreorder",
      idToken: "TEST_MODE_NO_LINE_TOKEN",
      lineDisplayName: cleanText_(data.lineDisplayName, 80),
      customerName: cleanText_(data.customerName, 30),
      phone: cleanText_(data.phone, 20),
      note: cleanText_(data.note, 300),
      items: data.items,
      testMode: true,
      formalSimulationMode: true,
      testRequestId: data.testRequestId,
      simulationRunId: data.simulationRunId,
      simulatedStockLimit: simulatedStockLimit,
    };

    sheet.appendRow([
      simulationOrderId,
      formalOrderNoCandidate,
      data.testRequestId,
      data.simulationRunId,
      formatDateTime_(now),
      true,
      safePayload.lineDisplayName,
      safePayload.customerName,
      safePayload.phone,
      product.productId,
      JSON.stringify(cleanItems),
      itemsSummary,
      totalQty,
      estimatedTotal,
      depositTotal,
      estimatedBalance,
      settings.depositPercent,
      productStockSnapshot,
      simulatedStockLimit,
      cumulativeRequestedQty,
      false,
      false,
      false,
      false,
      true,
      JSON.stringify(safePayload),
    ]);

    return json_({
      ok: true,
      success: true,
      duplicate: false,
      testMode: true,
      formalSimulationMode: true,
      testRequestId: data.testRequestId,
      simulationOrderId: simulationOrderId,
      formalOrderNoCandidate: formalOrderNoCandidate,
      estimatedTotal: estimatedTotal,
      depositTotal: depositTotal,
      estimatedBalance: estimatedBalance,
      simulatedStockLimit: simulatedStockLimit,
      cumulativeRequestedQty: cumulativeRequestedQty,
      simulatedStockRemaining: simulatedStockLimit - cumulativeRequestedQty,
      oversellRisk: false,
      notificationSuppressed: true,
      inventoryMutationSuppressed: true,
      formalOrderCreationSuppressed: true,
      message: "正式流程模擬資料寫入成功",
    });
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
}

function handleVerifyFormalSimulationResults_(data) {
  requireStressTestEnabled_(data);
  var requestIds = Array.isArray(data.testRequestIds)
    ? data.testRequestIds.map(function (value) {
        return String(value || "").trim();
      })
    : [];
  if (
    !requestIds.length ||
    requestIds.length > STRESS_TEST_MAX_REQUESTS_ ||
    requestIds.some(function (value) {
      return !isValidStressTestRequestId_(value);
    })
  )
    throw new Error("INVALID_TEST_REQUEST_ID");

  var requested = {};
  requestIds.forEach(function (value) {
    requested[value] = true;
  });
  var uniqueRequestIds = Object.keys(requested);
  var sheet = spreadsheet_().getSheetByName(FORMAL_SIMULATION_SHEET_NAME_);
  var rows =
    sheet && sheet.getLastRow() > 1
      ? sheet
          .getRange(
            2,
            1,
            sheet.getLastRow() - 1,
            FORMAL_SIMULATION_HEADERS_.length,
          )
          .getDisplayValues()
      : [];
  var matchedRows = rows.filter(function (row) {
    return requested[String(row[2] || "").trim()] === true;
  });
  var requestCounts = {};
  var orderCounts = {};
  matchedRows.forEach(function (row) {
    var requestId = String(row[2] || "").trim();
    var orderNo = String(row[1] || "").trim();
    requestCounts[requestId] = (requestCounts[requestId] || 0) + 1;
    orderCounts[orderNo] = (orderCounts[orderNo] || 0) + 1;
  });
  var missingRequestIds = uniqueRequestIds.filter(function (value) {
    return !requestCounts[value];
  });
  var duplicateRequestIds = Object.keys(requestCounts).filter(function (value) {
    return requestCounts[value] > 1;
  });
  var duplicateFormalOrderNoCandidates = Object.keys(orderCounts).filter(
    function (value) {
      return value && orderCounts[value] > 1;
    },
  );
  var incompleteRequestIds = matchedRows
    .filter(function (row) {
      return (
        String(row[0] || "").indexOf("SIM-QK") !== 0 ||
        String(row[1] || "").indexOf("QK") !== 0 ||
        String(row[5] || "").toUpperCase() !== "TRUE" ||
        row.slice(0, 21).some(function (value) {
          return String(
            value === undefined || value === null ? "" : value,
          ).trim() === "";
        })
      );
    })
    .map(function (row) {
      return String(row[2] || "").trim();
    });
  var oversellRiskCount = matchedRows.filter(function (row) {
    return String(row[20] || "").toUpperCase() === "TRUE";
  }).length;
  var notificationsSent = matchedRows.filter(function (row) {
    return String(row[21] || "").toUpperCase() === "TRUE";
  }).length;
  var inventoryMutations = matchedRows.filter(function (row) {
    return String(row[22] || "").toUpperCase() === "TRUE";
  }).length;
  var formalOrdersCreated = matchedRows.filter(function (row) {
    return String(row[23] || "").toUpperCase() === "TRUE";
  }).length;
  var currentSnapshot = createStressSafetySnapshot_();
  var baselineSnapshot = data.safetySnapshot || {};

  return json_({
    ok: true,
    success: true,
    testMode: true,
    formalSimulationMode: true,
    requestedUniqueCount: uniqueRequestIds.length,
    simulationSheetRowCount: matchedRows.length,
    missingRequestIds: missingRequestIds,
    duplicateRequestIds: duplicateRequestIds,
    duplicateFormalOrderNoCandidates: duplicateFormalOrderNoCandidates,
    incompleteRequestIds: incompleteRequestIds,
    fieldsComplete: incompleteRequestIds.length === 0,
    formalPreordersUnchanged: stressSnapshotsEqual_(
      baselineSnapshot.preorders,
      currentSnapshot.preorders,
    ),
    productsUnchanged: stressSnapshotsEqual_(
      baselineSnapshot.products,
      currentSnapshot.products,
    ),
    notificationsSent: notificationsSent,
    inventoryMutations: inventoryMutations,
    formalOrdersCreated: formalOrdersCreated,
    oversellRiskCount: oversellRiskCount,
    formalInventoryDeductionImplemented: true,
    formalRequestIdempotencyImplemented: true,
    concurrencyWritePassed:
      matchedRows.length === uniqueRequestIds.length &&
      missingRequestIds.length === 0 &&
      duplicateRequestIds.length === 0 &&
      duplicateFormalOrderNoCandidates.length === 0 &&
      incompleteRequestIds.length === 0,
    inventorySafetyPassed: oversellRiskCount === 0,
    currentSafetySnapshot: currentSnapshot,
    message: "正式流程模擬核對完成；吞吐量與庫存／冪等風險分開判定",
  });
}

function validateFormalSimulationFields_(data) {
  if (data.formalSimulationMode !== true)
    throw new Error("INVALID_FORMAL_SIMULATION");
  if (!/^SIMRUN-\d{8}-\d{6}-[A-Z0-9]{4}$/.test(data.simulationRunId))
    throw new Error("INVALID_FORMAL_SIMULATION");
  if (!Array.isArray(data.items) || data.items.length !== 1)
    throw new Error("INVALID_FORMAL_SIMULATION");
  var simulatedStockLimit = Number(data.simulatedStockLimit);
  if (
    !Number.isInteger(simulatedStockLimit) ||
    simulatedStockLimit < 1 ||
    simulatedStockLimit > STRESS_TEST_MAX_REQUESTS_
  )
    throw new Error("INVALID_FORMAL_SIMULATION");
}

function findFormalSimulationRequestRow_(sheet, testRequestId) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var values = sheet
    .getRange(2, 3, sheet.getLastRow() - 1, 1)
    .getDisplayValues();
  for (var index = 0; index < values.length; index++)
    if (String(values[index][0] || "").trim() === testRequestId)
      return index + 2;
  return 0;
}

function sumFormalSimulationRunQty_(sheet, simulationRunId, productId) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, FORMAL_SIMULATION_HEADERS_.length)
    .getDisplayValues();
  return rows.reduce(function (total, row) {
    if (
      String(row[3] || "").trim() !== simulationRunId ||
      String(row[9] || "").trim() !== productId
    )
      return total;
    return total + number_(row[12]);
  }, 0);
}

function handleCreateStressTestPreorder_(data) {
  requireStressTestEnabled_(data);
  validateStressTestFields_(data);

  var settings = readSettings_();
  var catalog = readProducts_(settings);
  var productMap = {};
  catalog.forEach(function (product) {
    productMap[product.id] = product;
  });

  var cleanItems = [];
  var totalQty = 0;
  var estimatedTotal = 0;
  data.items.forEach(function (sourceItem) {
    var productId = String((sourceItem && sourceItem.productId) || "").trim();
    var product = productMap[productId];
    var qty = Number(sourceItem && sourceItem.qty);
    if (
      !product ||
      !product.active ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      qty > 20
    ) {
      throw new Error("PRODUCT_CHANGED");
    }
    var variant = String(sourceItem.variant || "").trim();
    if (product.variants.length && product.variants.indexOf(variant) === -1)
      throw new Error("PRODUCT_CHANGED");
    if (!product.variants.length && variant)
      throw new Error("PRODUCT_CHANGED");

    var unitTwd = product.priceTwd;
    cleanItems.push({
      productId: product.id,
      name: product.name,
      variant: variant,
      qty: qty,
      unitPriceTwd: unitTwd,
      subtotalTwd: unitTwd * qty,
    });
    totalQty += qty;
    estimatedTotal += unitTwd * qty;
  });
  if (!cleanItems.length || totalQty > 100) throw new Error("INVALID_ITEMS");

  var depositTotal = Math.ceil(
    estimatedTotal * (settings.depositPercent / 100),
  );
  var estimatedBalance = estimatedTotal - depositTotal;
  var itemsSummary = cleanItems
    .map(function (item) {
      return (
        item.name +
        (item.variant ? "｜" + item.variant : "") +
        " × " +
        item.qty
      );
    })
    .join("\n");
  var safePayload = {
    action: "createPreorder",
    idToken: "TEST_MODE_NO_LINE_TOKEN",
    lineDisplayName: cleanText_(data.lineDisplayName, 80),
    customerName: cleanText_(data.customerName, 30),
    phone: cleanText_(data.phone, 20),
    note: cleanText_(data.note, 300),
    items: data.items,
    testMode: true,
    testRequestId: data.testRequestId,
  };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = spreadsheet_();
    var sheet = ensureSheet_(
      ss,
      STRESS_TEST_SHEET_NAME_,
      STRESS_TEST_HEADERS_,
    );
    var existingRow = findStressTestRequestRow_(sheet, data.testRequestId);
    if (existingRow) {
      return json_({
        ok: true,
        success: true,
        duplicate: true,
        testMode: true,
        testRequestId: data.testRequestId,
        testOrderId: sheet.getRange(existingRow, 1).getDisplayValue(),
        message: "此測試請求已處理，未重複建立",
      });
    }

    var now = new Date();
    var testOrderId = createUniqueStressTestOrderId_(sheet, now);

    sheet.appendRow([
      testOrderId,
      data.testRequestId,
      formatDateTime_(now),
      true,
      safePayload.lineDisplayName,
      safePayload.customerName,
      safePayload.phone,
      safePayload.note,
      JSON.stringify(cleanItems),
      itemsSummary,
      totalQty,
      estimatedTotal,
      depositTotal,
      estimatedBalance,
      JSON.stringify(safePayload),
      false,
      false,
      false,
    ]);

    return json_({
      ok: true,
      success: true,
      duplicate: false,
      testMode: true,
      testRequestId: data.testRequestId,
      testOrderId: testOrderId,
      message: "壓力測試訂單寫入成功",
    });
  } finally {
    lock.releaseLock();
  }
}

function handleVerifyStressTestResults_(data) {
  requireStressTestEnabled_(data);
  var requestIds = Array.isArray(data.testRequestIds)
    ? data.testRequestIds.map(function (value) {
        return String(value || "").trim();
      })
    : [];
  if (
    !requestIds.length ||
    requestIds.length > STRESS_TEST_MAX_REQUESTS_ ||
    requestIds.some(function (value) {
      return !isValidStressTestRequestId_(value);
    })
  )
    throw new Error("INVALID_TEST_REQUEST_ID");

  var requested = {};
  requestIds.forEach(function (value) {
    requested[value] = true;
  });
  var uniqueRequestIds = Object.keys(requested);
  var sheet = spreadsheet_().getSheetByName(STRESS_TEST_SHEET_NAME_);
  var rows =
    sheet && sheet.getLastRow() > 1
      ? sheet
          .getRange(
            2,
            1,
            sheet.getLastRow() - 1,
            STRESS_TEST_HEADERS_.length,
          )
          .getDisplayValues()
      : [];
  var matchedRows = rows.filter(function (row) {
    return requested[String(row[1] || "").trim()] === true;
  });
  var requestCounts = {};
  var orderCounts = {};
  matchedRows.forEach(function (row) {
    var requestId = String(row[1] || "").trim();
    var orderId = String(row[0] || "").trim();
    requestCounts[requestId] = (requestCounts[requestId] || 0) + 1;
    orderCounts[orderId] = (orderCounts[orderId] || 0) + 1;
  });
  var missingRequestIds = uniqueRequestIds.filter(function (value) {
    return !requestCounts[value];
  });
  var duplicateRequestIds = Object.keys(requestCounts).filter(function (value) {
    return requestCounts[value] > 1;
  });
  var duplicateTestOrderIds = Object.keys(orderCounts).filter(function (value) {
    return value && orderCounts[value] > 1;
  });
  var incompleteRequestIds = matchedRows
    .filter(function (row) {
      return (
        String(row[0] || "").indexOf("TEST-") !== 0 ||
        String(row[3] || "").toUpperCase() !== "TRUE" ||
        row.slice(0, 15).some(function (value) {
          return String(
            value === undefined || value === null ? "" : value,
          ).trim() === "";
        })
      );
    })
    .map(function (row) {
      return String(row[1] || "").trim();
    });
  var currentSnapshot = createStressSafetySnapshot_();
  var baselineSnapshot = data.safetySnapshot || {};
  var notificationsSent = matchedRows.filter(function (row) {
    return String(row[15] || "").toUpperCase() === "TRUE";
  }).length;
  var inventoryMutations = matchedRows.filter(function (row) {
    return String(row[16] || "").toUpperCase() === "TRUE";
  }).length;
  var formalOrdersCreated = matchedRows.filter(function (row) {
    return String(row[17] || "").toUpperCase() === "TRUE";
  }).length;

  return json_({
    ok: true,
    success: true,
    testMode: true,
    requestedUniqueCount: uniqueRequestIds.length,
    testSheetRowCount: matchedRows.length,
    missingRequestIds: missingRequestIds,
    duplicateRequestIds: duplicateRequestIds,
    duplicateTestOrderIds: duplicateTestOrderIds,
    incompleteRequestIds: incompleteRequestIds,
    fieldsComplete: incompleteRequestIds.length === 0,
    formalPreordersUnchanged: stressSnapshotsEqual_(
      baselineSnapshot.preorders,
      currentSnapshot.preorders,
    ),
    productsUnchanged: stressSnapshotsEqual_(
      baselineSnapshot.products,
      currentSnapshot.products,
    ),
    notificationsSent: notificationsSent,
    inventoryMutations: inventoryMutations,
    formalOrdersCreated: formalOrdersCreated,
    currentSafetySnapshot: currentSnapshot,
    message: "壓力測試結果核對完成",
  });
}

function requireStressTestEnabled_(data) {
  if (!data || data.testMode !== true) throw new Error("INVALID_TEST_MODE");
  var enabled =
    String(
      PropertiesService.getScriptProperties().getProperty(
        "ENABLE_STRESS_TEST_MODE",
      ) || "",
    ).toLowerCase() === "true";
  if (!enabled) throw new Error("STRESS_TEST_DISABLED");
}

function validateStressTestFields_(data) {
  if (!isValidStressTestRequestId_(data.testRequestId))
    throw new Error("INVALID_TEST_REQUEST_ID");
  if (String(data.idToken || "") !== "TEST_MODE_NO_LINE_TOKEN")
    throw new Error("REAL_CUSTOMER_DATA_FORBIDDEN");
  if (!/^壓測測試\d{3}$/.test(String(data.customerName || "").trim()))
    throw new Error("REAL_CUSTOMER_DATA_FORBIDDEN");
  if (!/^壓測測試\d{3}$/.test(String(data.lineDisplayName || "").trim()))
    throw new Error("REAL_CUSTOMER_DATA_FORBIDDEN");
  if (!/^090000\d{4}$/.test(String(data.phone || "").trim()))
    throw new Error("REAL_CUSTOMER_DATA_FORBIDDEN");
  var note = String(data.note || "").trim();
  if (
    note.indexOf("TEST MODE") === -1 ||
    note.indexOf("不得通知") === -1 ||
    note.indexOf("不得出貨") === -1
  )
    throw new Error("REAL_CUSTOMER_DATA_FORBIDDEN");
  validatePreorderFields_(data);
}

function isValidStressTestRequestId_(value) {
  return /^LOAD-\d{8}-\d{6}-[A-Z0-9]{4}-\d{3}$/.test(
    String(value || "").trim(),
  );
}

function findStressTestRequestRow_(sheet, testRequestId) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var values = sheet
    .getRange(2, 2, sheet.getLastRow() - 1, 1)
    .getDisplayValues();
  for (var index = 0; index < values.length; index++)
    if (String(values[index][0] || "").trim() === testRequestId)
      return index + 2;
  return 0;
}

function createUniqueStressTestOrderId_(sheet, date) {
  var existing = {};
  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 1)
      .getDisplayValues()
      .forEach(function (row) {
        existing[String(row[0] || "").trim()] = true;
      });
  }
  for (var attempt = 0; attempt < 5; attempt++) {
    var value =
      "TEST-" +
      Utilities.formatDate(
        date,
        Session.getScriptTimeZone(),
        "yyyyMMdd-HHmmss",
      ) +
      "-" +
      Utilities.getUuid().replace(/-/g, "").slice(0, 6).toUpperCase();
    if (!existing[value]) return value;
  }
  throw new Error("TEST_ORDER_ID_COLLISION");
}

function createStressSafetySnapshot_() {
  var ss = spreadsheet_();
  return {
    preorders: createSheetSafetySignature_(
      ss.getSheetByName("Preorders"),
      ORDER_HEADERS_.length,
    ),
    products: createSheetSafetySignature_(
      ss.getSheetByName("Products"),
      PRODUCT_HEADERS_.length,
    ),
  };
}

function createSheetSafetySignature_(sheet, columnCount) {
  if (!sheet)
    return { exists: false, rowCount: 0, digest: sha256_("[]") };
  var rowCount = sheet.getLastRow();
  var values = rowCount
    ? sheet.getRange(1, 1, rowCount, columnCount).getDisplayValues()
    : [];
  return {
    exists: true,
    rowCount: rowCount,
    digest: sha256_(JSON.stringify(values)),
  };
}

function stressSnapshotsEqual_(before, after) {
  return (
    !!before &&
    !!after &&
    before.exists === after.exists &&
    Number(before.rowCount) === Number(after.rowCount) &&
    String(before.digest || "") === String(after.digest || "")
  );
}

function handleCreatePreorder_(data) {
  var profile = verifyLineIdToken_(data.idToken);
  validatePreorderFields_(data);
  validateOrderRequestId_(data.requestId);
  setupQuokkaPreorder();
  var settings = readSettings_();
  if (settings.saleClosed) throw new Error("SALE_CLOSED");

  // 一般商品與金額檢查先在鎖外完成；取得鎖後仍會重新讀取商品列與庫存。
  prepareOrderItems_(data.items, readProducts_(settings));

  var lock = LockService.getScriptLock();
  var orderResult;
  var lockAcquired = false;
  var inventoryChanged = false;
  try {
    lock.waitLock(30000);
    lockAcquired = true;
  } catch (error) {
    throw new Error("LOCK_TIMEOUT");
  }
  try {
    var ss = spreadsheet_();
    var sheet = ss.getSheetByName("Preorders");
    var requestSheet = ensureSheet_(
      ss,
      ORDER_REQUEST_SHEET_NAME_,
      ORDER_REQUEST_HEADERS_,
    );
    var existingRequestRow = findOrderRequestRow_(requestSheet, data.requestId);
    if (existingRequestRow) {
      var existingRequest = requestSheet
        .getRange(existingRequestRow, 1, 1, ORDER_REQUEST_HEADERS_.length)
        .getDisplayValues()[0];
      if (String(existingRequest[2] || "").trim() !== profile.sub)
        throw new Error("ORDER_REQUEST_CONFLICT");
      if (
        String(existingRequest[3] || "").trim() !==
        orderRequestPayloadDigest_(data)
      )
        throw new Error("ORDER_REQUEST_CONFLICT");
      var existingOrderRow = findOrderRow_(sheet, existingRequest[1]);
      if (!existingOrderRow) throw new Error("ORDER_REQUEST_CONFLICT");
      orderResult = orderResultFromRow_(
        sheet
          .getRange(existingOrderRow, 1, 1, ORDER_HEADERS_.length)
          .getDisplayValues()[0],
      );
      orderResult.duplicate = true;
    } else {
      if (readSaleClosedFlag_()) throw new Error("SALE_CLOSED");
      var reservation = prepareInventoryReservation_(data.items, settings);
      var cleanItems = reservation.cleanItems;
      var totalQty = reservation.totalQty;
      var estimatedTotal = reservation.estimatedTotal;
      var depositTotal = Math.ceil(
        estimatedTotal * (settings.depositPercent / 100),
      );
      var estimatedBalance = estimatedTotal - depositTotal;
      var now = new Date();
      var orderNo = createOrderNo_(now);
      var itemsSummary = summarizeOrderItems_(cleanItems);
      var orderRowValues = buildNewOrderRow_(
        data,
        profile,
        settings,
        now,
        orderNo,
        cleanItems,
        itemsSummary,
        totalQty,
        estimatedTotal,
        depositTotal,
        estimatedBalance,
      );
      var appliedUpdates = [];
      var appendedOrderRow = 0;
      try {
        reservation.updates.forEach(function (update) {
          appliedUpdates.push(update);
          reservation.productSheet
            .getRange(update.rowNumber, 8)
            .setValue(update.newStatus);
          reservation.productSheet
            .getRange(update.rowNumber, 13)
            .setValue(update.newStock);
        });
        inventoryChanged = appliedUpdates.length > 0;
        sheet.appendRow(orderRowValues);
        appendedOrderRow = sheet.getLastRow();
        requestSheet.appendRow([
          data.requestId,
          orderNo,
          profile.sub,
          orderRequestPayloadDigest_(data),
          formatDateTime_(now),
          "created",
        ]);
      } catch (error) {
        try {
          if (appendedOrderRow) sheet.deleteRow(appendedOrderRow);
          appliedUpdates.forEach(function (update) {
            reservation.productSheet
              .getRange(update.rowNumber, 8)
              .setValue(update.oldStatus);
            reservation.productSheet
              .getRange(update.rowNumber, 13)
              .setValue(update.oldStock);
          });
          inventoryChanged = false;
        } catch (rollbackError) {
          console.error("Order rollback failed: " + safeError_(rollbackError));
        }
        throw new Error("ORDER_WRITE_FAILED");
      }
      orderResult = {
        orderNo: orderNo,
        createdAt: formatDateTime_(now),
        customerName: cleanText_(data.customerName, 30),
        items: cleanItems,
        itemsSummary: itemsSummary,
        totalQty: totalQty,
        estimatedTotal: estimatedTotal,
        depositTotal: depositTotal,
        estimatedBalance: estimatedBalance,
        depositPercent: settings.depositPercent,
        paymentDeadlineAt: formatDateTime_(
          new Date(now.getTime() + settings.paymentDeadlineHours * 3600000),
        ),
        duplicate: false,
      };
    }
  } finally {
    if (lockAcquired) lock.releaseLock();
  }
  if (inventoryChanged) invalidatePublicCatalogCache_();
  if (orderResult.duplicate)
    return json_({
      ok: true,
      duplicate: true,
      orderNo: orderResult.orderNo,
      estimatedTotal: orderResult.estimatedTotal,
      depositTotal: orderResult.depositTotal,
      estimatedBalance: orderResult.estimatedBalance,
      botMessageSent: false,
    });
  var botMessageSent = pushOrderSuccessCard_(profile.sub, orderResult);
  return json_({
    ok: true,
    duplicate: false,
    orderNo: orderResult.orderNo,
    estimatedTotal: orderResult.estimatedTotal,
    depositTotal: orderResult.depositTotal,
    estimatedBalance: orderResult.estimatedBalance,
    botMessageSent: botMessageSent,
  });
}

function validateOrderRequestId_(requestId) {
  var value = String(requestId || "").trim();
  if (!/^ORDER-\d{8}-\d{6}-[A-Z0-9]{8,32}$/.test(value))
    throw new Error("INVALID_ORDER_REQUEST_ID");
}

function orderRequestPayloadDigest_(data) {
  var items = (data.items || []).map(function (item) {
    return {
      productId: String((item && item.productId) || "").trim(),
      variant: String((item && item.variant) || "").trim(),
      qty: Number(item && item.qty),
    };
  });
  return sha256_(
    JSON.stringify({
      customerName: cleanText_(data.customerName, 30),
      phone: cleanText_(data.phone, 20),
      note: cleanText_(data.note, 300),
      items: items,
    }),
  );
}

function findOrderRequestRow_(sheet, requestId) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var values = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getDisplayValues();
  for (var index = 0; index < values.length; index++)
    if (String(values[index][0] || "").trim() === requestId) return index + 2;
  return 0;
}

function prepareOrderItems_(sourceItems, catalog) {
  var productMap = {};
  (catalog || []).forEach(function (product) {
    productMap[product.id] = product;
  });
  var cleanItems = [];
  var totalQty = 0;
  var estimatedTotal = 0;
  (sourceItems || []).forEach(function (sourceItem) {
    var productId = String((sourceItem && sourceItem.productId) || "").trim();
    var product = productMap[productId];
    var qty = Number(sourceItem && sourceItem.qty);
    if (product && product.stockQuantity === 0)
      throw new Error("OUT_OF_STOCK");
    if (
      !product ||
      !product.active ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      qty > 20
    )
      throw new Error("PRODUCT_CHANGED");
    var variant = String(sourceItem.variant || "").trim();
    if (product.variants.length && product.variants.indexOf(variant) === -1)
      throw new Error("PRODUCT_CHANGED");
    if (!product.variants.length && variant)
      throw new Error("PRODUCT_CHANGED");
    cleanItems.push({
      productId: product.id,
      name: product.name,
      variant: variant,
      qty: qty,
      unitPriceTwd: product.priceTwd,
      subtotalTwd: product.priceTwd * qty,
    });
    totalQty += qty;
    estimatedTotal += product.priceTwd * qty;
  });
  if (!cleanItems.length || totalQty > 100) throw new Error("INVALID_ITEMS");
  return {
    cleanItems: cleanItems,
    totalQty: totalQty,
    estimatedTotal: estimatedTotal,
  };
}

function prepareInventoryReservation_(sourceItems, settings) {
  var productSheet = spreadsheet_().getSheetByName("Products");
  if (!productSheet || productSheet.getLastRow() < 2)
    throw new Error("PRODUCT_CHANGED");
  var rows = productSheet
    .getRange(2, 1, productSheet.getLastRow() - 1, PRODUCT_HEADERS_.length)
    .getValues();
  var catalog = [];
  var rowByProductId = {};
  rows.forEach(function (row, index) {
    var product = rowToProduct_(row, settings.exchangeRate);
    if (!product.id) return;
    catalog.push(product);
    rowByProductId[product.id] = {
      rowNumber: index + 2,
      row: row,
      product: product,
    };
  });
  var prepared = prepareOrderItems_(sourceItems, catalog);
  var requestedByProduct = {};
  prepared.cleanItems.forEach(function (item) {
    requestedByProduct[item.productId] =
      (requestedByProduct[item.productId] || 0) + item.qty;
  });
  var updates = [];
  Object.keys(requestedByProduct).forEach(function (productId) {
    var source = rowByProductId[productId];
    if (!source) throw new Error("PRODUCT_CHANGED");
    var product = source.product;
    if (product.stockQuantity === null) return;
    var requestedQty = requestedByProduct[productId];
    if (product.stockQuantity < requestedQty) throw new Error("OUT_OF_STOCK");
    var newStock = product.stockQuantity - requestedQty;
    updates.push({
      rowNumber: source.rowNumber,
      oldStatus: String(source.row[7] || ""),
      oldStock: source.row[12],
      newStatus: newStock === 0 ? "下架" : String(source.row[7] || "上架"),
      newStock: newStock,
    });
  });
  prepared.productSheet = productSheet;
  prepared.updates = updates;
  return prepared;
}

function readSaleClosedFlag_() {
  var sheet = spreadsheet_().getSheetByName("Settings");
  if (!sheet || sheet.getLastRow() < 2) return false;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var index = 0; index < rows.length; index++)
    if (String(rows[index][0] || "").trim() === "saleClosed")
      return String(rows[index][1] || "").toLowerCase() === "true";
  return false;
}

function buildNewOrderRow_(
  data,
  profile,
  settings,
  now,
  orderNo,
  cleanItems,
  itemsSummary,
  totalQty,
  estimatedTotal,
  depositTotal,
  estimatedBalance,
) {
  return [
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
    ORDER_STATUS_PENDING_,
    "",
    "未開設賣場",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    settings.depositPercent,
    formatDateTime_(
      new Date(now.getTime() + settings.paymentReminderHours * 3600000),
    ),
    formatDateTime_(
      new Date(now.getTime() + settings.paymentDeadlineHours * 3600000),
    ),
    formatDateTime_(
      new Date(
        now.getTime() +
          (settings.paymentDeadlineHours + settings.paymentGraceHours) *
            3600000,
      ),
    ),
    "",
    "",
  ];
}

function orderResultFromRow_(row) {
  return {
    orderNo: String(row[0] || "").trim(),
    createdAt: row[1],
    customerName: row[4],
    items: parseJsonArray_(row[6]),
    itemsSummary: row[7],
    totalQty: number_(row[8]),
    estimatedTotal: number_(row[9]),
    depositTotal: number_(row[10]),
    estimatedBalance: number_(row[11]),
    depositPercent: number_(row[34]),
    paymentDeadlineAt: row[36],
  };
}

function pushOrderSuccessCard_(lineUserId, order) {
  return pushLineMessage_(
    lineUserId,
    buildUnifiedOrderSuccessCard_(order),
    "order success " + order.orderNo,
  );
}

function pushLineMessage_(lineUserId, message, logLabel) {
  var accessToken =
    PropertiesService.getScriptProperties().getProperty(
      "LINE_MESSAGING_ACCESS_TOKEN",
    ) || "";
  if (!accessToken || !lineUserId) return false;
  var payload = { to: lineUserId, messages: [message] };
  try {
    var response = UrlFetchApp.fetch(
      "https://api.line.me/v2/bot/message/push",
      {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + accessToken },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      console.log("LINE push sent: " + String(logLabel || "message"));
      return true;
    }
    console.error(
      "LINE push failed: " + code + " " + response.getContentText(),
    );
  } catch (error) {
    console.error("LINE push failed: " + safeError_(error));
  }
  return false;
}

function handleRecordLineWebhookSignals_(data) {
  var expectedSecret =
    PropertiesService.getScriptProperties().getProperty(
      "WEBHOOK_FORWARDING_SECRET",
    ) || "";
  if (
    !expectedSecret ||
    String(data.forwardingSecret || "") !== expectedSecret
  )
    throw new Error("WEBHOOK_FORBIDDEN");
  var events = Array.isArray(data.events) ? data.events.slice(0, 20) : [];
  if (!events.length) return json_({ ok: true, recorded: 0 });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("LineInboundEvents");
    var existing = {};
    if (sheet.getLastRow() >= 2) {
      sheet
        .getRange(2, 1, sheet.getLastRow() - 1, 1)
        .getDisplayValues()
        .forEach(function (row) {
          if (row[0]) existing[row[0]] = true;
        });
    }
    var pendingOrdersByUser = readPendingOrderNosByUser_();
    var rows = [];
    events.forEach(function (event) {
      var eventId = cleanText_(event.webhookEventId, 100);
      var lineUserId = cleanText_(event.lineUserId, 100);
      if (!eventId || !lineUserId || existing[eventId]) return;
      existing[eventId] = true;
      var candidates = pendingOrdersByUser[lineUserId] || [];
      rows.push([
        eventId,
        lineUserId,
        formatDateTime_(new Date(Number(event.timestamp) || Date.now())),
        cleanText_(event.messageType, 30) || "unknown",
        cleanText_(event.messageId, 100),
        cleanText_(event.textPreview, 160),
        candidates.length === 1 ? candidates[0] : "",
        "待核對",
        "",
      ]);
    });
    if (rows.length)
      sheet
        .getRange(sheet.getLastRow() + 1, 1, rows.length, LINE_EVENT_HEADERS_.length)
        .setValues(rows);
    return json_({ ok: true, recorded: rows.length });
  } finally {
    lock.releaseLock();
  }
}

function readPendingOrderNosByUser_() {
  var sheet = spreadsheet_().getSheetByName("Preorders");
  var result = {};
  if (!sheet || sheet.getLastRow() < 2) return result;
  var rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, ORDER_HEADERS_.length)
    .getDisplayValues();
  rows.forEach(function (row) {
    var status = normalizeOrderStatus_(row[15], row[17]);
    if (status !== ORDER_STATUS_PENDING_) return;
    var userId = String(row[2] || "").trim();
    if (!userId) return;
    if (!result[userId]) result[userId] = [];
    result[userId].push(String(row[0] || "").trim());
  });
  return result;
}

function buildOrderSuccessMessage_(order) {
  var transferRequestText = "您好，我想索取匯款資訊";
  var bodyContents = [
    {
      type: "text",
      text: order.itemsSummary,
      wrap: true,
      size: "sm",
      color: "#304B59",
    },
    { type: "separator", margin: "lg", color: "#E6DED5" },
    moneyRow_("商品總件數", formatMoney_(order.totalQty) + " 件"),
    moneyRow_("商品總額", "NT$" + formatMoney_(order.estimatedTotal)),
    moneyRow_(
      "本次訂金（" +
        number_(order.depositPercent || DEFAULT_SETTINGS_.depositPercent) +
        "%）",
      "NT$" + formatMoney_(order.depositTotal),
      "#EF0025",
    ),
    moneyRow_("回國後剩餘商品款", "NT$" + formatMoney_(order.estimatedBalance)),
    { type: "separator", margin: "lg", color: "#E6DED5" },
    {
      type: "text",
      text: "請於 24 小時內完成訂金匯款，才算完成預訂。",
      wrap: true,
      weight: "bold",
      size: "sm",
      margin: "lg",
      color: "#EF0025",
    },
    {
      type: "text",
      text: "需要匯款嗎？",
      weight: "bold",
      size: "sm",
      margin: "lg",
      color: "#304B59",
    },
    {
      type: "text",
      text: "請按下方「匯款資訊」，系統會送出文字訊息，由管理方提供帳戶。",
      wrap: true,
      size: "xs",
      margin: "sm",
      color: "#75858D",
    },
  ];
  return {
    type: "flex",
    altText:
      "已收到預購訂單｜" +
      order.orderNo +
      "｜應付訂金 NT$" +
      formatMoney_(order.depositTotal),
    contents: {
      type: "bubble",
      styles: {
        header: { backgroundColor: "#47748E" },
        footer: { separator: true, separatorColor: "#E6DED5" },
      },
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        contents: [
          {
            type: "text",
            text: "已收到預購訂單",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
          },
          {
            type: "text",
            text: order.orderNo,
            color: "#DCECF3",
            size: "sm",
            margin: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        backgroundColor: "#FFFDF7",
        contents: bodyContents,
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "14px",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#47748E",
            height: "sm",
            action: {
              type: "message",
              label: "匯款資訊",
              text: transferRequestText,
            },
          },
        ],
      },
    },
  };
}

function moneyRow_(label, value, valueColor, labelColor) {
  return {
    type: "box",
    layout: "horizontal",
    margin: "md",
    contents: [
      {
        type: "text",
        text: label,
        size: "sm",
        color: labelColor || "#75858D",
        flex: 3,
      },
      {
        type: "text",
        text: value,
        size: "sm",
        color: valueColor || "#304B59",
        weight: "bold",
        align: "end",
        flex: 2,
      },
    ],
  };
}

function buildUnifiedOrderCard_(order, title, message, options) {
  options = options || {};
  function themedMoneyRow_(label, value, valueColor) {
    return moneyRow_(
      label,
      value,
      valueColor || options.valueColor,
      options.labelColor,
    );
  }
  var messageContent = {
    type: "text",
    text: String(message || ""),
    wrap: true,
    weight: "bold",
    size: "sm",
    color:
      options.messageColor || (options.warning ? "#EF0025" : "#25343B"),
  };
  if (options.messageBackgroundColor) {
    messageContent = {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      cornerRadius: "10px",
      backgroundColor: options.messageBackgroundColor,
      contents: [messageContent],
    };
  }
  var body = [
    messageContent,
    {
      type: "separator",
      margin: "lg",
      color: options.separatorColor || "#C8D8DF",
    },
    themedMoneyRow_("訂購人", order.customerName || "—"),
    themedMoneyRow_("訂單時間", order.createdAt || "—"),
    {
      type: "text",
      text: String(order.itemsSummary || "目前沒有商品明細").slice(0, 1800),
      wrap: true,
      size: "sm",
      margin: "lg",
      color: options.itemTextColor || "#25343B",
    },
    {
      type: "separator",
      margin: "lg",
      color: options.separatorColor || "#C8D8DF",
    },
  ];
  if (Array.isArray(options.moneyRows)) {
    options.moneyRows.forEach(function (row) {
      body.push(themedMoneyRow_(row.label, row.value, row.color));
    });
  } else {
    if (order.totalQty !== undefined)
      body.push(
        themedMoneyRow_("商品總件數", formatMoney_(order.totalQty) + " 件"),
      );
    if (order.estimatedTotal !== undefined)
      body.push(
        themedMoneyRow_("商品總額", "NT$" + formatMoney_(order.estimatedTotal)),
      );
    if (order.depositTotal !== undefined)
      body.push(
        themedMoneyRow_(
          options.depositLabel || "訂金",
          "NT$" + formatMoney_(order.depositTotal),
          options.depositValueColor || "#EF0025",
        ),
      );
    if (order.estimatedBalance !== undefined)
      body.push(
        themedMoneyRow_(
          options.balanceLabel || "後續應付",
          "NT$" + formatMoney_(order.estimatedBalance),
        ),
      );
    (options.extraRows || []).forEach(function (row) {
      body.push(themedMoneyRow_(row.label, row.value, row.color));
    });
  }

  var card = {
    type: "flex",
    altText: title + "｜" + order.orderNo,
    contents: {
      type: "bubble",
      styles: {
        header: {
          backgroundColor: options.headerBackgroundColor || "#47748E",
        },
        footer: {
          separator: true,
          separatorColor: options.separatorColor || "#C8D8DF",
        },
      },
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        contents: [
          {
            type: "text",
            text: title,
            color: "#FFFFFF",
            weight: "bold",
            size: "lg",
            wrap: true,
          },
          {
            type: "text",
            text: order.orderNo,
            color: options.orderNoColor || "#F1C84B",
            weight: "bold",
            size: "sm",
            margin: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        backgroundColor: options.bodyBackgroundColor || "#FFFDF7",
        contents: body,
      },
    },
  };
  if (options.buttons && options.buttons.length) {
    card.contents.footer = {
      type: "box",
      layout: "vertical",
      paddingAll: "14px",
      spacing: "sm",
      contents: options.buttons.map(function (button, index) {
        return {
          type: "button",
          style: index === 0 ? "primary" : "secondary",
          color:
            index === 0
              ? options.primaryButtonColor || "#47748E"
              : undefined,
          height: "sm",
          action: button,
        };
      }),
    };
  }
  return card;
}

function buildUnifiedOrderSuccessCard_(order) {
  var paymentDue = parseOrderDate_(order.paymentDeadlineAt);
  if (!paymentDue) paymentDue = parseOrderDate_(order.createdAt);
  if (paymentDue && !order.paymentDeadlineAt)
    paymentDue = new Date(
      paymentDue.getTime() + ORDER_PAYMENT_DEADLINE_HOURS_ * 3600000,
    );
  var transferRequestText = "您好，我想索取匯款資訊";
  return buildUnifiedOrderCard_(
    order,
    "已收到預購訂單",
    "請於 " +
      (paymentDue ? formatDateTime_(paymentDue) : "正式付款期限") +
      " 前完成匯款並回傳帳號後五碼。",
    {
      depositLabel:
        "本次訂金（" +
        number_(order.depositPercent || DEFAULT_SETTINGS_.depositPercent) +
        "%）",
      balanceLabel: "回國後剩餘商品款",
      buttons: [
        {
          type: "message",
          label: "匯款資訊",
          text: transferRequestText,
        },
      ],
    },
  );
}

function buildUnifiedPendingCard_(order) {
  var dueAt = parseOrderDate_(order.paymentDeadlineAt);
  var createdAt = parseOrderDate_(order.createdAt);
  if (!dueAt)
    dueAt = createdAt
    ? new Date(
        createdAt.getTime() + ORDER_PAYMENT_DEADLINE_HOURS_ * 3600000,
      )
    : null;
  return buildUnifiedOrderCard_(
    order,
    "待收訂金",
    "請於 " +
      (dueAt ? formatDateTime_(dueAt) : "正式付款期限") +
      " 前完成匯款並回傳帳號後五碼。",
    { depositLabel: "應付訂金", balanceLabel: "回國後剩餘商品款" },
  );
}

function buildUnifiedDepositReceivedCard_(order) {
  return buildUnifiedOrderCard_(
    order,
    "已收到訂金",
    "訂金已確認入帳，您的預訂已完成。",
    {
      depositLabel: "已收訂金",
      balanceLabel: "回國後剩餘商品款",
      messageBackgroundColor: "#FFF0B8",
      messageColor: "#805B00",
    },
  );
}

function buildUnifiedMallReadyCard_(order, iopenMallUrl) {
  var mallDeadline = buildMallPaymentDeadline_(
    order.shippedAt,
    order.iopenMallPaymentDeadlineAt,
    order.iopenMallPaymentDays,
  );
  return buildUnifiedOrderCard_(
    order,
    "已開設 iOPEN Mall 賣場",
    "請於 " +
      (mallDeadline ? mallDeadline.display : "賣場開設後第七日 24:00") +
      " 前完成下標及付款。",
    {
      balanceLabel: "賣場應付金額",
      primaryButtonColor: "#E45F47",
      buttons: iopenMallUrl
        ? [
            {
              type: "uri",
              label: "前往 iOPEN Mall 賣場",
              uri: iopenMallUrl,
            },
          ]
        : [],
    },
  );
}

function buildUnifiedReminderCard_(order, message, title, iopenMallUrl) {
  return buildUnifiedOrderCard_(order, title, message, {
    warning: true,
    messageBackgroundColor: "#FBE6EA",
    messageColor: "#C13E4D",
    depositLabel: "應付訂金",
    balanceLabel:
      title === "iOPEN Mall 付款提醒" ? "賣場應付金額" : "後續應付",
    primaryButtonColor:
      title === "iOPEN Mall 付款提醒" ? "#E45F47" : undefined,
    buttons:
      title === "iOPEN Mall 付款提醒" && iopenMallUrl
        ? [
            {
              type: "uri",
              label: "前往 iOPEN Mall 賣場",
              uri: iopenMallUrl,
            },
          ]
        : [],
  });
}

function buildUnifiedCancellationCard_(order) {
  return buildUnifiedOrderCard_(
    order,
    "預購訂單已取消",
    String(order.reason || "訂單已由管理員取消。"),
    {
      warning: true,
      depositLabel: "原訂金",
      balanceLabel: "原後續應付",
      headerBackgroundColor: "#7C858A",
      bodyBackgroundColor: "#F5F6F6",
      orderNoColor: "#EEF0F1",
      separatorColor: "#D7DCDE",
      messageBackgroundColor: "#E4E6E7",
      messageColor: "#A33F49",
      labelColor: "#7B8388",
      valueColor: "#596268",
      depositValueColor: "#667178",
      itemTextColor: "#596268",
    },
  );
}

function buildAdjustmentMoneyRows_(order) {
  var receivedDeposit = number_(order.receivedDeposit);
  var adjustedTotal = number_(order.adjustedTotal);
  var adjustedOrderDeposit = Math.ceil(
    adjustedTotal *
      (number_(order.depositPercent || DEFAULT_SETTINGS_.depositPercent) /
        100),
  );
  var originalOrderTotal =
    order.originalOrderTotal !== undefined
      ? number_(order.originalOrderTotal)
      : number_(order.previousTotal);
  var changedAmount =
    order.changeAmount !== undefined
      ? number_(order.changeAmount)
      : Math.abs(adjustedTotal - number_(order.previousTotal));
  var changeLabel =
    order.changeType === "increase" ||
    (order.changeType === undefined &&
      adjustedTotal > number_(order.previousTotal))
      ? "這次增加金額"
      : order.changeType === "decrease" ||
          (order.changeType === undefined &&
            adjustedTotal < number_(order.previousTotal))
        ? "這次扣除金額"
        : "這次金額變動";
  var receivedLabel =
    order.status === ORDER_STATUS_PAYMENT_REPORTED_
      ? "已回報訂金"
      : "已收訂金";
  var rows = [
    {
      label: "原訂單金額",
      value: "NT$" + formatMoney_(originalOrderTotal),
    },
    {
      label: receivedLabel,
      value: "NT$" + formatMoney_(receivedDeposit),
      color: "#EF0025",
    },
    {
      label: "商品件數",
      value: formatMoney_(order.totalQty) + " 件",
    },
    {
      label: "調整後訂單總額",
      value: "NT$" + formatMoney_(adjustedTotal),
    },
    {
      label: "調整後訂單訂金",
      value: "NT$" + formatMoney_(adjustedOrderDeposit),
    },
    {
      label: changeLabel,
      value: "NT$" + formatMoney_(changedAmount),
    },
    {
      label: "調整後應付尾款",
      value: "NT$" + formatMoney_(order.adjustedBalance),
      color: "#EF0025",
    },
  ];
  if (number_(order.cashRefundDue) > 0)
    rows.push({
      label: "待退款",
      value: "NT$" + formatMoney_(order.cashRefundDue),
      color: "#EF0025",
    });
  return rows;
}

function buildUnifiedShortageCard_(order) {
  var cancelledText = order.cancelledItems
    .map(function (item) {
      return (
        "・" +
        item.name +
        (item.variant ? "｜" + item.variant : "") +
        " × " +
        item.qty +
        "（扣除 NT$" +
        formatMoney_(item.subtotalTwd) +
        "）"
      );
    })
    .join("\n");
  var settlement = order.allItemsCancelled
    ? "全品項缺貨，訂單已取消並列為待退款。"
    : order.cashRefundDue > 0
      ? "出貨時將退還現金 NT$" + formatMoney_(order.cashRefundDue) + "。"
      : "後續應付 NT$" + formatMoney_(order.adjustedBalance) + "。";
  return buildUnifiedOrderCard_(
    order,
    "訂單缺貨調整",
    "以下缺貨品項已取消：\n" + cancelledText + "\n\n" + settlement,
    {
      moneyRows: buildAdjustmentMoneyRows_(order),
    },
  );
}

function buildUnifiedOrderAdjustmentCard_(order) {
  var status = normalizeOrderStatus_(order.status, "");
  var changeText = (order.changes || [])
    .map(function (change) {
      var item = change.after || change.before || {};
      var label =
        item.name + (item.variant ? "｜" + item.variant : "");
      if (change.type === "added")
        return "・新增 " + label + " × " + change.after.qty;
      if (change.type === "removed")
        return "・取消 " + label + " × " + change.before.qty;
      return (
        "・調整 " +
        label +
        "：" +
        change.before.qty +
        " → " +
        change.after.qty
      );
    })
    .join("\n");
  var message =
    "訂單內容已由管理員更新（" +
    String(order.reasonLabel || "管理修正") +
    "）：\n" +
    changeText +
    "\n\n訂單狀態維持「" +
    status +
    "」。";
  if (status === ORDER_STATUS_PENDING_) {
    var dueAt = parseOrderDate_(order.paymentDeadlineAt);
    if (!dueAt) dueAt = parseOrderDate_(order.createdAt);
    if (dueAt && !order.paymentDeadlineAt)
      dueAt = new Date(
        dueAt.getTime() + ORDER_PAYMENT_DEADLINE_HOURS_ * 3600000,
      );
    message +=
      "\n付款期限仍為 " +
      (dueAt ? formatDateTime_(dueAt) : "原訂單正式付款期限") +
      "，不會因本次修改延長。";
  } else if (status === ORDER_STATUS_PAYMENT_REPORTED_) {
    message += "\n您回報的匯款資料仍保留，將由管理員核帳確認。";
  } else if (order.adjustmentDue > 0) {
    message +=
      "\n調整後產生溢付 NT$" +
      formatMoney_(order.adjustmentDue) +
      "，將由管理員後續處理。";
  }
  return buildUnifiedOrderCard_(
    order,
    "訂單內容已更新",
    message,
    {
      moneyRows: buildAdjustmentMoneyRows_(order),
    },
  );
}

function formatMoney_(value) {
  return Math.round(number_(value))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
    var values = sheet
      .getRange(2, 1, lastRow - 1, ORDER_HEADERS_.length)
      .getDisplayValues();
    for (var index = values.length - 1; index >= 0; index--) {
      var row = values[index];
      if (String(row[0]).trim() !== orderNo) continue;
      if (String(row[2]).trim() !== profile.sub)
        throw new Error("ORDER_FORBIDDEN");
      var currentStatus = normalizeOrderStatus_(row[15], row[17]);
      if (currentStatus === ORDER_STATUS_PAYMENT_REPORTED_) {
        if (String(row[13] || "").trim() !== transferLast5)
          throw new Error("INVALID_ORDER_STATUS");
        return json_({
          ok: true,
          duplicate: true,
          orderNo: orderNo,
          status: ORDER_STATUS_PAYMENT_REPORTED_,
          transferLast5: transferLast5,
          paymentReportedAt: row[29],
        });
      }
      if (
        [ORDER_STATUS_PENDING_].indexOf(currentStatus) < 0
      )
        throw new Error("INVALID_ORDER_STATUS");
      sheet.getRange(index + 2, 13).setValue("銀行轉帳");
      sheet.getRange(index + 2, 14).setValue(transferLast5);
      sheet
        .getRange(index + 2, 16)
        .setValue(ORDER_STATUS_PAYMENT_REPORTED_);
      var paymentReportedAt = formatDateTime_(new Date());
      sheet.getRange(index + 2, 30).setValue(paymentReportedAt);
      return json_({
        ok: true,
        orderNo: orderNo,
        status: ORDER_STATUS_PAYMENT_REPORTED_,
        transferLast5: transferLast5,
        paymentReportedAt: paymentReportedAt,
      });
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
  var rows = sheet
    .getRange(2, 1, lastRow - 1, ORDER_HEADERS_.length)
    .getDisplayValues();
  var orders = [];
  var settings = readSettings_();
  for (var index = rows.length - 1; index >= 0; index--) {
    var row = rows[index];
    if (String(row[2]).trim() !== profile.sub) continue;
    var status = normalizeOrderStatus_(row[15], row[17]);
    var mallDeadline =
      status === ORDER_STATUS_SHIPPED_
        ? buildMallPaymentDeadline_(row[18], row[39], number_(row[38]))
        : null;
    orders.push({
      orderNo: row[0],
      createdAt: row[1],
      itemsSummary: row[7],
      estimatedTotal: number_(row[9]),
      depositTotal: number_(row[10]),
      depositPercent: number_(row[34]) || DEFAULT_SETTINGS_.depositPercent,
      estimatedBalance: number_(row[11]),
      originalEstimatedTotal: number_(row[23]) || number_(row[9]),
      shortageAdjustedAt: row[25],
      cashRefundDue: number_(row[26]),
      cashRefundedAt: row[27],
      status: status,
      transferLast5:
        status === ORDER_STATUS_PAYMENT_REPORTED_ ? row[13] : "",
      paymentReportedAt:
        status === ORDER_STATUS_PAYMENT_REPORTED_ ? row[29] : "",
      shippedAt: row[18],
      iopenMallUrl:
        mallDeadline && !mallDeadline.expired ? settings.iopenMallUrl : "",
      mallPaymentDueText: mallDeadline ? mallDeadline.display : "",
      mallPaymentExpired: mallDeadline ? mallDeadline.expired : false,
      iopenMallPaymentDays:
        number_(row[38]) || DEFAULT_SETTINGS_.iopenMallPaymentDays,
      iopenMallPaymentDeadlineAt: row[39],
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
    purchaseSummary: readPurchaseSummary_(),
  });
}

function handleAdminExportData_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  setupQuokkaPreorder();
  var exportType = String(data.exportType || "").trim();
  var orderRows = readOrderExportRows_();
  var stamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss",
  );
  if (exportType === "orders") {
    return json_({
      ok: true,
      exportType: exportType,
      fileName: "orders-" + stamp + ".csv",
      rowCount: orderRows.length,
      csv: buildCsv_([ORDER_EXPORT_HEADERS_].concat(orderRows)),
    });
  }
  if (exportType === "customers") {
    var customerRows = buildCustomerExportRows_(orderRows);
    return json_({
      ok: true,
      exportType: exportType,
      fileName: "customers-" + stamp + ".csv",
      rowCount: customerRows.length,
      csv: buildCsv_([CUSTOMER_EXPORT_HEADERS_].concat(customerRows)),
    });
  }
  throw new Error("INVALID_EXPORT_TYPE");
}

function readOrderExportRows_() {
  var sheet = spreadsheet_().getSheetByName("Preorders");
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, ORDER_HEADERS_.length)
    .getDisplayValues()
    .filter(function (row) {
      return String(row[0] || "").trim();
    });
}

function buildCustomerExportRows_(orderRows) {
  var customers = {};
  (orderRows || []).forEach(function (row, rowIndex) {
    var lineUserId = String(row[2] || "").trim();
    var normalizedPhone = String(row[5] || "").replace(/\D/g, "");
    var fallbackIdentity =
      String(row[4] || "").trim() + "|" + String(row[3] || "").trim();
    var key = lineUserId
      ? "line:" + lineUserId
      : normalizedPhone
        ? "phone:" + normalizedPhone
        : "name:" + fallbackIdentity;
    var createdAtText = String(row[1] || "").trim();
    var createdAt = parseOrderDate_(createdAtText);
    var createdAtValue = createdAt ? createdAt.getTime() : rowIndex;
    var status = normalizeOrderStatus_(row[15], row[17]);
    var isCancelled = status === ORDER_STATUS_CANCELLED_;
    var customer = customers[key];
    if (!customer) {
      customer = customers[key] = {
        lineUserId: lineUserId,
        lineDisplayName: "",
        customerName: "",
        phone: "",
        firstOrderAt: createdAtText,
        firstOrderValue: createdAtValue,
        lastOrderAt: createdAtText,
        lastOrderValue: createdAtValue,
        orderCount: 0,
        activeOrderCount: 0,
        cancelledOrderCount: 0,
        completedOrderCount: 0,
        activeOrderTotal: 0,
        latestStatus: status,
      };
    }
    customer.orderCount += 1;
    if (isCancelled) customer.cancelledOrderCount += 1;
    else {
      customer.activeOrderCount += 1;
      customer.activeOrderTotal += number_(row[9]);
    }
    if (status === ORDER_STATUS_COMPLETED_) customer.completedOrderCount += 1;
    if (createdAtValue < customer.firstOrderValue) {
      customer.firstOrderAt = createdAtText;
      customer.firstOrderValue = createdAtValue;
    }
    if (createdAtValue >= customer.lastOrderValue) {
      customer.lastOrderAt = createdAtText;
      customer.lastOrderValue = createdAtValue;
      customer.latestStatus = status;
      customer.lineDisplayName =
        String(row[3] || "").trim() || customer.lineDisplayName;
      customer.customerName =
        String(row[4] || "").trim() || customer.customerName;
      customer.phone = String(row[5] || "").trim() || customer.phone;
      customer.lineUserId = lineUserId || customer.lineUserId;
    }
  });
  return Object.keys(customers)
    .map(function (key) {
      return customers[key];
    })
    .sort(function (a, b) {
      return b.lastOrderValue - a.lastOrderValue;
    })
    .map(function (customer) {
      return [
        customer.lineUserId,
        customer.lineDisplayName,
        customer.customerName,
        customer.phone,
        customer.firstOrderAt,
        customer.lastOrderAt,
        customer.orderCount,
        customer.activeOrderCount,
        customer.cancelledOrderCount,
        customer.completedOrderCount,
        customer.activeOrderTotal,
        customer.latestStatus,
      ];
    });
}

function buildCsv_(rows) {
  return (rows || [])
    .map(function (row) {
      return (row || []).map(csvCell_).join(",");
    })
    .join("\r\n");
}

function csvCell_(value) {
  var text = value == null ? "" : String(value);
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function readAdminOrders_() {
  var sheet = spreadsheet_().getSheetByName("Preorders");
  if (!sheet || sheet.getLastRow() < 2) return [];
  var rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, ORDER_HEADERS_.length)
    .getDisplayValues();
  var now = new Date();
  var lineAlertsByUser = readUnreviewedLineAlertsByUser_();
  return rows
    .filter(function (row) {
      return String(row[0] || "").trim();
    })
    .map(function (row) {
      var items = [];
      try {
        items = JSON.parse(row[6] || "[]");
      } catch (error) {
        items = [];
      }
      var createdAt = parseOrderDate_(row[1]);
      var status = normalizeOrderStatus_(row[15], row[17]);
      var paymentSchedule = getOrderPaymentSchedule_(row);
      var expiresAt = paymentSchedule ? paymentSchedule.dueAt : null;
      var mallDeadline =
        status === ORDER_STATUS_SHIPPED_
          ? buildMallPaymentDeadline_(row[18], row[39], number_(row[38]))
          : null;
      var lineAlerts =
        status === ORDER_STATUS_PENDING_
          ? (lineAlertsByUser[String(row[2] || "").trim()] || []).filter(
              function (alert) {
                return (
                  (!alert.matchedOrderNo || alert.matchedOrderNo === row[0]) &&
                  (!createdAt ||
                    !alert.receivedDate ||
                    alert.receivedDate >= createdAt)
                );
              },
            )
          : [];
      return {
        orderNo: row[0],
        createdAt: row[1],
        lineDisplayName: row[3],
        customerName: row[4],
        phone: row[5],
        items: Array.isArray(items) ? items : [],
        itemsSummary: row[7],
        totalQty: number_(row[8]),
        estimatedTotal: number_(row[9]),
        depositTotal: number_(row[10]),
        depositPercent:
          number_(row[34]) || DEFAULT_SETTINGS_.depositPercent,
        estimatedBalance: number_(row[11]),
        paymentDeadlineAt: row[36],
        paymentMethod: row[12],
        transferLast5: row[13],
        note: row[14],
        status: status,
        socialProfileId: row[16],
        shippingStatus:
          status === ORDER_STATUS_SHIPPED_ ||
          status === ORDER_STATUS_COMPLETED_
            ? "已開設賣場"
            : "未開設賣場",
        shippedAt: row[18],
        reminderSentAt: row[19],
        cancelledAt: row[20],
        mallReminderSentAt: row[21],
        originalItems: parseJsonArray_(row[22]),
        originalEstimatedTotal: number_(row[23]) || number_(row[9]),
        shortageAdjustments: parseJsonArray_(row[24]),
        shortageAdjustedAt: row[25],
        cashRefundDue: number_(row[26]),
        cashRefundedAt: row[27],
        shortageNotificationSentAt: row[28],
        paymentReportedAt: row[29],
        orderAdjustments: parseJsonArray_(row[30]),
        orderAdjustedAt: row[31],
        orderAdjustmentNotificationSentAt: row[32],
        orderRevision: number_(row[33]),
        depositPercent: paymentSchedule
          ? paymentSchedule.depositPercent
          : DEFAULT_SETTINGS_.depositPercent,
        paymentDueText: paymentSchedule
          ? formatDateTime_(paymentSchedule.dueAt)
          : "",
        paymentOverdue:
          status === ORDER_STATUS_PENDING_ &&
          !!paymentSchedule &&
          now.getTime() >= paymentSchedule.dueAt.getTime(),
        autoCancelOverdue:
          status === ORDER_STATUS_PENDING_ &&
          !!paymentSchedule &&
          now.getTime() >= paymentSchedule.autoCancelAt.getTime(),
        lineAlertCount: lineAlerts.length,
        latestLineAlert: lineAlerts.length
          ? {
              receivedAt: lineAlerts[lineAlerts.length - 1].receivedAt,
              messageType: lineAlerts[lineAlerts.length - 1].messageType,
              textPreview: lineAlerts[lineAlerts.length - 1].textPreview,
            }
          : null,
        reminderDue:
          status === ORDER_STATUS_PENDING_ &&
          !!paymentSchedule &&
          now.getTime() >= paymentSchedule.reminderAt.getTime() &&
          now.getTime() < paymentSchedule.dueAt.getTime() &&
          !String(row[19] || "").trim(),
        reminderMessage: expiresAt ? buildOrderReminderText_(expiresAt) : "",
        mallReminderDue:
          !!mallDeadline &&
          mallDeadline.reminderDue &&
          !String(row[21] || "").trim(),
        mallReminderMessage: mallDeadline
          ? buildMallExpiryReminderText_(mallDeadline.display)
          : "",
        mallPaymentDueText: mallDeadline ? mallDeadline.display : "",
        mallPaymentExpired: mallDeadline ? mallDeadline.expired : false,
        iopenMallPaymentDays:
          number_(row[38]) || DEFAULT_SETTINGS_.iopenMallPaymentDays,
        iopenMallPaymentDeadlineAt: row[39],
      };
    })
    .reverse()
    .slice(0, 300);
}

function readUnreviewedLineAlertsByUser_() {
  var sheet = spreadsheet_().getSheetByName("LineInboundEvents");
  var result = {};
  if (!sheet || sheet.getLastRow() < 2) return result;
  var rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, LINE_EVENT_HEADERS_.length)
    .getDisplayValues();
  rows.forEach(function (row) {
    if (String(row[7] || "").trim() !== "待核對") return;
    var userId = String(row[1] || "").trim();
    if (!userId) return;
    if (!result[userId]) result[userId] = [];
    result[userId].push({
      receivedAt: row[2],
      receivedDate: parseOrderDate_(row[2]),
      messageType: row[3],
      textPreview: row[5],
      matchedOrderNo: row[6],
    });
  });
  return result;
}

function handleAdminResolveLineAlert_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var orderNo = String(data.orderNo || "").trim();
  var decision = String(data.decision || "reviewed").trim();
  var allowedDecisions = ["received", "reviewed", "cancel_overdue"];
  if (!orderNo) throw new Error("ORDER_NOT_FOUND");
  if (allowedDecisions.indexOf(decision) < 0)
    throw new Error("INVALID_LINE_ALERT_DECISION");
  var lock = LockService.getScriptLock();
  var result;
  var notificationTarget;
  var notificationType = "";
  var cancellation;
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var orderSheet = spreadsheet_().getSheetByName("Preorders");
    var orderRow = findOrderRow_(orderSheet, orderNo);
    if (!orderRow) throw new Error("ORDER_NOT_FOUND");
    var order = orderSheet
      .getRange(orderRow, 1, 1, ORDER_HEADERS_.length)
      .getDisplayValues()[0];
    var currentStatus = normalizeOrderStatus_(order[15], order[17]);
    var userId = String(order[2] || "").trim();
    var createdAt = parseOrderDate_(order[1]);
    var paymentSchedule = getOrderPaymentSchedule_(order);
    var eventSheet = spreadsheet_().getSheetByName("LineInboundEvents");
    var reviewedAt = formatDateTime_(new Date());
    var eventIndexes = [];
    if (eventSheet && eventSheet.getLastRow() >= 2) {
      var eventRows = eventSheet
        .getRange(2, 1, eventSheet.getLastRow() - 1, LINE_EVENT_HEADERS_.length)
        .getDisplayValues();
      eventRows.forEach(function (row, index) {
        var receivedAt = parseOrderDate_(row[2]);
        if (
          row[1] === userId &&
          row[7] === "待核對" &&
          (!row[6] || row[6] === orderNo) &&
          (!createdAt || !receivedAt || receivedAt >= createdAt)
        )
          eventIndexes.push(index);
      });
    }
    var duplicate = false;
    var targetAlreadyApplied =
      (decision === "received" &&
        currentStatus === ORDER_STATUS_DEPOSIT_RECEIVED_) ||
      (decision === "cancel_overdue" &&
        currentStatus === ORDER_STATUS_CANCELLED_);
    if (!eventIndexes.length) {
      if (decision === "reviewed" || targetAlreadyApplied) duplicate = true;
      else throw new Error("LINE_ALERT_ALREADY_RESOLVED");
    }
    if (decision === "received") {
      if (
        [
          ORDER_STATUS_PENDING_,
          ORDER_STATUS_PAYMENT_REPORTED_,
          ORDER_STATUS_DEPOSIT_RECEIVED_,
        ].indexOf(currentStatus) < 0
      )
        throw new Error("INVALID_ORDER_STATUS");
      duplicate = currentStatus === ORDER_STATUS_DEPOSIT_RECEIVED_;
      if (!duplicate) {
        orderSheet
          .getRange(orderRow, 16)
          .setValue(ORDER_STATUS_DEPOSIT_RECEIVED_);
        orderSheet
          .getRange(orderRow, 18, 1, 2)
          .setValues([["未開設賣場", ""]]);
        notificationType = "received";
      }
    } else if (decision === "reviewed") {
      if (
        [ORDER_STATUS_PENDING_, ORDER_STATUS_PAYMENT_REPORTED_].indexOf(
          currentStatus,
        ) < 0
      )
        throw new Error("INVALID_ORDER_STATUS");
      if (
        currentStatus === ORDER_STATUS_PENDING_ &&
        paymentSchedule &&
        new Date().getTime() >= paymentSchedule.autoCancelAt.getTime()
      )
        throw new Error("ORDER_PAYMENT_OVERDUE");
    } else {
      if (currentStatus === ORDER_STATUS_CANCELLED_) {
        duplicate = true;
      } else {
        if (currentStatus !== ORDER_STATUS_PENDING_)
          throw new Error("INVALID_ORDER_STATUS");
        if (
          !paymentSchedule ||
          new Date().getTime() < paymentSchedule.autoCancelAt.getTime()
        )
          throw new Error("ORDER_CANCEL_NOT_DUE");
        cancellation = cancelOrderRowLocked_(orderSheet, orderRow, order);
        var cancelledAt = cancellation.cancelledAt;
        notificationType = "cancelled";
      }
    }
    var resolved = 0;
    eventIndexes.forEach(function (index) {
      eventSheet
        .getRange(index + 2, 7, 1, 3)
        .setValues([[orderNo, "已核對", reviewedAt]]);
      resolved += 1;
    });
    var nextStatus =
      decision === "received"
        ? ORDER_STATUS_DEPOSIT_RECEIVED_
        : decision === "cancel_overdue"
          ? ORDER_STATUS_CANCELLED_
          : currentStatus;
    result = {
      orderNo: orderNo,
      status: nextStatus,
      shippingStatus: "未開設賣場",
      shippedAt: "",
      cancelledAt:
        nextStatus === ORDER_STATUS_CANCELLED_
          ? cancelledAt || order[20]
          : order[20],
      resolved: resolved,
      duplicate: duplicate,
      stockRestoredQty: cancellation ? cancellation.stockRestoredQty : 0,
      stockRestoredProducts: cancellation
        ? cancellation.stockRestoredProducts
        : 0,
    };
    notificationTarget = {
      lineUserId: order[2],
      orderNo: order[0],
      createdAt: order[1],
      customerName: order[4],
      itemsSummary: order[7],
      totalQty: number_(order[8]),
      estimatedTotal: number_(order[9]),
      depositTotal: number_(order[10]),
      estimatedBalance: number_(order[11]),
      reason: "超過訂金付款期限仍未確認收到訂金。",
    };
  } finally {
    lock.releaseLock();
  }
  if (cancellation && cancellation.stockRestoredProducts)
    invalidatePublicCatalogCache_();
  var notificationSent = false;
  if (notificationType === "received")
    notificationSent = pushLineMessage_(
      notificationTarget.lineUserId,
      buildUnifiedDepositReceivedCard_(notificationTarget),
      "deposit received " + orderNo,
    );
  if (notificationType === "cancelled")
    notificationSent = pushLineMessage_(
      notificationTarget.lineUserId,
      buildUnifiedCancellationCard_(notificationTarget),
      "order cancellation " + orderNo,
    );
  result.notificationAttempted = !!notificationType;
  result.notificationSent = notificationSent;
  return json_({ ok: true, order: result });
}

function handleAdminUpdateOrderStatus_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var orderNo = String(data.orderNo || "").trim();
  var status = String(data.status || "").trim();
  if (status === ORDER_STATUS_SHIPPED_LEGACY_)
    status = ORDER_STATUS_SHIPPED_;
  var allowed = [
    ORDER_STATUS_PENDING_,
    ORDER_STATUS_PAYMENT_REPORTED_,
    ORDER_STATUS_DEPOSIT_RECEIVED_,
    ORDER_STATUS_SHIPPED_,
    ORDER_STATUS_COMPLETED_,
  ];
  if (!orderNo || allowed.indexOf(status) < 0)
    throw new Error("INVALID_ORDER_STATUS");
  var lock = LockService.getScriptLock();
  var orderResult;
  var notificationTarget;
  var previousStatus;
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
      var row = sheet
        .getRange(rowNumber, 1, 1, ORDER_HEADERS_.length)
        .getDisplayValues()[0];
      previousStatus = normalizeOrderStatus_(row[15], row[17]);
      var shippingStatus =
        status === ORDER_STATUS_SHIPPED_ ||
        status === ORDER_STATUS_COMPLETED_
          ? "已開設賣場"
          : "未開設賣場";
      var shippedAt =
        status === ORDER_STATUS_SHIPPED_
          ? previousStatus === ORDER_STATUS_SHIPPED_ && row[18]
            ? row[18]
            : formatDateTime_(new Date())
          : status === ORDER_STATUS_COMPLETED_
            ? row[18]
            : "";
      var mallPaymentDays = number_(row[38]);
      var mallPaymentDeadlineAt = row[39];
      if (
        status === ORDER_STATUS_SHIPPED_ &&
        previousStatus !== ORDER_STATUS_SHIPPED_
      ) {
        var currentSettings = readSettings_();
        mallPaymentDays = currentSettings.iopenMallPaymentDays;
        mallPaymentDeadlineAt = formatDateTime_(
          calculateMallPaymentDeadlineAt_(shippedAt, mallPaymentDays),
        );
      }
      sheet.getRange(rowNumber, 16).setValue(status);
      sheet
        .getRange(rowNumber, 18, 1, 2)
        .setValues([[shippingStatus, shippedAt]]);
      if (status === ORDER_STATUS_SHIPPED_)
        sheet
          .getRange(rowNumber, 39, 1, 2)
          .setValues([[mallPaymentDays, mallPaymentDeadlineAt]]);
      orderResult = {
        orderNo: orderNo,
        status: status,
        shippingStatus: shippingStatus,
        shippedAt: shippedAt,
        iopenMallPaymentDays: mallPaymentDays,
        iopenMallPaymentDeadlineAt: mallPaymentDeadlineAt,
        reminderDue: false,
      };
      notificationTarget = {
        lineUserId: row[2],
        orderNo: row[0],
        createdAt: row[1],
        customerName: row[4],
        itemsSummary: row[7],
        totalQty: number_(row[8]),
        estimatedTotal: number_(row[9]),
        depositTotal: number_(row[10]),
        depositPercent:
          number_(row[34]) || DEFAULT_SETTINGS_.depositPercent,
        estimatedBalance: number_(row[11]),
        paymentDeadlineAt: row[36],
        shippedAt: shippedAt,
        iopenMallPaymentDays: mallPaymentDays,
        iopenMallPaymentDeadlineAt: mallPaymentDeadlineAt,
      };
      break;
    }
    if (!orderResult) throw new Error("ORDER_NOT_FOUND");
  } finally {
    lock.releaseLock();
  }

  var shouldNotify =
    previousStatus !== status &&
    [ORDER_STATUS_COMPLETED_, ORDER_STATUS_PAYMENT_REPORTED_].indexOf(
      status,
    ) < 0;
  var notificationSent = false;
  if (shouldNotify && status === ORDER_STATUS_PENDING_) {
    notificationSent = pushLineMessage_(
      notificationTarget.lineUserId,
      buildUnifiedPendingCard_(notificationTarget),
      "pending deposit " + orderNo,
    );
  }
  if (shouldNotify && status === ORDER_STATUS_DEPOSIT_RECEIVED_) {
    notificationSent = pushLineMessage_(
      notificationTarget.lineUserId,
      buildUnifiedDepositReceivedCard_(notificationTarget),
      "deposit received " + orderNo,
    );
  }
  if (shouldNotify && status === ORDER_STATUS_SHIPPED_) {
    var iopenMallUrl =
      readSettings_().iopenMallUrl || DEFAULT_SETTINGS_.iopenMallUrl;
    notificationSent = pushLineMessage_(
      notificationTarget.lineUserId,
      buildUnifiedMallReadyCard_(notificationTarget, iopenMallUrl),
      "iopen mall ready " + orderNo,
    );
  }
  orderResult.notificationAttempted = shouldNotify;
  orderResult.notificationSent = notificationSent;
  return json_({ ok: true, order: orderResult });
}

function buildPendingStatusMessage_(order) {
  return {
    type: "text",
    text:
      "訂單狀態更新｜" +
      order.orderNo +
      "\n\n" +
      (order.customerName || "訂購人") +
      "您好，訂單狀態已更新為「待收訂金」。\n請依照訂單說明完成訂金，完成後回傳帳號後五碼供小幫手核對。",
  };
}

function buildDepositReceivedMessage_(order) {
  return {
    type: "flex",
    altText: "已收到訂金｜" + order.orderNo,
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#47748E" } },
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        contents: [
          {
            type: "text",
            text: "已收到訂金",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
          },
          {
            type: "text",
            text: order.orderNo,
            color: "#DCECF3",
            size: "sm",
            margin: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        backgroundColor: "#F3F9FC",
        contents: [
          {
            type: "text",
            text: "訂金已確認入帳，您的預訂已完成。",
            wrap: true,
            weight: "bold",
            size: "md",
            color: "#304B59",
          },
          moneyRow_("訂購人", order.customerName || "—"),
          moneyRow_("已收訂金", "NT$" + formatMoney_(order.depositTotal)),
        ],
      },
    },
  };
}

function buildIopenMallReadyMessage_(order, iopenMallUrl) {
  var mallDeadline = buildMallPaymentDeadline_(
    order.shippedAt,
    order.iopenMallPaymentDeadlineAt,
    order.iopenMallPaymentDays,
  );
  var paymentDeadlineText = mallDeadline ? mallDeadline.display : "賣場開設後第七日 24:00";
  return {
    type: "flex",
    altText: "iOPEN Mall 賣場已開設｜" + order.orderNo,
    contents: {
      type: "bubble",
      styles: {
        header: { backgroundColor: "#4F9468" },
        footer: { separator: true, separatorColor: "#DDE9E1" },
      },
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        contents: [
          {
            type: "text",
            text: "已開設 iOPEN Mall 賣場",
            color: "#FFFFFF",
            weight: "bold",
            size: "lg",
          },
          {
            type: "text",
            text: order.orderNo,
            color: "#E3F2E8",
            size: "sm",
            margin: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        backgroundColor: "#F4FBF6",
        contents: [
          {
            type: "text",
            text: "請於 " + paymentDeadlineText + " 前完成付款。",
            wrap: true,
            weight: "bold",
            size: "md",
            color: "#304B59",
          },
          {
            type: "text",
            text: iopenMallUrl,
            wrap: true,
            size: "xs",
            margin: "md",
            color: "#4F7460",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "14px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#4F9468",
            action: {
              type: "uri",
              label: "前往 iOPEN Mall 賣場",
              uri: iopenMallUrl,
            },
          },
        ],
      },
    },
  };
}

function handleAdminCancelOrder_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var result = cancelOrder_(
    String(data.orderNo || "").trim(),
    cleanText_(data.reason, 200) || "此訂單已由管理員取消。",
  );
  return json_({ ok: true, order: result });
}

function orderItemKey_(item) {
  return (
    String((item && item.productId) || "").trim() +
    "\u0001" +
    String((item && item.variant) || "").trim()
  );
}

function summarizeOrderItems_(items) {
  return items
    .map(function (item) {
      return (
        item.name +
        (item.variant ? "｜" + item.variant : "") +
        " × " +
        item.qty
      );
    })
    .join("\n");
}

function buildOrderItemChanges_(previousItems, adjustedItems) {
  var previousByKey = {};
  var adjustedByKey = {};
  previousItems.forEach(function (item) {
    previousByKey[orderItemKey_(item)] = item;
  });
  adjustedItems.forEach(function (item) {
    adjustedByKey[orderItemKey_(item)] = item;
  });
  var changes = [];
  Object.keys(previousByKey).forEach(function (key) {
    var before = previousByKey[key];
    var after = adjustedByKey[key];
    if (!after) {
      changes.push({ type: "removed", before: before, after: null });
    } else if (number_(before.qty) !== number_(after.qty)) {
      changes.push({ type: "quantity", before: before, after: after });
    }
  });
  Object.keys(adjustedByKey).forEach(function (key) {
    if (!previousByKey[key])
      changes.push({
        type: "added",
        before: null,
        after: adjustedByKey[key],
      });
  });
  return changes;
}

function handleAdminAdjustOrder_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var orderNo = String(data.orderNo || "").trim();
  var requestedItems = Array.isArray(data.items) ? data.items : [];
  var adjustmentId = String(data.adjustmentId || "").trim().slice(0, 100);
  var reason = String(data.reason || "").trim();
  var reasonLabels = {
    customer_change: "顧客變更",
    admin_correction: "管理修正",
  };
  var expectedRevision = Number(data.expectedRevision || 0);
  var expectedStatus = normalizeOrderStatus_(
    String(data.expectedStatus || ""),
    "",
  );
  if (
    !orderNo ||
    !requestedItems.length ||
    !adjustmentId ||
    !reasonLabels[reason]
  )
    throw new Error("INVALID_ORDER_ADJUSTMENT");

  var lock = LockService.getScriptLock();
  var result;
  var notificationTarget;
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Preorders");
    var rowNumber = findOrderRow_(sheet, orderNo);
    if (!rowNumber) throw new Error("ORDER_NOT_FOUND");
    var row = sheet
      .getRange(rowNumber, 1, 1, ORDER_HEADERS_.length)
      .getDisplayValues()[0];
    var history = parseJsonArray_(row[30]);
    var duplicate = history.some(function (entry) {
      return String((entry && entry.adjustmentId) || "") === adjustmentId;
    });
    if (duplicate) {
      return json_({
        ok: true,
        duplicate: true,
        order: { orderNo: orderNo, notificationAttempted: false },
      });
    }
    var status = normalizeOrderStatus_(row[15], row[17]);
    if (
      [
        ORDER_STATUS_PENDING_,
        ORDER_STATUS_PAYMENT_REPORTED_,
        ORDER_STATUS_DEPOSIT_RECEIVED_,
      ].indexOf(status) < 0
    )
      throw new Error("ORDER_EDIT_NOT_ALLOWED");
    if (expectedStatus !== status) throw new Error("ORDER_CHANGED");
    var currentRevision = number_(row[33]);
    if (expectedRevision !== currentRevision) throw new Error("ORDER_CHANGED");

    var previousItems = parseJsonArray_(row[6]);
    if (!previousItems.length) throw new Error("NO_ITEMS_TO_ADJUST");
    var previousByKey = {};
    previousItems.forEach(function (item) {
      previousByKey[orderItemKey_(item)] = item;
    });
    var products = readProducts_();
    var productById = {};
    products.forEach(function (product) {
      productById[product.id] = product;
    });

    var requestedByKey = {};
    requestedItems.forEach(function (sourceItem) {
      var productId = String(
        (sourceItem && sourceItem.productId) || "",
      ).trim();
      var variant = String((sourceItem && sourceItem.variant) || "").trim();
      var qty = Number(sourceItem && sourceItem.qty);
      var key = orderItemKey_({ productId: productId, variant: variant });
      if (
        !productId ||
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > 20 ||
        requestedByKey[key]
      )
        throw new Error("INVALID_ORDER_ADJUSTMENT");
      requestedByKey[key] = { productId: productId, variant: variant, qty: qty };
    });

    var adjustedItems = [];
    var totalQty = 0;
    var adjustedTotal = 0;
    Object.keys(requestedByKey).forEach(function (key) {
      var requested = requestedByKey[key];
      var existing = previousByKey[key];
      var product = productById[requested.productId];
      var unitPrice;
      var name;
      if (existing) {
        unitPrice =
          number_(existing.unitPriceTwd) ||
          Math.round(number_(existing.subtotalTwd) / number_(existing.qty));
        name = String(existing.name || "");
      } else {
        if (
          !product ||
          !product.active ||
          (product.variants.length &&
            product.variants.indexOf(requested.variant) < 0) ||
          (!product.variants.length && requested.variant)
        )
          throw new Error("PRODUCT_CHANGED");
        unitPrice = number_(product.priceTwd);
        name = product.name;
      }
      var item = {
        productId: requested.productId,
        name: name,
        variant: requested.variant,
        qty: requested.qty,
        unitPriceTwd: unitPrice,
        subtotalTwd: unitPrice * requested.qty,
      };
      adjustedItems.push(item);
      totalQty += requested.qty;
      adjustedTotal += item.subtotalTwd;
    });
    if (!adjustedItems.length || totalQty > 100)
      throw new Error("INVALID_ORDER_ADJUSTMENT");

    var changes = buildOrderItemChanges_(previousItems, adjustedItems);
    if (!changes.length) throw new Error("NO_ORDER_CHANGES");
    var previousTotal = number_(row[9]);
    var previousDeposit = number_(row[10]);
    var previousBalance = number_(row[11]);
    var orderDepositRate =
      (number_(row[34]) || DEFAULT_SETTINGS_.depositPercent) / 100;
    var adjustedDeposit =
      status === ORDER_STATUS_PENDING_
        ? Math.ceil(adjustedTotal * orderDepositRate)
        : previousDeposit;
    var adjustedOrderDeposit = Math.ceil(
      adjustedTotal * orderDepositRate,
    );
    var receivedDeposit =
      status === ORDER_STATUS_PENDING_ ? 0 : previousDeposit;
    var adjustedBalance = Math.max(adjustedTotal - adjustedDeposit, 0);
    var adjustmentDue =
      status === ORDER_STATUS_DEPOSIT_RECEIVED_
        ? Math.max(adjustedDeposit - adjustedTotal, 0)
        : 0;
    var adjustedAt = formatDateTime_(new Date());
    var nextRevision = currentRevision + 1;
    var historyEntry = {
      adjustmentId: adjustmentId,
      adjustedAt: adjustedAt,
      status: status,
      reason: reason,
      reasonLabel: reasonLabels[reason],
      previousTotal: previousTotal,
      adjustedTotal: adjustedTotal,
      previousDeposit: previousDeposit,
      adjustedDeposit: adjustedDeposit,
      adjustedOrderDeposit: adjustedOrderDeposit,
      previousBalance: previousBalance,
      adjustedBalance: adjustedBalance,
      changes: changes,
      revision: nextRevision,
    };
    history.push(historyEntry);
    var itemsSummary = summarizeOrderItems_(adjustedItems);

    sheet
      .getRange(rowNumber, 7, 1, 6)
      .setValues([
        [
          JSON.stringify(adjustedItems),
          itemsSummary,
          totalQty,
          adjustedTotal,
          adjustedDeposit,
          adjustedBalance,
        ],
      ]);
    if (status === ORDER_STATUS_DEPOSIT_RECEIVED_)
      sheet
        .getRange(rowNumber, 27, 1, 2)
        .setValues([[adjustmentDue, ""]]);
    sheet
      .getRange(rowNumber, 31, 1, 4)
      .setValues([
        [JSON.stringify(history), adjustedAt, "", nextRevision],
      ]);

    result = {
      orderNo: orderNo,
      items: adjustedItems,
      itemsSummary: itemsSummary,
      totalQty: totalQty,
      estimatedTotal: adjustedTotal,
      depositTotal: adjustedDeposit,
      depositPercent:
        number_(row[34]) || DEFAULT_SETTINGS_.depositPercent,
      estimatedBalance: adjustedBalance,
      paymentDeadlineAt: row[36],
      status: status,
      cashRefundDue:
        status === ORDER_STATUS_DEPOSIT_RECEIVED_
          ? adjustmentDue
          : number_(row[26]),
      orderAdjustments: history,
      orderAdjustedAt: adjustedAt,
      orderRevision: nextRevision,
    };
    notificationTarget = {
      lineUserId: row[2],
      orderNo: orderNo,
      createdAt: row[1],
      customerName: row[4],
      itemsSummary: itemsSummary,
      totalQty: totalQty,
      estimatedTotal: adjustedTotal,
      depositTotal: adjustedDeposit,
      depositPercent:
        number_(row[34]) || DEFAULT_SETTINGS_.depositPercent,
      estimatedBalance: adjustedBalance,
      paymentDeadlineAt: row[36],
      status: status,
      previousTotal: previousTotal,
      adjustedTotal: adjustedTotal,
      adjustedOrderDeposit: adjustedOrderDeposit,
      receivedDeposit: receivedDeposit,
      originalOrderTotal: previousTotal,
      changeAmount: Math.abs(adjustedTotal - previousTotal),
      changeType:
        adjustedTotal > previousTotal
          ? "increase"
          : adjustedTotal < previousTotal
            ? "decrease"
            : "none",
      changes: changes,
      adjustmentDue: adjustmentDue,
      cashRefundDue: adjustmentDue,
      reason: reason,
      reasonLabel: reasonLabels[reason],
    };
  } finally {
    lock.releaseLock();
  }

  var notificationSent = pushLineMessage_(
    notificationTarget.lineUserId,
    buildUnifiedOrderAdjustmentCard_(notificationTarget),
    "order adjustment " + orderNo,
  );
  var notificationSentAt = notificationSent ? formatDateTime_(new Date()) : "";
  if (notificationSentAt) {
    var notificationLock = LockService.getScriptLock();
    notificationLock.waitLock(10000);
    try {
      var notificationSheet = spreadsheet_().getSheetByName("Preorders");
      var notificationRow = findOrderRow_(notificationSheet, orderNo);
      if (notificationRow) {
        var savedHistory = parseJsonArray_(
          notificationSheet.getRange(notificationRow, 31).getDisplayValue(),
        );
        var savedEntry;
        savedHistory.forEach(function (entry) {
          if (String(entry.adjustmentId || "") === adjustmentId)
            savedEntry = entry;
        });
        if (savedEntry) {
          savedEntry.notificationSentAt = notificationSentAt;
          notificationSheet
            .getRange(notificationRow, 31)
            .setValue(JSON.stringify(savedHistory));
          result.orderAdjustments = savedHistory;
        }
        if (
          savedHistory.length &&
          String(savedHistory[savedHistory.length - 1].adjustmentId || "") ===
            adjustmentId
        )
          notificationSheet
            .getRange(notificationRow, 33)
            .setValue(notificationSentAt);
      }
    } finally {
      notificationLock.releaseLock();
    }
  }
  result.notificationAttempted = true;
  result.notificationSent = notificationSent;
  result.orderAdjustmentNotificationSentAt = notificationSentAt;
  return json_({ ok: true, order: result });
}

function handleAdminAdjustOrderShortage_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var orderNo = String(data.orderNo || "").trim();
  var requested = Array.isArray(data.cancellations) ? data.cancellations : [];
  var adjustmentId = String(data.adjustmentId || "").trim().slice(0, 100);
  var expectedRevision = Number(data.expectedRevision || 0);
  var expectedStatus = normalizeOrderStatus_(
    String(data.expectedStatus || ""),
    "",
  );
  if (!orderNo || !requested.length || !adjustmentId)
    throw new Error("INVALID_SHORTAGE_ADJUSTMENT");

  var lock = LockService.getScriptLock();
  var result;
  var notificationTarget;
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Preorders");
    var rowNumber = findOrderRow_(sheet, orderNo);
    if (!rowNumber) throw new Error("ORDER_NOT_FOUND");
    var row = sheet
      .getRange(rowNumber, 1, 1, ORDER_HEADERS_.length)
      .getDisplayValues()[0];
    var adjustments = parseJsonArray_(row[24]);
    var duplicate = adjustments.some(function (entry) {
      return String((entry && entry.adjustmentId) || "") === adjustmentId;
    });
    if (duplicate) {
      return json_({
        ok: true,
        duplicate: true,
        order: { orderNo: orderNo, notificationAttempted: false },
      });
    }
    var currentStatus = normalizeOrderStatus_(row[15], row[17]);
    if (
      [ORDER_STATUS_DEPOSIT_RECEIVED_, ORDER_STATUS_SHIPPED_].indexOf(
        currentStatus,
      ) < 0
    )
      throw new Error("SHORTAGE_REQUIRES_DEPOSIT");
    if (expectedStatus !== currentStatus) throw new Error("ORDER_CHANGED");
    var currentRevision = number_(row[33]);
    if (expectedRevision !== currentRevision) throw new Error("ORDER_CHANGED");

    var currentItems = parseJsonArray_(row[6]);
    if (!currentItems.length) throw new Error("NO_ITEMS_TO_ADJUST");
    var cancelByIndex = {};
    requested.forEach(function (entry) {
      var itemIndex = Number(entry && entry.index);
      var qty = Number(entry && entry.qty);
      if (
        !Number.isInteger(itemIndex) ||
        itemIndex < 0 ||
        itemIndex >= currentItems.length ||
        !Number.isInteger(qty) ||
        qty < 1
      )
        throw new Error("INVALID_SHORTAGE_ADJUSTMENT");
      if (cancelByIndex[itemIndex])
        throw new Error("INVALID_SHORTAGE_ADJUSTMENT");
      cancelByIndex[itemIndex] = qty;
    });

    var cancelledItems = [];
    var remainingItems = [];
    var cancelledAmount = 0;
    currentItems.forEach(function (item, itemIndex) {
      var currentQty = number_(item.qty);
      var cancelQty = cancelByIndex[itemIndex] || 0;
      if (cancelQty > currentQty)
        throw new Error("INVALID_SHORTAGE_ADJUSTMENT");
      var unitPrice = number_(item.unitPriceTwd);
      if (!unitPrice && currentQty)
        unitPrice = Math.round(number_(item.subtotalTwd) / currentQty);
      if (cancelQty) {
        cancelledItems.push({
          productId: String(item.productId || ""),
          name: String(item.name || ""),
          variant: String(item.variant || ""),
          qty: cancelQty,
          unitPriceTwd: unitPrice,
          subtotalTwd: unitPrice * cancelQty,
        });
        cancelledAmount += unitPrice * cancelQty;
      }
      var remainingQty = currentQty - cancelQty;
      if (remainingQty > 0) {
        remainingItems.push({
          productId: String(item.productId || ""),
          name: String(item.name || ""),
          variant: String(item.variant || ""),
          qty: remainingQty,
          unitPriceTwd: unitPrice,
          subtotalTwd: unitPrice * remainingQty,
        });
      }
    });
    if (!cancelledItems.length || cancelledAmount < 1)
      throw new Error("INVALID_SHORTAGE_ADJUSTMENT");

    var originalItemsJson = String(row[22] || "").trim() || row[6] || "[]";
    var originalTotal = number_(row[23]) || number_(row[9]);
    var previousTotal = number_(row[9]);
    var adjustedTotal = remainingItems.reduce(function (sum, item) {
      return sum + number_(item.subtotalTwd);
    }, 0);
    var depositTotal = number_(row[10]);
    var adjustedBalance = Math.max(adjustedTotal - depositTotal, 0);
    var cashRefundDue = Math.max(depositTotal - adjustedTotal, 0);
    var adjustedAt = formatDateTime_(new Date());
    var nextOrderRevision = currentRevision + 1;
    adjustments.push({
      adjustmentId: adjustmentId,
      adjustedAt: adjustedAt,
      previousTotal: previousTotal,
      cancelledAmount: cancelledAmount,
      adjustedTotal: adjustedTotal,
      cancelledItems: cancelledItems,
    });
    var totalQty = remainingItems.reduce(function (sum, item) {
      return sum + number_(item.qty);
    }, 0);
    var itemsSummary = remainingItems
      .map(function (item) {
        return (
          item.name +
          (item.variant ? "｜" + item.variant : "") +
          " × " +
          item.qty
        );
      })
      .join("\n");
    var allItemsCancelled = remainingItems.length === 0;
    var nextStatus = allItemsCancelled
      ? ORDER_STATUS_CANCELLED_
      : currentStatus;
    var cancelledAt = allItemsCancelled ? adjustedAt : row[20];
    var shippingStatus = allItemsCancelled ? "未開設賣場" : row[17];
    var shippedAt = allItemsCancelled ? "" : row[18];

    sheet
      .getRange(rowNumber, 7, 1, 6)
      .setValues([
        [
          JSON.stringify(remainingItems),
          itemsSummary,
          totalQty,
          adjustedTotal,
          depositTotal,
          adjustedBalance,
        ],
      ]);
    sheet.getRange(rowNumber, 16).setValue(nextStatus);
    sheet
      .getRange(rowNumber, 18, 1, 2)
      .setValues([[shippingStatus, shippedAt]]);
    sheet.getRange(rowNumber, 21).setValue(cancelledAt);
    sheet
      .getRange(rowNumber, 23, 1, 7)
      .setValues([
        [
          originalItemsJson,
          originalTotal,
          JSON.stringify(adjustments),
          adjustedAt,
          cashRefundDue,
          "",
          "",
        ],
      ]);
    sheet.getRange(rowNumber, 34).setValue(nextOrderRevision);

    result = {
      orderNo: orderNo,
      items: remainingItems,
      itemsSummary: itemsSummary,
      totalQty: totalQty,
      estimatedTotal: adjustedTotal,
      originalEstimatedTotal: originalTotal,
      depositTotal: depositTotal,
      estimatedBalance: adjustedBalance,
      status: nextStatus,
      shippingStatus: shippingStatus,
      shippedAt: shippedAt,
      cancelledAt: cancelledAt,
      shortageAdjustments: adjustments,
      shortageAdjustedAt: adjustedAt,
      cashRefundDue: cashRefundDue,
      cashRefundedAt: "",
      orderRevision: nextOrderRevision,
    };
    notificationTarget = {
      lineUserId: row[2],
      orderNo: orderNo,
      createdAt: row[1],
      customerName: row[4],
      itemsSummary: itemsSummary || "品項已全數取消",
      totalQty: totalQty,
      estimatedTotal: adjustedTotal,
      originalTotal: originalTotal,
      previousTotal: previousTotal,
      cancelledAmount: cancelledAmount,
      adjustedTotal: adjustedTotal,
      depositTotal: depositTotal,
      adjustedOrderDeposit: Math.ceil(
        adjustedTotal *
          ((number_(row[34]) || DEFAULT_SETTINGS_.depositPercent) / 100),
      ),
      depositPercent:
        number_(row[34]) || DEFAULT_SETTINGS_.depositPercent,
      receivedDeposit: depositTotal,
      adjustedBalance: adjustedBalance,
      estimatedBalance: adjustedBalance,
      status: currentStatus,
      originalOrderTotal: previousTotal,
      changeAmount: cancelledAmount,
      changeType: "decrease",
      cashRefundDue: cashRefundDue,
      allItemsCancelled: allItemsCancelled,
      cancelledItems: cancelledItems,
    };
  } finally {
    lock.releaseLock();
  }

  var notificationSent = pushLineMessage_(
    notificationTarget.lineUserId,
    buildUnifiedShortageCard_(notificationTarget),
    "shortage adjustment " + orderNo,
  );
  var notificationSentAt = notificationSent ? formatDateTime_(new Date()) : "";
  if (notificationSentAt) {
    var notificationSheet = spreadsheet_().getSheetByName("Preorders");
    var notificationRow = findOrderRow_(notificationSheet, orderNo);
    if (notificationRow)
      notificationSheet.getRange(notificationRow, 29).setValue(notificationSentAt);
  }
  result.notificationAttempted = true;
  result.notificationSent = notificationSent;
  result.shortageNotificationSentAt = notificationSentAt;
  return json_({ ok: true, order: result });
}

function handleAdminConfirmCashRefund_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var orderNo = String(data.orderNo || "").trim();
  if (!orderNo) throw new Error("ORDER_NOT_FOUND");
  var lock = LockService.getScriptLock();
  var result;
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Preorders");
    var rowNumber = findOrderRow_(sheet, orderNo);
    if (!rowNumber) throw new Error("ORDER_NOT_FOUND");
    var row = sheet
      .getRange(rowNumber, 1, 1, ORDER_HEADERS_.length)
      .getDisplayValues()[0];
    var cashRefundDue = number_(row[26]);
    if (cashRefundDue < 1) throw new Error("NO_CASH_REFUND_DUE");
    var cashRefundedAt = String(row[27] || "").trim();
    if (!cashRefundedAt) {
      cashRefundedAt = formatDateTime_(new Date());
      sheet.getRange(rowNumber, 28).setValue(cashRefundedAt);
    }
    result = {
      orderNo: orderNo,
      cashRefundDue: cashRefundDue,
      cashRefundedAt: cashRefundedAt,
    };
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true, order: result });
}

function buildShortageAdjustmentMessage_(order) {
  var cancelledText = order.cancelledItems
    .map(function (item) {
      return (
        "・" +
        item.name +
        (item.variant ? "｜" + item.variant : "") +
        " × " +
        item.qty +
        "（扣除 NT$" +
        formatMoney_(item.subtotalTwd) +
        "）"
      );
    })
    .join("\n");
  var paymentText = order.allItemsCancelled
    ? "訂單已因全品項缺貨取消，已付訂金 NT$" +
      formatMoney_(order.depositTotal) +
      " 列為待退款。"
    : order.cashRefundDue > 0
      ? "已付訂金 NT$" +
        formatMoney_(order.depositTotal) +
        "，出貨時將退還現金 NT$" +
        formatMoney_(order.cashRefundDue) +
        "。"
      : "已付訂金 NT$" +
        formatMoney_(order.depositTotal) +
        "，後續應付 NT$" +
        formatMoney_(order.adjustedBalance) +
        "。";
  return {
    type: "text",
    text:
      "訂單缺貨調整｜" +
      order.orderNo +
      "\n\n" +
      (order.customerName || "訂購人") +
      "您好，以下缺貨品項已取消：\n" +
      cancelledText +
      "\n\n原訂單金額 NT$" +
      formatMoney_(order.originalTotal) +
      "\n本次扣除 NT$" +
      formatMoney_(order.cancelledAmount) +
      "\n調整後金額 NT$" +
      formatMoney_(order.adjustedTotal) +
      "\n" +
      paymentText +
      "\n\n如有疑問，請直接在 LINE 與小幫手聯絡。",
  };
}

function handleAdminSendOrderReminder_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var orderNo = String(data.orderNo || "").trim();
  var message = cleanText_(data.message, 500);
  if (!orderNo || !message) throw new Error("INVALID_REMINDER");
  var lock = LockService.getScriptLock();
  var target;
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Preorders");
    var rowNumber = findOrderRow_(sheet, orderNo);
    if (!rowNumber) throw new Error("ORDER_NOT_FOUND");
    var row = sheet
      .getRange(rowNumber, 1, 1, ORDER_HEADERS_.length)
      .getDisplayValues()[0];
    if (normalizeOrderStatus_(row[15], row[17]) !== ORDER_STATUS_PENDING_)
      throw new Error("INVALID_ORDER_STATUS");
    var paymentSchedule = getOrderPaymentSchedule_(row);
    if (
      !paymentSchedule ||
      new Date().getTime() < paymentSchedule.reminderAt.getTime() ||
      new Date().getTime() >= paymentSchedule.dueAt.getTime()
    )
      throw new Error("REMINDER_NOT_DUE");
    target = {
      lineUserId: row[2],
      orderNo: row[0],
      createdAt: row[1],
      customerName: row[4],
      itemsSummary: row[7],
      totalQty: number_(row[8]),
      estimatedTotal: number_(row[9]),
      depositTotal: number_(row[10]),
      estimatedBalance: number_(row[11]),
    };
  } finally {
    lock.releaseLock();
  }
  if (
    !pushLineMessage_(
      target.lineUserId,
      buildUnifiedReminderCard_(
        target,
        message,
        "訂金付款提醒",
        "",
      ),
      "reminder " + target.orderNo,
    )
  )
    throw new Error("LINE_PUSH_FAILED");
  sheet = spreadsheet_().getSheetByName("Preorders");
  rowNumber = findOrderRow_(sheet, orderNo);
  var reminderSentAt = formatDateTime_(new Date());
  if (rowNumber) sheet.getRange(rowNumber, 20).setValue(reminderSentAt);
  return json_({
    ok: true,
    order: {
      orderNo: orderNo,
      reminderDue: false,
      reminderSentAt: reminderSentAt,
    },
  });
}

function handleAdminSendMallExpiryReminder_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var orderNo = String(data.orderNo || "").trim();
  var message = cleanText_(data.message, 500);
  if (!orderNo || !message) throw new Error("INVALID_REMINDER");
  var lock = LockService.getScriptLock();
  var target;
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Preorders");
    var rowNumber = findOrderRow_(sheet, orderNo);
    if (!rowNumber) throw new Error("ORDER_NOT_FOUND");
    var row = sheet
      .getRange(rowNumber, 1, 1, ORDER_HEADERS_.length)
      .getDisplayValues()[0];
    if (normalizeOrderStatus_(row[15], row[17]) !== ORDER_STATUS_SHIPPED_)
      throw new Error("INVALID_ORDER_STATUS");
    var mallDeadline = buildMallPaymentDeadline_(
      row[18],
      row[39],
      number_(row[38]),
    );
    if (
      !mallDeadline ||
      !mallDeadline.reminderDue ||
      String(row[21] || "").trim()
    )
      throw new Error("REMINDER_NOT_DUE");
    target = {
      lineUserId: row[2],
      orderNo: row[0],
      createdAt: row[1],
      customerName: row[4],
      itemsSummary: row[7],
      totalQty: number_(row[8]),
      estimatedTotal: number_(row[9]),
      depositTotal: number_(row[10]),
      estimatedBalance: number_(row[11]),
    };
  } finally {
    lock.releaseLock();
  }
  if (
    !pushLineMessage_(
      target.lineUserId,
      buildUnifiedReminderCard_(
        target,
        message,
        "iOPEN Mall 付款提醒",
        readSettings_().iopenMallUrl || DEFAULT_SETTINGS_.iopenMallUrl,
      ),
      "mall expiry reminder " + target.orderNo,
    )
  )
    throw new Error("LINE_PUSH_FAILED");
  sheet = spreadsheet_().getSheetByName("Preorders");
  rowNumber = findOrderRow_(sheet, orderNo);
  var mallReminderSentAt = formatDateTime_(new Date());
  if (rowNumber) sheet.getRange(rowNumber, 22).setValue(mallReminderSentAt);
  return json_({
    ok: true,
    order: {
      orderNo: orderNo,
      mallReminderDue: false,
      mallReminderSentAt: mallReminderSentAt,
    },
  });
}

function setupPreorderAutomationTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "processExpiredPreorders")
      ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("processExpiredPreorders")
    .timeBased()
    .everyMinutes(15)
    .create();
  return "每 15 分鐘檢查逾期訂單的排程已設定";
}

function processExpiredPreorders() {
  setupQuokkaPreorder();
  var sheet = spreadsheet_().getSheetByName("Preorders");
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, ORDER_HEADERS_.length)
    .getDisplayValues();
  var now = new Date();
  var lineAlertsByUser = readUnreviewedLineAlertsByUser_();
  var expiredOrderNos = [];
  rows.forEach(function (row) {
    var createdAt = parseOrderDate_(row[1]);
    var paymentSchedule = getOrderPaymentSchedule_(row);
    if (
      !createdAt ||
      normalizeOrderStatus_(row[15], row[17]) !== ORDER_STATUS_PENDING_
    )
      return;
    var alerts = lineAlertsByUser[String(row[2] || "").trim()] || [];
    var hasPendingAlert = alerts.some(function (alert) {
      return (
        (!alert.matchedOrderNo || alert.matchedOrderNo === row[0]) &&
        (!createdAt || !alert.receivedDate || alert.receivedDate >= createdAt)
      );
    });
    if (hasPendingAlert) return;
    if (
      paymentSchedule &&
      now.getTime() >= paymentSchedule.autoCancelAt.getTime()
    )
      expiredOrderNos.push(String(row[0] || "").trim());
  });
  expiredOrderNos.forEach(function (orderNo) {
    if (orderNo)
      cancelOrder_(orderNo, "超過訂金付款期限仍未確認收到訂金。");
  });
  return expiredOrderNos.length;
}

function prepareInventoryRestock_(itemsJson) {
  var items;
  try {
    items = JSON.parse(String(itemsJson || "[]"));
  } catch (error) {
    throw new Error("INVALID_ORDER_ITEMS");
  }
  if (!Array.isArray(items)) throw new Error("INVALID_ORDER_ITEMS");
  var quantities = {};
  items.forEach(function (item) {
    var productId = String((item && item.productId) || "").trim();
    var qty = Number(item && item.qty);
    if (!productId || !Number.isInteger(qty) || qty < 1)
      throw new Error("INVALID_ORDER_ITEMS");
    quantities[productId] = (quantities[productId] || 0) + qty;
  });
  var productIds = Object.keys(quantities);
  if (!productIds.length) throw new Error("INVALID_ORDER_ITEMS");
  var productSheet = spreadsheet_().getSheetByName("Products");
  if (!productSheet || productSheet.getLastRow() < 2)
    throw new Error("PRODUCT_CHANGED");
  var rows = productSheet
    .getRange(2, 1, productSheet.getLastRow() - 1, PRODUCT_HEADERS_.length)
    .getValues();
  var productRows = {};
  rows.forEach(function (row, index) {
    var id = String(row[0] || "").trim();
    if (id) productRows[id] = { rowNumber: index + 2, row: row };
  });
  var updates = [];
  productIds.forEach(function (productId) {
    var source = productRows[productId];
    if (!source) throw new Error("PRODUCT_CHANGED");
    var oldStock = source.row[12];
    if (oldStock === "" || oldStock == null) return;
    var stock = Number(oldStock);
    if (!Number.isInteger(stock) || stock < 0)
      throw new Error("PRODUCT_CHANGED");
    var oldStatus = String(source.row[7] || "");
    updates.push({
      rowNumber: source.rowNumber,
      oldStatus: oldStatus,
      oldStock: oldStock,
      newStatus:
        stock === 0 && oldStatus === "下架" ? "上架" : oldStatus || "上架",
      newStock: stock + quantities[productId],
      restoredQty: quantities[productId],
    });
  });
  return { productSheet: productSheet, updates: updates };
}

function applyInventoryRestock_(plan, rollback) {
  (plan.updates || []).forEach(function (update) {
    plan.productSheet
      .getRange(update.rowNumber, 8)
      .setValue(rollback ? update.oldStatus : update.newStatus);
    plan.productSheet
      .getRange(update.rowNumber, 13)
      .setValue(rollback ? update.oldStock : update.newStock);
  });
}

function cancelOrderRowLocked_(sheet, rowNumber, row) {
  var plan = prepareInventoryRestock_(row[6]);
  var oldOrderState = {
    status: row[15],
    shippingStatus: row[17],
    shippedAt: row[18],
    cancelledAt: row[20],
  };
  var cancelledAt = formatDateTime_(new Date());
  try {
    applyInventoryRestock_(plan, false);
    sheet.getRange(rowNumber, 16).setValue(ORDER_STATUS_CANCELLED_);
    sheet.getRange(rowNumber, 18, 1, 2).setValues([["未開設賣場", ""]]);
    sheet.getRange(rowNumber, 21).setValue(cancelledAt);
  } catch (error) {
    try {
      applyInventoryRestock_(plan, true);
      sheet.getRange(rowNumber, 16).setValue(oldOrderState.status);
      sheet
        .getRange(rowNumber, 18, 1, 2)
        .setValues([[oldOrderState.shippingStatus, oldOrderState.shippedAt]]);
      sheet.getRange(rowNumber, 21).setValue(oldOrderState.cancelledAt);
    } catch (rollbackError) {
      console.error("Order cancellation rollback failed: " + rollbackError);
    }
    throw new Error("ORDER_CANCEL_WRITE_FAILED");
  }
  var restoredQty = plan.updates.reduce(function (total, update) {
    return total + update.restoredQty;
  }, 0);
  return {
    cancelledAt: cancelledAt,
    stockRestoredQty: restoredQty,
    stockRestoredProducts: plan.updates.length,
  };
}

function cancelOrder_(orderNo, reason) {
  if (!orderNo) throw new Error("ORDER_NOT_FOUND");
  var lock = LockService.getScriptLock();
  var target;
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Preorders");
    var rowNumber = findOrderRow_(sheet, orderNo);
    if (!rowNumber) throw new Error("ORDER_NOT_FOUND");
    var row = sheet
      .getRange(rowNumber, 1, 1, ORDER_HEADERS_.length)
      .getDisplayValues()[0];
    var currentStatus = normalizeOrderStatus_(row[15], row[17]);
    if (currentStatus === ORDER_STATUS_CANCELLED_) {
      return {
        orderNo: orderNo,
        status: ORDER_STATUS_CANCELLED_,
        shippingStatus: "未開設賣場",
        cancelledAt: row[20],
        reminderDue: false,
        duplicate: true,
        stockRestoredQty: 0,
      };
    }
    if (
      String(reason || "").indexOf("訂金付款期限") >= 0 &&
      currentStatus !== ORDER_STATUS_PENDING_
    ) {
      return {
        orderNo: orderNo,
        status: currentStatus,
        shippingStatus: row[17],
        shippedAt: row[18],
        reminderDue: false,
      };
    }
    var cancellation = cancelOrderRowLocked_(sheet, rowNumber, row);
    var cancelledAt = cancellation.cancelledAt;
    target = {
      lineUserId: row[2],
      orderNo: row[0],
      createdAt: row[1],
      customerName: row[4],
      itemsSummary: row[7],
      totalQty: number_(row[8]),
      estimatedTotal: number_(row[9]),
      depositTotal: number_(row[10]),
      estimatedBalance: number_(row[11]),
      reason: reason,
    };
  } finally {
    lock.releaseLock();
  }
  if (cancellation.stockRestoredProducts)
    invalidatePublicCatalogCache_();
  var notificationSent = pushLineMessage_(
    target.lineUserId,
    buildUnifiedCancellationCard_(target),
    "order cancellation " + target.orderNo,
  );
  return {
    orderNo: orderNo,
    status: ORDER_STATUS_CANCELLED_,
    shippingStatus: "未開設賣場",
    shippedAt: "",
    cancelledAt: cancelledAt,
    reminderDue: false,
    notificationSent: notificationSent,
    duplicate: false,
    stockRestoredQty: cancellation.stockRestoredQty,
    stockRestoredProducts: cancellation.stockRestoredProducts,
  };
}

function buildOrderCancellationMessage_(order) {
  return {
    type: "flex",
    altText: "訂單已取消｜" + order.orderNo,
    contents: {
      type: "bubble",
      styles: { header: { backgroundColor: "#7C858A" } },
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        contents: [
          {
            type: "text",
            text: "預購訂單已取消",
            color: "#FFFFFF",
            weight: "bold",
            size: "xl",
          },
          {
            type: "text",
            text: order.orderNo,
            color: "#EEF0F1",
            size: "sm",
            margin: "sm",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "18px",
        backgroundColor: "#F5F6F6",
        contents: [
          {
            type: "text",
            text: order.customerName || "訂購人",
            weight: "bold",
            color: "#374047",
          },
          {
            type: "text",
            text: order.itemsSummary || "",
            wrap: true,
            size: "sm",
            margin: "md",
            color: "#5E686D",
          },
          { type: "separator", margin: "lg", color: "#D8DDDF" },
          {
            type: "text",
            text: String(order.reason || "訂單已由管理員取消。"),
            wrap: true,
            size: "sm",
            margin: "lg",
            color: "#5E686D",
          },
          {
            type: "text",
            text: "如有疑問，請直接在 LINE 與小幫手聯絡。",
            wrap: true,
            size: "xs",
            margin: "md",
            color: "#858E92",
          },
        ],
      },
    },
  };
}

function buildOrderReminderText_(expiresAt) {
  return (
    "溫馨提醒：\n" +
    "此訂單的訂金付款期限為 " +
    formatDateTime_(expiresAt) +
    "。\n請在期限前完成匯款並回傳帳號後五碼。"
  );
}

function buildMallExpiryReminderText_(deadlineText) {
  return (
    "溫馨提醒：\n" +
    "此訂單的 iOPEN Mall 付款期限為 " +
    String(deadlineText || "賣場開設後第七日 24:00") +
    "，請務必在期限內至賣場下標。\n" +
    "訂單取消後訂金不退還喔～^_^"
  );
}

function normalizeOrderStatus_(status, shippingStatus) {
  var value = String(status || "").trim();
  if (value === ORDER_STATUS_CANCELLED_) return ORDER_STATUS_CANCELLED_;
  if (value === ORDER_STATUS_COMPLETED_) return ORDER_STATUS_COMPLETED_;
  if (
    ["已出貨", "已開設賣場"].indexOf(
      String(shippingStatus || "").trim(),
    ) >= 0 ||
    value === ORDER_STATUS_SHIPPED_ ||
    value === ORDER_STATUS_SHIPPED_LEGACY_
  )
    return ORDER_STATUS_SHIPPED_;
  if (value === ORDER_STATUS_DEPOSIT_RECEIVED_)
    return ORDER_STATUS_DEPOSIT_RECEIVED_;
  if (value === ORDER_STATUS_PAYMENT_REPORTED_)
    return ORDER_STATUS_PAYMENT_REPORTED_;
  return ORDER_STATUS_PENDING_;
}

function parseOrderDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  var text = String(value || "").trim();
  if (!text) return null;
  try {
    return Utilities.parseDate(
      text,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm:ss",
    );
  } catch (error) {
    return null;
  }
}

function getOrderPaymentSchedule_(row) {
  var createdAt = parseOrderDate_(row[1]);
  if (!createdAt) return null;
  return {
    reminderAt:
      parseOrderDate_(row[35]) ||
      new Date(createdAt.getTime() + ORDER_REMINDER_HOURS_ * 3600000),
    dueAt:
      parseOrderDate_(row[36]) ||
      new Date(createdAt.getTime() + ORDER_PAYMENT_DEADLINE_HOURS_ * 3600000),
    autoCancelAt:
      parseOrderDate_(row[37]) ||
      new Date(createdAt.getTime() + ORDER_AUTO_CANCEL_HOURS_ * 3600000),
    depositPercent: number_(row[34]) || DEFAULT_SETTINGS_.depositPercent,
  };
}

function calculateMallPaymentDeadlineAt_(shippedAt, paymentDays) {
  var openedAt = parseOrderDate_(shippedAt);
  if (!openedAt) return "";
  var timezone = Session.getScriptTimeZone();
  var openedDate = Utilities.formatDate(openedAt, timezone, "yyyy-MM-dd");
  var openedDayStart = Utilities.parseDate(
    openedDate + " 00:00:00",
    timezone,
    "yyyy-MM-dd HH:mm:ss",
  );
  return new Date(
    openedDayStart.getTime() +
      Number(paymentDays || DEFAULT_SETTINGS_.iopenMallPaymentDays) *
        24 *
        60 *
        60 *
        1000,
  );
}

function buildMallPaymentDeadline_(shippedAt, storedDeadlineAt, paymentDays) {
  var deadline =
    parseOrderDate_(storedDeadlineAt) ||
    calculateMallPaymentDeadlineAt_(
      shippedAt,
      paymentDays || DEFAULT_SETTINGS_.iopenMallPaymentDays,
    );
  if (!deadline) return null;
  var timezone = Session.getScriptTimeZone();
  var displayDate = new Date(deadline.getTime() - 1000);
  return {
    display: Utilities.formatDate(displayDate, timezone, "yyyy/MM/dd") + " 24:00",
    expired: new Date().getTime() >= deadline.getTime(),
    reminderDue:
      new Date().getTime() >= deadline.getTime() - 24 * 60 * 60 * 1000 &&
      new Date().getTime() < deadline.getTime(),
  };
}

function findOrderRow_(sheet, orderNo) {
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var orderNos = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getDisplayValues();
  for (var index = 0; index < orderNos.length; index++) {
    if (String(orderNos[index][0] || "").trim() === orderNo) return index + 2;
  }
  return 0;
}

function parseJsonArray_(value) {
  try {
    var parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function readPurchaseSummary_() {
  var sheet = spreadsheet_().getSheetByName("Preorders");
  var lastRow = sheet ? sheet.getLastRow() : 0;
  if (lastRow < 2) return { orderCount: 0, totalQty: 0, items: [] };
  var rows = sheet
    .getRange(2, 1, lastRow - 1, ORDER_HEADERS_.length)
    .getDisplayValues();
  var orderCount = 0;
  var totalQty = 0;
  var grouped = {};
  rows.forEach(function (row) {
    if (!String(row[0] || "").trim()) return;
    var status = normalizeOrderStatus_(row[15], row[17]);
    if (
      [
        ORDER_STATUS_DEPOSIT_RECEIVED_,
        ORDER_STATUS_SHIPPED_,
        ORDER_STATUS_COMPLETED_,
      ].indexOf(status) < 0
    )
      return;
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
        if (!grouped[key])
          grouped[key] = { name: name, variant: variant, qty: 0 };
        grouped[key].qty += number_(item.qty);
      });
    } catch (error) {
      console.warn("Invalid itemsJson in order " + String(row[0] || ""));
    }
  });
  var items = Object.keys(grouped).map(function (key) {
    return grouped[key];
  });
  items.sort(function (a, b) {
    return (
      b.qty - a.qty ||
      a.name.localeCompare(b.name) ||
      a.variant.localeCompare(b.variant)
    );
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
    var createdAt = rowNumber
      ? sheet.getRange(rowNumber, 10).getDisplayValue()
      : now;
    var row = [
      product.id,
      product.name,
      product.category,
      product.imageUrl,
      product.krwPrice || "",
      product.variants.join("\n"),
      product.description,
      product.active && product.stockQuantity > 0 ? "上架" : "下架",
      product.sortOrder,
      createdAt,
      now,
      product.priceTwd,
      product.stockQuantity,
      JSON.stringify(product.imageUrls),
    ];
    if (rowNumber)
      sheet.getRange(rowNumber, 1, 1, PRODUCT_HEADERS_.length).setValues([row]);
    else sheet.appendRow(row);
    invalidatePublicCatalogCache_();
    return json_({
      ok: true,
      product: rowToProduct_(row, readSettings_().exchangeRate),
    });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminToggleProduct_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var productId = String(data.productId || "").trim();
  if (!productId || typeof data.active !== "boolean")
    throw new Error("INVALID_PRODUCT");
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Products");
    var rowNumber = findProductRow_(sheet, productId);
    if (!rowNumber) throw new Error("PRODUCT_NOT_FOUND");
    var stockCell = sheet.getRange(rowNumber, 13).getValue();
    if (data.active && stockCell !== "" && number_(stockCell) <= 0)
      throw new Error("OUT_OF_STOCK");
    sheet.getRange(rowNumber, 8).setValue(data.active ? "上架" : "下架");
    sheet.getRange(rowNumber, 11).setValue(formatDateTime_(new Date()));
    var row = sheet
      .getRange(rowNumber, 1, 1, PRODUCT_HEADERS_.length)
      .getValues()[0];
    invalidatePublicCatalogCache_();
    return json_({
      ok: true,
      product: rowToProduct_(row, readSettings_().exchangeRate),
    });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminUpdateProductStock_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var productId = String(data.productId || "").trim();
  if (data.stockQuantity === "" || data.stockQuantity == null)
    throw new Error("INVALID_PRODUCT");
  var stockQuantity = Number(data.stockQuantity);
  if (
    !productId ||
    !Number.isInteger(stockQuantity) ||
    stockQuantity < 0 ||
    stockQuantity > 999999
  )
    throw new Error("INVALID_PRODUCT");
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Products");
    var rowNumber = findProductRow_(sheet, productId);
    if (!rowNumber) throw new Error("PRODUCT_NOT_FOUND");
    sheet.getRange(rowNumber, 13).setValue(stockQuantity);
    if (stockQuantity === 0)
      sheet.getRange(rowNumber, 8).setValue("下架");
    sheet.getRange(rowNumber, 11).setValue(formatDateTime_(new Date()));
    var row = sheet
      .getRange(rowNumber, 1, 1, PRODUCT_HEADERS_.length)
      .getValues()[0];
    invalidatePublicCatalogCache_();
    return json_({
      ok: true,
      product: rowToProduct_(row, readSettings_().exchangeRate),
    });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminUploadProductImage_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var mimeType = String(data.mimeType || "").trim();
  var base64Data = String(data.base64Data || "").trim();
  if (
    ["image/jpeg", "image/png", "image/webp"].indexOf(mimeType) === -1 ||
    !base64Data
  ) {
    throw new Error("INVALID_IMAGE");
  }
  if (base64Data.length > 7 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");
  var folder = getOrCreateImageFolder_();
  var safeName = sanitizeFileName_(data.fileName || "product.jpg");
  var blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    mimeType,
    safeName,
  );
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileId = file.getId();
  return json_({
    ok: true,
    fileId: fileId,
    imageUrl: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1600",
  });
}

function handleAdminSaveSettings_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var source = data.settings || {};
  var currentSettings = readSettings_();
  var settings = {
    exchangeRate:
      source.exchangeRate === undefined
        ? currentSettings.exchangeRate
        : Number(source.exchangeRate),
    fixedMarkupTwd:
      source.fixedMarkupTwd === undefined
        ? currentSettings.fixedMarkupTwd
        : Number(source.fixedMarkupTwd),
    depositPercent:
      source.depositPercent === undefined
        ? currentSettings.depositPercent
        : Number(source.depositPercent),
    paymentReminderHours:
      source.paymentReminderHours === undefined
        ? currentSettings.paymentReminderHours
        : Number(source.paymentReminderHours),
    paymentDeadlineHours:
      source.paymentDeadlineHours === undefined
        ? currentSettings.paymentDeadlineHours
        : Number(source.paymentDeadlineHours),
    paymentGraceHours:
      source.paymentGraceHours === undefined
        ? currentSettings.paymentGraceHours
        : Number(source.paymentGraceHours),
    iopenMallPaymentDays:
      source.iopenMallPaymentDays === undefined
        ? currentSettings.iopenMallPaymentDays
        : Number(source.iopenMallPaymentDays),
    preorderNotice:
      source.preorderNotice === undefined
        ? currentSettings.preorderNotice
        : cleanText_(source.preorderNotice, 300),
    saleClosed:
      source.saleClosed === undefined
        ? currentSettings.saleClosed
        : source.saleClosed === true,
    saleClosedNotice:
      source.saleClosedNotice === undefined
        ? currentSettings.saleClosedNotice
        : cleanText_(source.saleClosedNotice, 300) ||
          DEFAULT_SETTINGS_.saleClosedNotice,
    iopenMallUrl:
      source.iopenMallUrl === undefined
        ? currentSettings.iopenMallUrl
        : cleanText_(source.iopenMallUrl, 500),
  };
  if (
    !isFinite(settings.exchangeRate) ||
    settings.exchangeRate <= 0 ||
    settings.exchangeRate > 10 ||
    !Number.isInteger(settings.fixedMarkupTwd) ||
    settings.fixedMarkupTwd < 0 ||
    settings.fixedMarkupTwd > 1000000 ||
    !Number.isInteger(settings.depositPercent) ||
    settings.depositPercent < 1 ||
    settings.depositPercent > 100 ||
    !Number.isInteger(settings.paymentReminderHours) ||
    settings.paymentReminderHours < 1 ||
    !Number.isInteger(settings.paymentDeadlineHours) ||
    settings.paymentDeadlineHours <= settings.paymentReminderHours ||
    !Number.isInteger(settings.paymentGraceHours) ||
    settings.paymentGraceHours < 0 ||
    !Number.isInteger(settings.iopenMallPaymentDays) ||
    settings.iopenMallPaymentDays < 1 ||
    settings.iopenMallPaymentDays > 60
  )
    throw new Error("INVALID_SETTINGS");
  if (settings.iopenMallUrl && !/^https:\/\//i.test(settings.iopenMallUrl))
    throw new Error("INVALID_SETTINGS");

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupQuokkaPreorder();
    var sheet = spreadsheet_().getSheetByName("Settings");
    var rows = [
      ["exchangeRate", settings.exchangeRate, "韓幣換算率"],
      ["fixedMarkupTwd", settings.fixedMarkupTwd, "固定加價金額"],
      ["depositPercent", settings.depositPercent, "訂金比例"],
      [
        "paymentReminderHours",
        settings.paymentReminderHours,
        "訂金提醒起始時間",
      ],
      [
        "paymentDeadlineHours",
        settings.paymentDeadlineHours,
        "顧客付款期限",
      ],
      ["paymentGraceHours", settings.paymentGraceHours, "內部寬限時間"],
      [
        "iopenMallPaymentDays",
        settings.iopenMallPaymentDays,
        "iOPEN Mall 賣場付款期限",
      ],
      ["preorderNotice", settings.preorderNotice, "前台預購說明"],
      ["saleClosed", settings.saleClosed, "前台停賣"],
      ["saleClosedNotice", settings.saleClosedNotice, "停賣公告"],
      ["iopenMallUrl", settings.iopenMallUrl, "iOPEN Mall 網址"],
      [
        "bankTransferInfo",
        currentSettings.bankTransferInfo,
        "舊版訂金匯款資訊（停用）",
      ],
      ["bankName", currentSettings.bankName, "舊版銀行名稱（停用）"],
      ["bankCode", currentSettings.bankCode, "舊版銀行代碼（停用）"],
      ["bankAccount", currentSettings.bankAccount, "舊版匯款帳號（停用）"],
      [
        "bankAccountName",
        currentSettings.bankAccountName,
        "舊版匯款戶名（停用）",
      ],
      ["bankQrUrl", currentSettings.bankQrUrl, "舊版匯款 QR Code（停用）"],
    ];
    if (sheet.getLastRow() > 1)
      sheet
        .getRange(2, 1, sheet.getLastRow() - 1, SETTING_HEADERS_.length)
        .clearContent();
    sheet.getRange(2, 1, rows.length, SETTING_HEADERS_.length).setValues(rows);
    invalidatePublicCatalogCache_();
    return json_({ ok: true, settings: readSettings_() });
  } finally {
    lock.releaseLock();
  }
}

function handleAdminChangeAccessCode_(data) {
  requireAdmin_(data.idToken, data.adminSessionToken);
  var newAccessCode = String(data.newAccessCode || "").trim();
  if (newAccessCode.length < 6 || newAccessCode.length > 64)
    throw new Error("INVALID_ACCESS_CODE");
  var salt = Utilities.getUuid() + Utilities.getUuid();
  var properties = PropertiesService.getScriptProperties();
  properties.setProperties({
    ADMIN_ACCESS_CODE_HASH: hashAccessCode_(newAccessCode, salt),
    ADMIN_ACCESS_CODE_SALT: salt,
  });
  properties.deleteProperty("ADMIN_ACCESS_CODE");
  CacheService.getScriptCache().removeAll(["admin-session-" + data.adminSessionToken]);
  PropertiesService.getScriptProperties().setProperty(
    "ADMIN_SESSION_VERSION",
    Utilities.getUuid(),
  );
  return json_({ ok: true });
}

function hashAccessCode_(accessCode, salt) {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(salt) + ":" + String(accessCode),
    Utilities.Charset.UTF_8,
  );
  return digest
    .map(function (value) {
      var byteValue = value < 0 ? value + 256 : value;
      return ("0" + byteValue.toString(16)).slice(-2);
    })
    .join("");
}

function validatePreorderFields_(data) {
  if (!data || !Array.isArray(data.items) || !data.items.length)
    throw new Error("INVALID_ITEMS");
  if (
    !String(data.customerName || "").trim() ||
    !String(data.phone || "").trim()
  )
    throw new Error("INVALID_CUSTOMER");
}

function validateProduct_(source) {
  source = source || {};
  var imageUrls = Array.isArray(source.imageUrls) ? source.imageUrls : [];
  if (!imageUrls.length && source.imageUrl) imageUrls = [source.imageUrl];
  imageUrls = imageUrls
    .map(function (value) {
      return cleanText_(value, 500);
    })
    .filter(function (value, index, values) {
      return value && values.indexOf(value) === index;
    });
  if (imageUrls.length < 1 || imageUrls.length > 10)
    throw new Error("INVALID_PRODUCT");
  imageUrls.forEach(function (url) {
    if (!/^https:\/\//i.test(url)) throw new Error("INVALID_PRODUCT");
  });
  var variants = Array.isArray(source.variants) ? source.variants : [];
  variants = variants
    .map(function (value) {
      return cleanText_(value, 50);
    })
    .filter(Boolean);
  if (variants.length > 30) throw new Error("INVALID_PRODUCT");
  var product = {
    id: String(source.id || "").trim(),
    name: cleanText_(source.name, 100),
    category: cleanText_(source.category, 30),
    imageUrl: imageUrls[0],
    imageUrls: imageUrls,
    krwPrice: Number(source.krwPrice || 0),
    priceTwd: Number(source.priceTwd),
    variants: variants,
    description: cleanText_(source.description, 500),
    active: source.active === true,
    sortOrder: Number(source.sortOrder || 0),
    stockQuantity: Number(source.stockQuantity),
  };
  if (!product.name || !product.category || !product.imageUrl)
    throw new Error("INVALID_PRODUCT");
  if (
    !Number.isInteger(product.stockQuantity) ||
    product.stockQuantity < 0 ||
    product.stockQuantity > 999999
  )
    throw new Error("INVALID_PRODUCT");
  if (product.stockQuantity === 0) product.active = false;
  if (
    !Number.isInteger(product.krwPrice) ||
    product.krwPrice < 0 ||
    product.krwPrice > 1000000000
  )
    throw new Error("INVALID_PRODUCT");
  if (
    !Number.isInteger(product.priceTwd) ||
    product.priceTwd < 1 ||
    product.priceTwd > 100000000
  )
    throw new Error("INVALID_PRODUCT");
  if (
    !Number.isInteger(product.sortOrder) ||
    product.sortOrder < 0 ||
    product.sortOrder > 9999
  )
    throw new Error("INVALID_PRODUCT");
  return product;
}

function readProducts_(settings) {
  var sheet = spreadsheet_().getSheetByName("Products");
  if (!sheet || sheet.getLastRow() < 2) return [];
  var legacyExchangeRate = (settings || readSettings_()).exchangeRate;
  var rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, PRODUCT_HEADERS_.length)
    .getValues();
  return rows
    .filter(function (row) {
      return String(row[0] || "").trim();
    })
    .map(function (row) {
      return rowToProduct_(row, legacyExchangeRate);
    })
    .sort(function (a, b) {
      return (
        a.sortOrder - b.sortOrder ||
        String(b.updatedAt).localeCompare(String(a.updatedAt))
      );
    });
}

function rowToProduct_(row, legacyExchangeRate) {
  var priceTwd = number_(row[11]);
  if (!priceTwd)
    priceTwd = Math.round(
      number_(row[4]) *
        number_(legacyExchangeRate || DEFAULT_SETTINGS_.exchangeRate),
    );
  var imageUrls = [];
  try {
    imageUrls = JSON.parse(String(row[13] || "[]"));
    if (!Array.isArray(imageUrls)) imageUrls = [];
  } catch (error) {
    imageUrls = [];
  }
  imageUrls = imageUrls
    .map(function (value) {
      return String(value || "").trim();
    })
    .filter(function (value, index, values) {
      return value && values.indexOf(value) === index;
    })
    .slice(0, 10);
  var legacyImageUrl = String(row[3] || "").trim();
  if (legacyImageUrl && imageUrls.indexOf(legacyImageUrl) === -1)
    imageUrls.unshift(legacyImageUrl);
  imageUrls = imageUrls.slice(0, 10);
  var stockQuantity = row[12] === "" || row[12] == null ? null : number_(row[12]);
  var isActive = String(row[7] || "").trim() === "上架";
  if (stockQuantity === 0) isActive = false;
  return {
    id: String(row[0] || "").trim(),
    name: String(row[1] || "").trim(),
    category: String(row[2] || "").trim(),
    imageUrl: imageUrls[0] || legacyImageUrl,
    imageUrls: imageUrls,
    krwPrice: number_(row[4]),
    priceTwd: priceTwd,
    variants: String(row[5] || "")
      .split(/\n/)
      .map(function (value) {
        return value.trim();
      })
      .filter(Boolean),
    description: String(row[6] || "").trim(),
    active: isActive,
    stockQuantity: stockQuantity,
    sortOrder: number_(row[8]),
    createdAt: displayDate_(row[9]),
    updatedAt: displayDate_(row[10]),
  };
}

function readSettings_() {
  var settings = Object.assign({}, DEFAULT_SETTINGS_);
  var sheet = spreadsheet_().getSheetByName("Settings");
  if (!sheet || sheet.getLastRow() < 2) return settings;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  rows.forEach(function (row) {
    var key = String(row[0] || "").trim();
    if (key === "exchangeRate")
      settings.exchangeRate = number_(row[1]) || DEFAULT_SETTINGS_.exchangeRate;
    if (key === "fixedMarkupTwd")
      settings.fixedMarkupTwd = Math.max(0, number_(row[1]));
    if (key === "depositPercent")
      settings.depositPercent =
        number_(row[1]) || DEFAULT_SETTINGS_.depositPercent;
    if (key === "paymentReminderHours")
      settings.paymentReminderHours =
        number_(row[1]) || DEFAULT_SETTINGS_.paymentReminderHours;
    if (key === "paymentDeadlineHours")
      settings.paymentDeadlineHours =
        number_(row[1]) || DEFAULT_SETTINGS_.paymentDeadlineHours;
    if (key === "paymentGraceHours")
      settings.paymentGraceHours = Math.max(0, number_(row[1]));
    if (key === "iopenMallPaymentDays")
      settings.iopenMallPaymentDays =
        number_(row[1]) || DEFAULT_SETTINGS_.iopenMallPaymentDays;
    if (key === "preorderNotice")
      settings.preorderNotice = String(row[1] || "").trim();
    if (key === "saleClosed")
      settings.saleClosed = String(row[1] || "").toLowerCase() === "true";
    if (key === "saleClosedNotice")
      settings.saleClosedNotice =
        String(row[1] || "").trim() || DEFAULT_SETTINGS_.saleClosedNotice;
    if (key === "bankTransferInfo")
      settings.bankTransferInfo = String(row[1] || "").trim();
    if (key === "bankName") settings.bankName = String(row[1] || "").trim();
    if (key === "bankCode") settings.bankCode = String(row[1] || "").trim();
    if (key === "bankAccount")
      settings.bankAccount = String(row[1] || "").trim();
    if (key === "bankAccountName")
      settings.bankAccountName = String(row[1] || "").trim();
    if (key === "bankQrUrl") settings.bankQrUrl = String(row[1] || "").trim();
    if (key === "iopenMallUrl")
      settings.iopenMallUrl =
        String(row[1] || "").trim() || DEFAULT_SETTINGS_.iopenMallUrl;
  });
  if (
    settings.preorderNotice ===
    "商品下訂後才會採購。代購費為商品費用外加；若韓國現場缺貨，該商品代購費將全額退回。"
  ) {
    settings.preorderNotice = DEFAULT_SETTINGS_.preorderNotice;
  }
  if (
    settings.preorderNotice ===
    "商品下訂後才會採購。下單先付商品預估總額的 50% 訂金，回國後再支付剩餘商品款。"
  ) {
    settings.preorderNotice = DEFAULT_SETTINGS_.preorderNotice;
  }
  return settings;
}

function requireAdmin_(idToken, adminSessionToken) {
  var token = String(adminSessionToken || "").trim();
  var sessionVersion =
    PropertiesService.getScriptProperties().getProperty(
      "ADMIN_SESSION_VERSION",
    ) || "1";
  if (
    token &&
    CacheService.getScriptCache().get("admin-session-" + token) ===
      sessionVersion
  ) {
    return { sub: "access-code-admin", name: "Admin" };
  }
  var profile = verifyLineIdToken_(idToken);
  var rawIds =
    PropertiesService.getScriptProperties().getProperty(
      "ADMIN_LINE_USER_IDS",
    ) || "";
  var ids = rawIds
    .split(",")
    .map(function (value) {
      return value.trim();
    })
    .filter(Boolean);
  if (!ids.length) throw new Error("ADMIN_CONFIG_MISSING");
  if (ids.indexOf(profile.sub) === -1) throw new Error("ADMIN_FORBIDDEN");
  return profile;
}

function verifyLineIdToken_(idToken) {
  idToken = String(idToken || "").trim();
  if (!idToken) throw new Error("LINE_LOGIN_REQUIRED");
  var channelId =
    PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ID");
  if (!channelId) throw new Error("LINE_CONFIG_MISSING");
  var cache = CacheService.getScriptCache();
  var cacheKey = "line-" + sha256_(idToken).slice(0, 32);
  var cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);
  var response = UrlFetchApp.fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "post",
    payload: { id_token: idToken, client_id: channelId },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error("LINE_TOKEN_INVALID");
  var profile = JSON.parse(response.getContentText());
  if (!profile.sub || String(profile.aud) !== String(channelId))
    throw new Error("LINE_TOKEN_INVALID");
  cache.put(
    cacheKey,
    JSON.stringify({ sub: profile.sub, name: profile.name || "" }),
    300,
  );
  return { sub: profile.sub, name: profile.name || "" };
}

function spreadsheet_() {
  var id =
    PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error("SPREADSHEET_CONFIG_MISSING");
  return active;
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0)
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var actual = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  headers.forEach(function (header, index) {
    if (!actual[index]) sheet.getRange(1, index + 1).setValue(header);
    else if (actual[index] !== header)
      throw new Error(name.toUpperCase() + "_HEADER_MISMATCH");
  });
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureSettingsSheet_(ss) {
  var sheet = ensureSheet_(ss, "Settings", SETTING_HEADERS_);
  if (sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, 18, 3).setValues([
      ["exchangeRate", DEFAULT_SETTINGS_.exchangeRate, "韓幣換算率"],
      ["fixedMarkupTwd", DEFAULT_SETTINGS_.fixedMarkupTwd, "固定加價金額"],
      ["depositPercent", DEFAULT_SETTINGS_.depositPercent, "訂金比例"],
      [
        "paymentReminderHours",
        DEFAULT_SETTINGS_.paymentReminderHours,
        "訂金提醒起始時間",
      ],
      [
        "paymentDeadlineHours",
        DEFAULT_SETTINGS_.paymentDeadlineHours,
        "顧客付款期限",
      ],
      [
        "paymentGraceHours",
        DEFAULT_SETTINGS_.paymentGraceHours,
        "內部寬限時間",
      ],
      [
        "iopenMallPaymentDays",
        DEFAULT_SETTINGS_.iopenMallPaymentDays,
        "iOPEN Mall 賣場付款期限",
      ],
      ["preorderNotice", DEFAULT_SETTINGS_.preorderNotice, "前台預購說明"],
      ["saleClosed", DEFAULT_SETTINGS_.saleClosed, "前台停賣"],
      ["saleClosedNotice", DEFAULT_SETTINGS_.saleClosedNotice, "停賣公告"],
      ["bankTransferInfo", "", "訂金匯款資訊"],
      ["bankName", "", "銀行名稱"],
      ["bankCode", "", "銀行代碼"],
      ["bankAccount", "", "匯款帳號"],
      ["bankAccountName", "", "匯款戶名"],
      ["bankQrUrl", "", "匯款 QR Code"],
      ["iopenMallUrl", "", "iOPEN Mall 網址"],
    ]);
  }
  return sheet;
}

function findProductRow_(sheet, productId) {
  if (sheet.getLastRow() < 2) return 0;
  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (var index = 0; index < ids.length; index++)
    if (ids[index][0] === productId) return index + 2;
  return 0;
}

function getOrCreateImageFolder_() {
  var folders = DriveApp.getFoldersByName(PRODUCT_IMAGE_FOLDER_);
  return folders.hasNext()
    ? folders.next()
    : DriveApp.createFolder(PRODUCT_IMAGE_FOLDER_);
}

function sanitizeFileName_(value) {
  var name =
    String(value || "product.jpg")
      .replace(/[\\/:*?"<>|#%{}~&]/g, "-")
      .slice(0, 80) || "product.jpg";
  return (
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyyMMdd-HHmmss-",
    ) + name
  );
}

function createOrderNo_(date) {
  return (
    "QK" +
    Utilities.formatDate(date, Session.getScriptTimeZone(), "yyMMdd") +
    "-" +
    Utilities.getUuid().replace(/-/g, "").slice(0, 6).toUpperCase()
  );
}

function cleanText_(value, maxLength) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}
function number_(value) {
  var number = Number(String(value || 0).replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}
function formatDateTime_(date) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm:ss",
  );
}
function displayDate_(value) {
  return value instanceof Date
    ? formatDateTime_(value)
    : String(value || "").trim();
}
function sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value)
    .map(function (byte) {
      var v = byte < 0 ? byte + 256 : byte;
      return ("0" + v.toString(16)).slice(-2);
    })
    .join("");
}
function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
function safeError_(error) {
  var message = String((error && error.message) || error || "UNKNOWN_ERROR");
  var allowed = [
    "ADMIN_FORBIDDEN",
    "ADMIN_CONFIG_MISSING",
    "ADMIN_ACCESS_CODE_MISSING",
    "ADMIN_LOGIN_FAILED",
    "INVALID_ACCESS_CODE",
    "INVALID_EXPORT_TYPE",
    "LINE_LOGIN_REQUIRED",
    "LINE_CONFIG_MISSING",
    "LINE_TOKEN_INVALID",
    "INVALID_ITEMS",
    "INVALID_CUSTOMER",
    "INVALID_TRANSFER_LAST5",
    "ORDER_NOT_FOUND",
    "ORDER_FORBIDDEN",
    "INVALID_ORDER_STATUS",
    "INVALID_ORDER_ADJUSTMENT",
    "ORDER_EDIT_NOT_ALLOWED",
    "ORDER_CHANGED",
    "INVALID_LINE_ALERT_DECISION",
    "LINE_ALERT_ALREADY_RESOLVED",
    "ORDER_PAYMENT_OVERDUE",
    "ORDER_CANCEL_NOT_DUE",
    "NO_ORDER_CHANGES",
    "NO_ITEMS_TO_ADJUST",
    "INVALID_REMINDER",
    "REMINDER_NOT_DUE",
    "LINE_PUSH_FAILED",
    "INVALID_PRODUCT",
    "PRODUCT_CHANGED",
    "PRODUCT_NOT_FOUND",
    "INVALID_IMAGE",
    "IMAGE_TOO_LARGE",
    "INVALID_SETTINGS",
    "SPREADSHEET_CONFIG_MISSING",
    "SALE_CLOSED",
    "INVALID_TEST_MODE",
    "STRESS_TEST_DISABLED",
    "INVALID_TEST_REQUEST_ID",
    "INVALID_FORMAL_SIMULATION",
    "REAL_CUSTOMER_DATA_FORBIDDEN",
    "TEST_ORDER_ID_COLLISION",
    "INVALID_ORDER_REQUEST_ID",
    "ORDER_REQUEST_CONFLICT",
    "OUT_OF_STOCK",
    "LOCK_TIMEOUT",
    "ORDER_WRITE_FAILED",
    "INVALID_ORDER_ITEMS",
    "ORDER_CANCEL_WRITE_FAILED",
  ];
  return allowed.indexOf(message) >= 0 ? message : "SERVER_ERROR";
}
