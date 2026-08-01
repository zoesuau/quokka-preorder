#!/usr/bin/env node
"use strict";

const https = require("https");
const { performance } = require("perf_hooks");

const url = String(process.argv[2] || "").trim();
const counts = process.argv.slice(3).map(Number);
const productId = String(process.env.FORMAL_SIM_PRODUCT_ID || "").trim();
const variant = String(process.env.FORMAL_SIM_VARIANT || "").trim();
const duplicateOnly = process.env.FORMAL_SIM_DUPLICATE_ONLY === "true";

if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
  throw new Error("請提供 GAS 測試部署網址");
}
if (!productId) throw new Error("缺少 FORMAL_SIM_PRODUCT_ID");
if ((!duplicateOnly && !counts.length) || counts.some((count) => !Number.isInteger(count) || count < 1 || count > 20)) {
  throw new Error("測試筆數只能是 1 到 20");
}

function request(target, options, redirectCount) {
  const redirects = redirectCount || 0;
  return new Promise((resolve, reject) => {
    const body = options.body ? JSON.stringify(options.body) : "";
    const requestOptions = {
      method: options.method || "GET",
      headers: body
        ? {
            "Content-Type": "text/plain;charset=UTF-8",
            "Content-Length": Buffer.byteLength(body),
          }
        : {},
    };
    const req = https.request(target, requestOptions, (res) => {
      const location = res.headers.location;
      if (location && [301, 302, 303, 307, 308].includes(res.statusCode) && redirects < 8) {
        res.resume();
        const preservePost = res.statusCode === 307 || res.statusCode === 308;
        resolve(request(location, preservePost ? options : { method: "GET" }, redirects + 1));
        return;
      }
      let raw = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (_) {}
        resolve({ status: res.statusCode, json, raw });
      });
    });
    req.setTimeout(90000, () => req.destroy(new Error("REQUEST_TIMEOUT")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function stamp(date) {
  const part = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}-${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}`;
}

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, "X");
}

async function post(body) {
  return request(url, { method: "POST", body });
}

async function runSuite(count, stockLimit) {
  const handshake = await post({ action: "formalSimulationHandshake", testMode: true });
  if (
    handshake.status !== 200 ||
    !handshake.json ||
    handshake.json.testMode !== true ||
    handshake.json.formalSimulationMode !== true
  ) {
    throw new Error(`安全握手失敗：${handshake.raw.slice(0, 500)}`);
  }

  const now = new Date();
  const timeStamp = stamp(now);
  const random = randomCode();
  const simulationRunId = `SIMRUN-${timeStamp}-${random}`;
  const payloads = Array.from({ length: count }, (_, index) => {
    const sequence = String(index + 1).padStart(3, "0");
    return {
      action: "createPreorder",
      idToken: "TEST_MODE_NO_LINE_TOKEN",
      lineDisplayName: `壓測測試${sequence}`,
      customerName: `壓測測試${sequence}`,
      phone: `090000${String(index + 1).padStart(4, "0")}`,
      note: "TEST MODE，不得通知、不得出貨",
      items: [{ productId, variant, qty: 1 }],
      testMode: true,
      formalSimulationMode: true,
      testRequestId: `LOAD-${timeStamp}-${random}-${sequence}`,
      simulationRunId,
      simulatedStockLimit: stockLimit,
    };
  });

  const started = performance.now();
  const settled = await Promise.allSettled(payloads.map(async (payload) => {
    const requestStarted = performance.now();
    const response = await post(payload);
    return {
      testRequestId: payload.testRequestId,
      status: response.status,
      durationSeconds: Number(((performance.now() - requestStarted) / 1000).toFixed(3)),
      body: response.json,
      raw: response.raw,
    };
  }));
  const elapsedSeconds = Number(((performance.now() - started) / 1000).toFixed(3));
  const results = settled.map((entry, index) => entry.status === "fulfilled"
    ? entry.value
    : {
        testRequestId: payloads[index].testRequestId,
        status: 0,
        durationSeconds: null,
        body: null,
        error: String(entry.reason && entry.reason.message || entry.reason),
      });
  const successfulRequestIds = results
    .filter((result) => result.status === 200 && result.body && result.body.success === true)
    .map((result) => result.testRequestId);
  const verificationResponse = successfulRequestIds.length ? await post({
    action: "verifyFormalSimulationResults",
    testMode: true,
    testRequestIds: successfulRequestIds,
    safetySnapshot: handshake.json.safetySnapshot,
  }) : { json: null };
  const verification = verificationResponse.json;
  const durations = results.map((result) => result.durationSeconds).filter(Number.isFinite);
  return {
    requested: count,
    simulatedStockLimit: stockLimit,
    success: results.filter((result) => result.status === 200 && result.body && result.body.success === true && result.body.testMode === true).length,
    failed: results.filter((result) => !(result.status === 200 && result.body && result.body.success === true && result.body.testMode === true)).length,
    elapsedSeconds,
    fastestSeconds: durations.length ? Math.min(...durations) : null,
    slowestSeconds: durations.length ? Math.max(...durations) : null,
    averageSeconds: durations.length ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(3)) : null,
    errors: results.filter((result) => result.status !== 200 || !result.body || result.body.success !== true).map((result) => ({
      testRequestId: result.testRequestId,
      status: result.status,
      error: result.error || (result.body && result.body.error) || result.raw,
    })),
    outOfStockRejected: results.filter((result) => result.body && result.body.error === "OUT_OF_STOCK").length,
    verification,
  };
}

async function runDuplicateSuite() {
  const handshake = await post({ action: "formalSimulationHandshake", testMode: true });
  if (!handshake.json || handshake.json.testMode !== true || handshake.json.formalSimulationMode !== true) {
    throw new Error(`安全握手失敗：${handshake.raw.slice(0, 500)}`);
  }
  const timeStamp = stamp(new Date());
  const random = randomCode();
  const requestId = `LOAD-${timeStamp}-${random}-001`;
  const payload = {
    action: "createPreorder",
    idToken: "TEST_MODE_NO_LINE_TOKEN",
    lineDisplayName: "壓測測試001",
    customerName: "壓測測試001",
    phone: "0900000001",
    note: "TEST MODE，不得通知、不得出貨",
    items: [{ productId, variant, qty: 1 }],
    testMode: true,
    formalSimulationMode: true,
    testRequestId: requestId,
    simulationRunId: `SIMRUN-${timeStamp}-${random}`,
    simulatedStockLimit: 1,
  };
  const settled = await Promise.allSettled([post(payload), post(payload)]);
  const responses = settled.map((entry) => entry.status === "fulfilled" ? entry.value : null);
  const verificationResponse = await post({
    action: "verifyFormalSimulationResults",
    testMode: true,
    testRequestIds: [requestId],
    safetySnapshot: handshake.json.safetySnapshot,
  });
  return {
    requestId,
    successResponses: responses.filter((response) => response && response.json && response.json.success === true).length,
    duplicateResponses: responses.filter((response) => response && response.json && response.json.duplicate === true).length,
    orderIds: responses.filter(Boolean).map((response) => response.json && response.json.simulationOrderId).filter(Boolean),
    rawResponses: responses.map((response) => response && response.json),
    verification: verificationResponse.json,
  };
}

(async () => {
  if (duplicateOnly) {
    process.stdout.write(`${JSON.stringify({ url, productId, variant, duplicate: await runDuplicateSuite() }, null, 2)}\n`);
    return;
  }
  const suites = [];
  for (const count of counts) suites.push(await runSuite(count, count));
  const stockRace = await runSuite(Math.max(...counts), 1);
  process.stdout.write(`${JSON.stringify({ url, productId, variant, suites, stockRace }, null, 2)}\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
