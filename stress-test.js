"use strict";

const MAX_REQUESTS = 20;
const TEST_NOTE = "TEST MODE，不得通知、不得出貨；壓力測試資料，禁止出貨";
const TEST_ID_TOKEN = "TEST_MODE_NO_LINE_TOKEN";
const runtime = { running: false, stopRequested: false, records: [] };

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("stressForm").addEventListener("submit", (event) => {
    event.preventDefault();
    void runStressTest("normal");
  });
  document.getElementById("duplicateTest").addEventListener("click", () => void runStressTest("duplicate"));
  document.getElementById("formalSimulationTest").addEventListener("click", () => void runStressTest("formal"));
  document.getElementById("stopTest").addEventListener("click", requestStop);
  document.getElementById("requestCount").addEventListener("input", enforceRequestLimit);
});

function enforceRequestLimit(event) {
  const value = Number(event.target.value);
  if (value > MAX_REQUESTS) event.target.value = String(MAX_REQUESTS);
}

async function runStressTest(mode) {
  if (runtime.running) return setStatus("已有測試正在執行，禁止重複啟動。", true);
  const configuration = readConfiguration(mode);
  if (!configuration) return;
  const confirmation = mode === "formal"
    ? "本功能會模擬正式下單流程並測試最後一件庫存競爭，但只允許使用隔離測試部署。請確認目前不是正式網址。"
    : "本功能會向測試環境同時送出多筆訂單，請確認目前使用的是測試部署網址。";
  if (!window.confirm(confirmation)) return;

  runtime.running = true;
  runtime.stopRequested = false;
  runtime.records = [];
  setControlsRunning(true);
  resetOutput(configuration.totalRequests);

  try {
    setStatus("正在執行無副作用安全握手…");
    const formalSimulation = mode === "formal";
    const handshake = await postControl(configuration.url, {
      action: formalSimulation ? "formalSimulationHandshake" : "stressTestHandshake",
      testMode: true,
    });
    if (formalSimulation) validateFormalSimulationHandshake(handshake, configuration.totalRequests);
    else validateHandshake(handshake, configuration.totalRequests);

    setStatus("安全握手通過，正在讀取合法測試商品…");
    const product = await loadSafeProduct(configuration.url);
    const payloads = mode === "duplicate"
      ? buildDuplicatePayloads(product)
      : formalSimulation
        ? buildFormalSimulationPayloads(configuration.totalRequests, product)
        : buildPayloads(configuration.totalRequests, product);
    const sentRequestIds = [];

    for (let offset = 0; offset < payloads.length; offset += configuration.concurrency) {
      if (runtime.stopRequested) break;
      const batch = payloads.slice(offset, offset + configuration.concurrency);
      sentRequestIds.push(...batch.map((payload) => payload.testRequestId));
      setStatus(`正在同時送出第 ${offset + 1}～${offset + batch.length} 筆…`);

      const settled = await Promise.allSettled(
        batch.map((payload, batchIndex) => sendOrderRequest(
          configuration.url,
          payload,
          offset + batchIndex + 1,
        )),
      );
      settled.forEach((entry, batchIndex) => {
        const fallbackPayload = batch[batchIndex];
        const record = entry.status === "fulfilled"
          ? entry.value
          : rejectedRecord(fallbackPayload, offset + batchIndex + 1, entry.reason);
        runtime.records.push(record);
        if (record.safetyViolation) runtime.stopRequested = true;
      });
      renderRecords();
      updateProgress(runtime.records.length, payloads.length);

      if (runtime.records.some((record) => record.safetyViolation)) {
        setStatus("後端回傳未包含 testMode:true，已禁止送出後續批次。", true);
        break;
      }
    }

    const uniqueSentRequestIds = [...new Set(
      formalSimulation
        ? runtime.records.filter((record) => record.success).map((record) => record.testRequestId)
        : sentRequestIds,
    )];
    let verification = null;
    if (uniqueSentRequestIds.length) {
      setStatus("請求完成，正在核對測試表、正式訂單與商品庫存快照…");
      verification = await postControl(configuration.url, {
        action: formalSimulation ? "verifyFormalSimulationResults" : "verifyStressTestResults",
        testMode: true,
        testRequestIds: uniqueSentRequestIds,
        safetySnapshot: handshake.safetySnapshot,
      });
      if (verification.testMode !== true) throw new Error("TEST_MODE_CONFIRMATION_MISSING");
    }
    renderSummary({
      mode,
      requestedCount: payloads.length,
      expectedRows: mode === "duplicate" || formalSimulation ? 1 : payloads.length,
      verification,
      stopped: runtime.stopRequested,
    });
    if (!runtime.stopRequested) setStatus("測試與後端核對完成。請依驗收結果判定是否通過。");
  } catch (error) {
    console.error(error);
    setStatus(friendlyError(error), true);
    renderSummary({
      mode,
      requestedCount: configuration.totalRequests,
      expectedRows: mode === "duplicate" ? 1 : configuration.totalRequests,
      verification: null,
      stopped: true,
      fatalError: friendlyError(error),
    });
  } finally {
    runtime.running = false;
    setControlsRunning(false);
  }
}

function readConfiguration(mode) {
  let url;
  try {
    url = normalizeTestUrl(document.getElementById("gasUrl").value);
  } catch (error) {
    setStatus(friendlyError(error), true);
    return null;
  }
  const requested = Number(document.getElementById("requestCount").value);
  if (!Number.isInteger(requested) || requested < 1 || requested > MAX_REQUESTS) {
    setStatus("測試筆數必須是 1～20 的整數。", true);
    return null;
  }
  const concurrency = Number(document.getElementById("concurrency").value);
  if (![5, 10, 20].includes(concurrency)) {
    setStatus("併發數只允許 5、10 或 20。", true);
    return null;
  }
  return { url, concurrency: mode === "duplicate" ? 2 : concurrency, totalRequests: mode === "duplicate" ? 2 : requested };
}

function normalizeTestUrl(value) {
  const url = new URL(String(value || "").trim());
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error("TEST_URL_MUST_USE_HTTPS");
  url.hash = "";
  return url.toString();
}

async function postControl(url, payload) {
  const response = await fetch(withCacheBuster(url), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (error) {
    throw new Error(`INVALID_JSON_RESPONSE:${text.slice(0, 240)}`);
  }
  if (!response.ok || body.success === false || body.ok === false) throw new Error(body.error || `HTTP_${response.status}`);
  return body;
}

function validateHandshake(body, requestedCount) {
  const safeguards = body && body.safeguards;
  const safeFlags = safeguards && [
    "customerLineNotifications",
    "adminLineNotifications",
    "inventoryMutation",
    "formalOrderCreation",
    "formalOrderNumberCreation",
    "scheduledWorkflowEnrollment",
  ].every((key) => safeguards[key] === false);
  if (
    !body ||
    body.testMode !== true ||
    body.stressTestSupported !== true ||
    Number(body.maxRequests) < requestedCount ||
    body.isolatedSheet !== "壓力測試訂單" ||
    !safeFlags ||
    !body.safetySnapshot
  ) throw new Error("UNSAFE_OR_UNSUPPORTED_BACKEND");
}

function validateFormalSimulationHandshake(body, requestedCount) {
  const safeguards = body && body.safeguards;
  const coverage = body && body.formalFlowCoverage;
  const risks = body && body.observedFormalRisks;
  const safeFlags = safeguards && [
    "customerLineNotifications",
    "adminLineNotifications",
    "inventoryMutation",
    "formalOrderCreation",
    "scheduledWorkflowEnrollment",
  ].every((key) => safeguards[key] === false);
  if (
    !body ||
    body.testMode !== true ||
    body.formalSimulationMode !== true ||
    body.formalSimulationSupported !== true ||
    Number(body.maxRequests) < requestedCount ||
    body.isolatedSheet !== "正式流程模擬訂單" ||
    !safeFlags ||
    !coverage ||
    Number(coverage.scriptLockWaitMs) !== 30000 ||
    coverage.formalOrderNumberGenerator !== "createOrderNo_" ||
    coverage.linePush !== false ||
    coverage.formalPreordersWrite !== false ||
    !risks ||
    typeof risks.inventoryDeductionImplemented !== "boolean" ||
    typeof risks.requestIdempotencyImplemented !== "boolean" ||
    !body.safetySnapshot
  ) throw new Error("UNSAFE_OR_UNSUPPORTED_FORMAL_SIMULATION");
}

async function loadSafeProduct(url) {
  const catalogUrl = new URL(url);
  catalogUrl.searchParams.set("action", "readPublicCatalog");
  catalogUrl.searchParams.set("t", String(Date.now()));
  const response = await fetch(catalogUrl);
  const body = await response.json();
  if (!response.ok || !body.ok || !Array.isArray(body.products)) throw new Error(body.error || "CATALOG_LOAD_FAILED");
  const product = body.products.find((entry) => entry && entry.active === true && Number(entry.priceTwd) > 0);
  if (!product) throw new Error("NO_ACTIVE_TEST_PRODUCT");
  const variants = Array.isArray(product.variants) ? product.variants : [];
  return { productId: String(product.id), variant: String(variants[0] || ""), qty: 1 };
}

function buildPayloads(count, product) {
  const stamp = requestTimestamp(new Date());
  const random = randomCode(4);
  return Array.from({ length: count }, (_, index) => buildPayload(index + 1, stamp, random, product));
}

function buildDuplicatePayloads(product) {
  const payload = buildPayload(1, requestTimestamp(new Date()), randomCode(4), product);
  return [{ ...payload, items: payload.items.map((item) => ({ ...item })) }, { ...payload, items: payload.items.map((item) => ({ ...item })) }];
}

function buildFormalSimulationPayloads(count, product) {
  const stamp = requestTimestamp(new Date());
  const random = randomCode(4);
  const simulationRunId = `SIMRUN-${stamp}-${random}`;
  return Array.from({ length: count }, (_, index) => ({
    ...buildPayload(index + 1, stamp, random, product),
    formalSimulationMode: true,
    simulationRunId,
    simulatedStockLimit: 1,
  }));
}

function buildPayload(sequence, stamp, random, product) {
  const number = String(sequence).padStart(3, "0");
  return {
    action: "createPreorder",
    idToken: TEST_ID_TOKEN,
    lineDisplayName: `壓測測試${number}`,
    customerName: `壓測測試${number}`,
    phone: `090000${String(sequence).padStart(4, "0")}`,
    note: TEST_NOTE,
    items: [{ productId: product.productId, variant: product.variant, qty: product.qty }],
    testMode: true,
    testRequestId: `LOAD-${stamp}-${random}-${number}`,
  };
}

async function sendOrderRequest(url, payload, testNumber) {
  const startedAt = new Date();
  const startedMs = performance.now();
  let httpStatus = 0;
  let responseBody = null;
  let rawResponse = "";
  let errorMessage = "";
  try {
    const response = await fetch(withCacheBuster(url), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    httpStatus = response.status;
    rawResponse = await response.text();
    try {
      responseBody = JSON.parse(rawResponse);
    } catch (error) {
      errorMessage = "後端回傳不是合法 JSON";
    }
    if (!response.ok) errorMessage = errorMessage || `HTTP ${response.status}`;
    if (responseBody && (responseBody.success === false || responseBody.ok === false)) errorMessage = responseBody.error || "後端回傳 success:false";
  } catch (error) {
    errorMessage = error && error.message ? error.message : "NETWORK_ERROR";
  }
  const endedAt = new Date();
  const durationSeconds = Math.max(0, (performance.now() - startedMs) / 1000);
  const testModeConfirmed = responseBody && responseBody.testMode === true;
  const backendSucceeded = responseBody && (responseBody.success === true || responseBody.ok === true);
  return {
    testNumber,
    testRequestId: payload.testRequestId,
    httpStatus,
    success: Boolean(httpStatus >= 200 && httpStatus < 300 && testModeConfirmed && backendSucceeded),
    duplicate: Boolean(responseBody && responseBody.duplicate === true),
    backendSuccessFalse: Boolean(responseBody && (responseBody.success === false || responseBody.ok === false)),
    responseBody,
    rawResponse: rawResponse || (responseBody ? JSON.stringify(responseBody) : ""),
    startedAt,
    endedAt,
    durationSeconds,
    errorMessage: errorMessage || (!testModeConfirmed ? "後端未確認 testMode:true" : ""),
    safetyViolation: !testModeConfirmed,
  };
}

function rejectedRecord(payload, testNumber, reason) {
  const now = new Date();
  return {
    testNumber,
    testRequestId: payload.testRequestId,
    httpStatus: 0,
    success: false,
    duplicate: false,
    backendSuccessFalse: false,
    responseBody: null,
    rawResponse: "",
    startedAt: now,
    endedAt: now,
    durationSeconds: 0,
    errorMessage: reason && reason.message ? reason.message : "PROMISE_REJECTED",
    safetyViolation: true,
  };
}

function renderRecords() {
  const tbody = document.getElementById("resultRows");
  tbody.replaceChildren();
  runtime.records.slice().sort((a, b) => a.testNumber - b.testNumber).forEach((record) => {
    const row = document.createElement("tr");
    appendCell(row, String(record.testNumber));
    appendCell(row, record.testRequestId);
    appendCell(row, record.httpStatus || "網路錯誤");
    appendCell(row, record.success ? (record.duplicate ? "成功／重複攔截" : "成功") : "失敗", record.success ? "ok" : "failed");
    appendCell(row, prettyResponse(record), "response-cell");
    appendCell(row, formatTime(record.startedAt));
    appendCell(row, formatTime(record.endedAt));
    appendCell(row, record.durationSeconds.toFixed(3));
    appendCell(row, record.errorMessage || "—");
    tbody.appendChild(row);
  });
  document.getElementById("detailsPanel").hidden = false;
}

function appendCell(row, value, className = "") {
  const cell = document.createElement("td");
  cell.textContent = String(value ?? "");
  if (className) cell.className = className;
  row.appendChild(cell);
}

function prettyResponse(record) {
  if (record.responseBody) return JSON.stringify(record.responseBody, null, 2);
  return String(record.rawResponse || "—").slice(0, 4000);
}

function renderSummary(context) {
  const records = runtime.records;
  const durations = records.map((record) => record.durationSeconds);
  const successCount = records.filter((record) => record.success).length;
  const duplicateCount = records.filter((record) => record.duplicate).length;
  const httpErrorCount = records.filter((record) => record.httpStatus && (record.httpStatus < 200 || record.httpStatus >= 300)).length;
  const backendFailureCount = records.filter((record) => record.backendSuccessFalse).length;
  setText("totalRequests", records.length);
  setText("successCount", successCount);
  setText("failureCount", records.length - successCount);
  setText("duplicateCount", duplicateCount);
  setText("fastestTime", durations.length ? `${Math.min(...durations).toFixed(3)} 秒` : "—");
  setText("slowestTime", durations.length ? `${Math.max(...durations).toFixed(3)} 秒` : "—");
  setText("averageTime", durations.length ? `${(durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(3)} 秒` : "—");
  setText("httpErrorCount", httpErrorCount);
  setText("backendFailureCount", backendFailureCount);

  const verification = context.verification;
  const formalSimulation = context.mode === "formal";
  const isolatedRowCount = verification
    ? Number(formalSimulation ? verification.simulationSheetRowCount : verification.testSheetRowCount)
    : 0;
  const duplicateOrderIds = verification
    ? (formalSimulation ? verification.duplicateFormalOrderNoCandidates : verification.duplicateTestOrderIds)
    : [];
  const checks = [
    check("已發出指定數量的請求", records.length === context.requestedCount, `${records.length}/${context.requestedCount}`),
    check("每筆 HTTP 請求均有明確成功或失敗結果", records.length === context.requestedCount && records.every((record) => record.success || record.errorMessage), "不得靜默漏單"),
    check("後端皆確認 testMode:true", records.length > 0 && records.every((record) => !record.safetyViolation), "缺少確認時立即停止"),
    check(formalSimulation ? "正式流程模擬工作表新增筆數正確" : "壓力測試訂單工作表新增筆數正確", Boolean(verification) && isolatedRowCount === context.expectedRows, verification ? `${isolatedRowCount}/${context.expectedRows}` : "未完成後端核對"),
    check("無漏單", Boolean(verification) && Array.isArray(verification.missingRequestIds) && verification.missingRequestIds.length === 0, verification && verification.missingRequestIds ? verification.missingRequestIds.join(", ") || "0 筆" : "未核對"),
    check("無重複 testRequestId 資料列", Boolean(verification) && verification.duplicateRequestIds.length === 0, verification ? verification.duplicateRequestIds.join(", ") || "0 筆" : "未核對"),
    check(formalSimulation ? "無重複正式編號候選值" : "無重複測試訂單編號", Boolean(verification) && Array.isArray(duplicateOrderIds) && duplicateOrderIds.length === 0, verification ? duplicateOrderIds.join(", ") || "0 筆" : "未核對"),
    check("每筆測試資料欄位完整", Boolean(verification) && verification.fieldsComplete === true, verification && verification.incompleteRequestIds ? verification.incompleteRequestIds.join(", ") || "完整" : "未核對"),
    check("無正式 LINE 通知", Boolean(verification) && Number(verification.notificationsSent) === 0, verification ? `${verification.notificationsSent} 次` : "未核對"),
    check("正式庫存／商品資料無異動", Boolean(verification) && verification.productsUnchanged === true && Number(verification.inventoryMutations) === 0, verification ? `快照 ${verification.productsUnchanged}／測試列異動 ${verification.inventoryMutations}` : "未核對"),
    check("正式訂單資料無異動", Boolean(verification) && verification.formalPreordersUnchanged === true && Number(verification.formalOrdersCreated) === 0, verification ? `快照 ${verification.formalPreordersUnchanged}／正式建立 ${verification.formalOrdersCreated}` : "未核對"),
  ];
  if (context.mode === "duplicate") {
    checks.splice(3, 0, check("兩筆相同請求一筆建立、一筆被冪等攔截", successCount === 2 && duplicateCount === 1, `成功 ${successCount}／重複 ${duplicateCount}`));
  } else if (formalSimulation) {
    const outOfStockCount = records.filter((record) => record.responseBody && record.responseBody.error === "OUT_OF_STOCK").length;
    checks.splice(3, 0, check("最後一件庫存只建立一筆，其餘明確拒絕", successCount === 1 && outOfStockCount === Math.max(0, context.requestedCount - 1), `建立 ${successCount}／庫存不足 ${outOfStockCount}`));
  } else {
    checks.splice(3, 0, check("後端成功數符合測試筆數", successCount === context.requestedCount, `${successCount}/${context.requestedCount}`));
  }
  if (formalSimulation) {
    checks.push(
      check("正式流程模擬的併發寫入完整", Boolean(verification) && verification.concurrencyWritePassed === true, verification ? `${isolatedRowCount}/${context.expectedRows}` : "未核對"),
      check("正式流程具備庫存扣減且未偵測到超賣", Boolean(verification) && verification.formalInventoryDeductionImplemented === true && verification.inventorySafetyPassed === true && Number(verification.oversellRiskCount) === 0, verification ? `庫存扣減 ${verification.formalInventoryDeductionImplemented}／超賣風險 ${verification.oversellRiskCount} 筆` : "未核對"),
      check("正式流程具備請求冪等鍵", Boolean(verification) && verification.formalRequestIdempotencyImplemented === true, verification ? `冪等機制 ${verification.formalRequestIdempotencyImplemented}` : "未核對"),
    );
  }
  if (context.fatalError) checks.unshift(check("測試流程沒有發生致命錯誤", false, context.fatalError));

  const list = document.getElementById("acceptanceList");
  list.replaceChildren();
  checks.forEach((entry) => {
    const item = document.createElement("li");
    item.className = entry.pass ? "pass" : "fail";
    item.textContent = `${entry.pass ? "通過" : "失敗"}：${entry.label}（${entry.detail}）`;
    list.appendChild(item);
  });
  const passed = checks.every((entry) => entry.pass) && !context.stopped;
  const badge = document.getElementById("resultBadge");
  badge.textContent = passed ? "驗收通過" : "驗收失敗";
  badge.className = `result-badge ${passed ? "pass" : "fail"}`;
  document.getElementById("summaryPanel").hidden = false;
}

function check(label, pass, detail) { return { label, pass: Boolean(pass), detail: String(detail) }; }
function setText(id, value) { document.getElementById(id).textContent = String(value); }

function requestStop() {
  if (!runtime.running) return;
  runtime.stopRequested = true;
  setStatus("已要求停止；目前已送出的請求會完成，但不再開始後續批次。", true);
}

function resetOutput(total) {
  document.getElementById("summaryPanel").hidden = true;
  document.getElementById("detailsPanel").hidden = true;
  document.getElementById("resultRows").replaceChildren();
  updateProgress(0, total);
}

function updateProgress(completed, total) {
  const bar = document.getElementById("progressBar");
  bar.max = Math.max(1, total);
  bar.value = completed;
  setText("progressText", `${completed} / ${total}`);
}

function setControlsRunning(running) {
  document.getElementById("startTest").disabled = running;
  document.getElementById("duplicateTest").disabled = running;
  document.getElementById("formalSimulationTest").disabled = running;
  document.getElementById("stopTest").disabled = !running;
  document.getElementById("gasUrl").disabled = running;
  document.getElementById("requestCount").disabled = running;
  document.getElementById("concurrency").disabled = running;
}

function setStatus(message, warning = false) {
  const element = document.getElementById("statusMessage");
  element.textContent = message;
  element.classList.toggle("warning", warning);
}

function withCacheBuster(url) {
  const next = new URL(url);
  next.searchParams.set("t", String(Date.now()));
  return next.toString();
}

function requestTimestamp(date) {
  return [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate())].join("") + "-" + [pad2(date.getHours()), pad2(date.getMinutes()), pad2(date.getSeconds())].join("");
}

function randomCode(length) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function pad2(value) { return String(value).padStart(2, "0"); }
function formatTime(date) { return date.toLocaleString("zh-TW", { hour12: false }); }

function friendlyError(error) {
  const message = String((error && error.message) || error || "UNKNOWN_ERROR");
  const map = {
    STRESS_TEST_DISABLED: "後端尚未啟用 ENABLE_STRESS_TEST_MODE，已禁止測試。",
    INVALID_TEST_MODE: "後端未接受 testMode:true，已禁止測試。",
    UNSAFE_OR_UNSUPPORTED_BACKEND: "後端安全握手不完整，可能不是隔離測試部署，已禁止送單。",
    UNSAFE_OR_UNSUPPORTED_FORMAL_SIMULATION: "後端正式流程模擬安全握手不完整，已禁止送單。",
    TEST_MODE_CONFIRMATION_MISSING: "後端核對結果未包含 testMode:true，已停止。",
    TEST_URL_MUST_USE_HTTPS: "測試網址必須使用 HTTPS；只有 localhost 可使用 HTTP。",
    CATALOG_LOAD_FAILED: "無法讀取測試部署商品目錄。",
    NO_ACTIVE_TEST_PRODUCT: "測試部署沒有可建立合法測試資料的上架商品。",
    REAL_CUSTOMER_DATA_FORBIDDEN: "測試資料不符合假資料規則，已拒絕送出。",
    INVALID_FORMAL_SIMULATION: "正式流程模擬資料格式不正確，已拒絕送出。",
  };
  if (map[message]) return map[message];
  if (message.startsWith("INVALID_JSON_RESPONSE")) return "後端未回傳合法 JSON，可能不是正確的 GAS 測試部署。";
  if (message === "Failed to construct 'URL': Invalid URL" || message.includes("Invalid URL")) return "請輸入完整的 GAS 測試 Web App URL。";
  return `測試失敗：${message}`;
}
