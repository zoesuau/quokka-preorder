const CONFIG = window.QUOKKA_CONFIG || {};
const IOPEN_MALL_READY_STATUS = "已開設 iOPEN Mall 賣場";
const PAYMENT_REPORTED_STATUS = "待確認訂金";
const ORDER_COMPLETED_STATUS = "訂單已完成";
const adminState = { products: [], orders: [], settings: {}, purchaseSummary: { orderCount: 0, totalQty: 0, items: [] }, idToken: "", sessionToken: "", uploadBusy: false, bankUploadBusy: false };
const demoPlaceholder = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#eee6df"/><text x="200" y="210" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#9b8b7e">NO IMAGE</text></svg>`)}`;

document.addEventListener("DOMContentLoaded", initAdmin);

async function initAdmin() {
  bindAdminEvents();
  switchAdminPage(location.hash === "#products" ? "products" : "orders");
  const savedSession = sessionStorage.getItem("quokkaAdminSession") || "";
  if (savedSession) {
    adminState.sessionToken = savedSession;
    try {
      await enterAdminWorkspace();
      return;
    } catch (error) {
      sessionStorage.removeItem("quokkaAdminSession");
      adminState.sessionToken = "";
    }
  }
  if (!CONFIG.adminLiffId) {
    showAdminLogin();
    return;
  }
  try {
    await initAdminLine();
    await enterAdminWorkspace();
  } catch (error) {
    if (!["LIFF_NOT_CONFIGURED", "API_NOT_CONFIGURED", "LINE_LOGIN_REDIRECT"].includes(error.message)) console.error(error);
    showAdminLogin(friendlyAdminError(error.message));
  }
}

function bindAdminEvents() {
  document.getElementById("adminLoginForm").addEventListener("submit", loginWithAccessCode);
  document.getElementById("adminAccessCodeToggle").addEventListener("click", toggleAdminAccessCodeVisibility);
  document.getElementById("newProduct").addEventListener("click", () => openEditor());
  document.getElementById("refreshProducts").addEventListener("click", loadAdminProducts);
  document.getElementById("productSearch").addEventListener("input", renderAdminProducts);
  document.getElementById("statusFilter").addEventListener("change", renderAdminProducts);
  document.getElementById("productTwdPrice").addEventListener("input", updateAdminPricePreview);
  document.getElementById("productImageInput").addEventListener("change", uploadSelectedImage);
  document.getElementById("productForm").addEventListener("submit", saveProduct);
  document.getElementById("settingsForm").addEventListener("submit", saveSettings);
  document.getElementById("adminProductList").addEventListener("click", handleProductAction);
  document.getElementById("adminOrderList").addEventListener("click", handleOrderAction);
  document.getElementById("adminOrderList").addEventListener("change", handleOrderStatusChange);
  document.getElementById("orderEditorForm").addEventListener("submit", submitOrderAdjustment);
  document.getElementById("orderEditorReason").addEventListener("change", resetOrderEditorForReason);
  document.getElementById("orderEditorItems").addEventListener("input", updateOrderEditorPreview);
  document.getElementById("orderEditorItems").addEventListener("change", handleOrderEditorItemChange);
  document.getElementById("orderEditorItems").addEventListener("click", handleOrderEditorItemClick);
  document.getElementById("orderEditorAdd").addEventListener("click", () => addOrderEditorRow());
  document.getElementById("orderEditorClose").addEventListener("click", () => document.getElementById("orderEditorDialog").close());
  document.getElementById("orderSearch").addEventListener("input", renderAdminOrders);
  document.getElementById("orderStatusFilter").addEventListener("change", renderAdminOrders);
  document.getElementById("bankQrInput").addEventListener("change", uploadBankQr);
  document.querySelector(".admin-page-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-page]");
    if (button) switchAdminPage(button.dataset.adminPage);
  });
}

function toggleAdminAccessCodeVisibility() {
  const input = document.getElementById("adminAccessCode");
  const button = document.getElementById("adminAccessCodeToggle");
  const shouldShow = input.type === "password";
  input.type = shouldShow ? "text" : "password";
  button.setAttribute("aria-pressed", String(shouldShow));
  button.setAttribute("aria-label", shouldShow ? "隱藏管理登入碼" : "顯示管理登入碼");
  input.focus({ preventScroll: true });
  input.setSelectionRange(input.value.length, input.value.length);
}

function switchAdminPage(page) {
  const selected = page === "products" ? "products" : "orders";
  document.getElementById("adminOrdersPage").hidden = selected !== "orders";
  document.getElementById("adminProductsPage").hidden = selected !== "products";
  document.querySelectorAll("[data-admin-page]").forEach((button) => button.classList.toggle("active", button.dataset.adminPage === selected));
  document.getElementById("adminPageTitle").textContent = selected === "orders" ? "訂單管理" : "商品管理";
  history.replaceState(null, "", `#${selected}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showAdminLogin(message = "") {
  document.getElementById("adminLoginCard").hidden = false;
  document.getElementById("adminWorkspace").hidden = true;
  document.getElementById("adminLoginFeedback").textContent = message;
}

async function enterAdminWorkspace() {
  document.getElementById("adminLoginCard").hidden = true;
  document.getElementById("adminWorkspace").hidden = false;
  await loadAdminProducts();
}

async function loginWithAccessCode(event) {
  event.preventDefault();
  if (!CONFIG.apiUrl) return showAdminLogin("尚未設定 GAS API。");
  const button = document.getElementById("adminLoginButton");
  const feedback = document.getElementById("adminLoginFeedback");
  button.disabled = true;
  button.textContent = "登入中…";
  feedback.textContent = "";
  try {
    const response = await fetch(`${CONFIG.apiUrl}?t=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "adminLogin", accessCode: document.getElementById("adminAccessCode").value.trim() }),
    });
    const result = await response.json();
    if (!result.ok || !result.adminSessionToken) throw new Error(result.error || "ADMIN_LOGIN_FAILED");
    adminState.sessionToken = result.adminSessionToken;
    sessionStorage.setItem("quokkaAdminSession", result.adminSessionToken);
    document.getElementById("adminLoginForm").reset();
    await enterAdminWorkspace();
  } catch (error) {
    const messages = {
      ADMIN_LOGIN_FAILED: "登入碼不正確，請重新輸入。",
      ADMIN_ACCESS_CODE_MISSING: "後端尚未設定管理登入碼。",
      UNSUPPORTED_ACTION: "後端版本尚未更新，請稍後再試。",
      SERVER_ERROR: "後端暫時無法登入，請稍後再試。",
    };
    feedback.textContent = messages[error.message] || `登入失敗（${error.message}）`;
  } finally {
    button.disabled = false;
    button.textContent = "登入後台";
  }
}

async function initAdminLine() {
  const adminLiffId = CONFIG.adminLiffId;
  if (!adminLiffId) throw new Error("LIFF_NOT_CONFIGURED");
  await liff.init({ liffId: adminLiffId });
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href });
    throw new Error("LINE_LOGIN_REDIRECT");
  }
  adminState.idToken = liff.getIDToken() || "";
  if (!adminState.idToken) throw new Error("LINE_LOGIN_REQUIRED");
}

async function loadAdminProducts() {
  if (!CONFIG.apiUrl) throw new Error("API_NOT_CONFIGURED");
  setAdminStatus("正在讀取商品…");
  const result = await adminPost({ action: "adminReadProducts" });
  if (!result.ok) throw new Error(result.error || "READ_FAILED");
  adminState.products = result.products || [];
  adminState.orders = result.orders || [];
  adminState.settings = { ...adminState.settings, ...(result.settings || {}) };
  adminState.purchaseSummary = result.purchaseSummary || { orderCount: 0, totalQty: 0, items: [] };
  fillSettings();
  renderPurchaseSummary();
  renderAdminOrders();
  renderAdminProducts();
}

function renderPurchaseSummary() {
  const summary = adminState.purchaseSummary;
  document.getElementById("orderCount").textContent = formatNumber(summary.orderCount);
  document.getElementById("orderedItemCount").textContent = formatNumber(summary.totalQty);
  document.getElementById("purchaseItemList").innerHTML = summary.items?.length
    ? summary.items.map((item) => `<div><span><strong>${escapeHtml(item.name)}</strong>${item.variant ? `<small>${escapeHtml(item.variant)}</small>` : ""}</span><b>× ${formatNumber(item.qty)}</b></div>`).join("")
    : `<p>目前還沒有已收訂金的訂單。</p>`;
}

function renderAdminOrders() {
  const search = document.getElementById("orderSearch").value.trim().toLowerCase();
  const filter = document.getElementById("orderStatusFilter").value;
  const pending = adminState.orders.filter((order) => normalizeAdminOrderStatus(order.status) === "待收訂金").length;
  document.getElementById("unshippedCount").textContent = `${formatNumber(pending)} 筆待收訂金`;
  const orders = adminState.orders.filter((order) => {
    const status = normalizeAdminOrderStatus(order.status);
    if (filter === "active" && ["已取消", ORDER_COMPLETED_STATUS].includes(status)) return false;
    if (!["active", "all"].includes(filter) && status !== filter) return false;
    const haystack = `${order.orderNo} ${order.customerName} ${order.phone} ${order.lineDisplayName}`.toLowerCase();
    return !search || haystack.includes(search);
  });
  document.getElementById("adminOrderList").innerHTML = orders.length ? orders.map(renderAdminOrderCard).join("") : `<div class="empty-orders">沒有符合條件的訂單。</div>`;
}

function normalizeAdminOrderStatus(status) {
  return status === "已出貨" ? IOPEN_MALL_READY_STATUS : status;
}

function renderAdminOrderCard(order) {
  const normalizedStatus = normalizeAdminOrderStatus(order.status);
  const status = ["待收訂金", PAYMENT_REPORTED_STATUS, "已收到訂金", IOPEN_MALL_READY_STATUS, ORDER_COMPLETED_STATUS, "已取消"].includes(normalizedStatus) ? normalizedStatus : "待收訂金";
  const statusClass = { "待收訂金": "pending", [PAYMENT_REPORTED_STATUS]: "payment-reported", "已收到訂金": "deposit-received", [IOPEN_MALL_READY_STATUS]: "shipped", [ORDER_COMPLETED_STATUS]: "completed", "已取消": "cancelled" }[status];
  const displayStatus = order.mallPaymentExpired ? "賣場付款已逾期／待確認" : status;
  const items = Array.isArray(order.items) ? order.items : [];
  const shortageHistory = Array.isArray(order.shortageAdjustments) ? order.shortageAdjustments : [];
  const adjustmentHistory = Array.isArray(order.orderAdjustments) ? order.orderAdjustments : [];
  const latestAdjustment = adjustmentHistory[adjustmentHistory.length - 1] || null;
  const canEditOrder = ["待收訂金", PAYMENT_REPORTED_STATUS, "已收到訂金", IOPEN_MALL_READY_STATUS].includes(status) && items.length > 0;
  const primaryAmount = ["待收訂金", PAYMENT_REPORTED_STATUS].includes(status)
    ? { label: "訂金金額", value: order.depositTotal }
    : [IOPEN_MALL_READY_STATUS, "已收到訂金"].includes(status)
      ? { label: "剩餘金額", value: order.estimatedBalance }
      : { label: "訂單金額", value: order.estimatedTotal };
  const statusDetailRows = status === "待收訂金"
    ? `<div><dt>付款期限</dt><dd class="${order.paymentOverdue ? "refund-pending" : ""}">${escapeHtml(order.paymentDueText || "—")}</dd></div><div><dt>訂單金額</dt><dd class="order-accent">NT $${formatNumber(order.estimatedTotal)}</dd></div>`
    : status === PAYMENT_REPORTED_STATUS
      ? `<div><dt>匯款後五碼</dt><dd class="order-accent">${escapeHtml(order.transferLast5 || "未填寫")}</dd></div><div><dt>回報時間</dt><dd>${escapeHtml(order.paymentReportedAt || "—")}</dd></div>`
    : status === "已收到訂金"
      ? `<div><dt>訂單金額</dt><dd class="order-accent">NT $${formatNumber(order.estimatedTotal)}</dd></div><div><dt>訂金金額</dt><dd>NT $${formatNumber(order.depositTotal)}</dd></div>`
      : status === IOPEN_MALL_READY_STATUS
        ? `<div><dt>訂單金額</dt><dd class="order-accent">NT $${formatNumber(order.estimatedTotal)}</dd></div>${order.shippedAt ? `<div><dt>賣場開設時間</dt><dd>${escapeHtml(order.shippedAt)}</dd></div>` : ""}`
        : status === ORDER_COMPLETED_STATUS
          ? `<div><dt>訂金金額</dt><dd>NT $${formatNumber(order.depositTotal)}</dd></div><div><dt>訂單金額</dt><dd>NT $${formatNumber(order.estimatedTotal)}</dd></div>`
          : `<div><dt>訂單金額</dt><dd>NT $${formatNumber(order.estimatedTotal)}</dd></div>${order.cancelledAt ? `<div><dt>取消時間</dt><dd>${escapeHtml(order.cancelledAt)}</dd></div>` : ""}`;
  const lineAlert = Number(order.lineAlertCount || 0) > 0
    ? `<section class="line-alert"><strong>LINE 有新訊息待核對</strong><span>${formatNumber(order.lineAlertCount)} 則・${escapeHtml(formatLineMessageType(order.latestLineAlert?.messageType))}・${escapeHtml(order.latestLineAlert?.receivedAt || "")}</span>${order.latestLineAlert?.textPreview ? `<p>${escapeHtml(order.latestLineAlert.textPreview)}</p>` : ""}<small>${order.autoCancelOverdue ? "此訂單已超過內部處理期限，請確認是否收到訂金。" : "核對前系統不會自動取消這筆訂單。"}</small><details class="line-alert-menu"><summary>選擇處理方式</summary><div class="line-alert-options"><button type="button" data-line-decision="received" data-line-order="${escapeAttr(order.orderNo)}">確認已收到訂金</button><button class="${order.autoCancelOverdue ? "is-cancel" : "is-reviewed"}" type="button" data-line-decision="${order.autoCancelOverdue ? "cancel_overdue" : "reviewed"}" data-line-order="${escapeAttr(order.orderNo)}">${order.autoCancelOverdue ? "不是付款訊息，逾期取消並通知" : "不是付款訊息，標記已查看"}</button></div></details></section>`
    : "";
  const mallExpiry = order.mallPaymentExpired
    ? `<section class="mall-expiry-alert"><strong>賣場付款已逾期／待確認</strong><span>付款期限：${escapeHtml(order.mallPaymentDueText || "—")}</span><p>請先至 iOPEN Mall 確認並關閉賣場，再由訂單狀態選擇「取消訂單」發送結案卡片。</p></section>`
    : "";
  return `<article class="admin-order-card ${statusClass} ${order.mallPaymentExpired ? "mall-overdue" : ""}" data-order-card="${escapeAttr(order.orderNo)}">
    <header><div><span>${escapeHtml(displayStatus)}</span><h3>${escapeHtml(order.lineDisplayName || order.customerName || "未命名")}</h3></div><b>${escapeHtml(order.orderNo)}</b></header>
    ${canEditOrder ? `<div class="order-card-toolbar"><button type="button" data-edit-order="${escapeAttr(order.orderNo)}">${status === "待收訂金" ? "編輯訂單" : "調整訂單"}</button></div>` : ""}
    <div class="packing-items">${renderAdjustedOrderItems(items, latestAdjustment) || `<pre>${escapeHtml(order.itemsSummary)}</pre>`}</div>
    <div class="order-summary-box">
      <div class="order-primary-amount"><span>${primaryAmount.label}</span><strong>NT $${formatNumber(primaryAmount.value)}</strong></div>
      <dl class="customer-details">
        <div><dt>訂購人</dt><dd>${escapeHtml(order.customerName)}　${escapeHtml(order.phone)}</dd></div>
        <div><dt>備註</dt><dd>${escapeHtml(order.note || "無")}</dd></div>
        ${statusDetailRows}
      </dl>
      <div class="order-status-actions">
        <label><span>訂單狀態</span><select data-status-order="${escapeAttr(order.orderNo)}" data-selected-status="${escapeAttr(status)}" ${status === "已取消" ? "disabled" : ""}>${status === PAYMENT_REPORTED_STATUS ? `<option value="${PAYMENT_REPORTED_STATUS}" selected hidden>${PAYMENT_REPORTED_STATUS}</option>` : ""}<option value="待收訂金" ${status === "待收訂金" ? "selected" : ""}>待收訂金</option><option value="已收到訂金" ${status === "已收到訂金" ? "selected" : ""}>已收到訂金</option><option value="${IOPEN_MALL_READY_STATUS}" ${status === IOPEN_MALL_READY_STATUS ? "selected" : ""}>${IOPEN_MALL_READY_STATUS}</option><option value="${ORDER_COMPLETED_STATUS}" ${status === ORDER_COMPLETED_STATUS ? "selected" : ""}>${ORDER_COMPLETED_STATUS}</option><option class="status-cancel-option" value="已取消" ${status === "已取消" ? "selected" : ""}>取消訂單</option></select></label>
      </div>
      ${lineAlert}
      ${mallExpiry}
      ${adjustmentHistory.length ? renderOrderAdjustmentHistory(order, adjustmentHistory) : ""}
      ${shortageHistory.length ? renderShortageHistory(order, shortageHistory) : ""}
      ${order.reminderDue ? `<div class="order-reminder"><label>12小時未收到訂金通知<textarea rows="5" maxlength="500">${escapeHtml(order.reminderMessage)}</textarea></label><button type="button" data-reminder-order="${escapeAttr(order.orderNo)}">確認並送出提醒</button></div>` : order.reminderSentAt ? `<p class="reminder-sent">提醒已於 ${escapeHtml(order.reminderSentAt)} 送出</p>` : ""}
      ${order.mallReminderDue ? `<div class="order-reminder"><label>七天賣場取消通知<textarea rows="5" maxlength="500">${escapeHtml(order.mallReminderMessage)}</textarea></label><button type="button" data-mall-reminder-order="${escapeAttr(order.orderNo)}">確認並送出提醒</button></div>` : order.mallReminderSentAt ? `<p class="reminder-sent">七天賣場提醒已於 ${escapeHtml(order.mallReminderSentAt)} 送出</p>` : ""}
    </div>
  </article>`;
}

function adminOrderItemKey(item) {
  return `${String(item?.productId || "")}\u0001${String(item?.variant || "")}`;
}

function renderAdjustedOrderItems(items, latestAdjustment) {
  const changes = Array.isArray(latestAdjustment?.changes) ? latestAdjustment.changes : [];
  const affectedCurrent = new Map();
  const previousLines = changes.flatMap((change) => {
    if (change.after) affectedCurrent.set(adminOrderItemKey(change.after), change.type === "added" ? "新增" : "目前");
    if (!change.before || change.type === "added") return [];
    const item = change.before;
    return [`<div class="order-item-previous"><span class="order-item-copy"><em>原訂</em><strong>${escapeHtml(item.name)}</strong>${item.variant ? `<small>${escapeHtml(item.variant)}</small>` : ""}</span><b>× ${formatNumber(item.qty)}</b></div>`];
  });
  const currentLines = items.map((item) => {
    const badge = affectedCurrent.get(adminOrderItemKey(item));
    return `<div class="${badge ? "order-item-current" : ""}"><span class="order-item-copy">${badge ? `<em>${badge}</em>` : ""}<strong>${escapeHtml(item.name)}</strong>${item.variant ? `<small>${escapeHtml(item.variant)}</small>` : ""}</span><b>× ${formatNumber(item.qty)}</b></div>`;
  });
  return previousLines.concat(currentLines).join("");
}

function renderOrderAdjustmentHistory(order, history) {
  const entries = [...history].reverse();
  return `<details class="order-adjustment-history">
    <summary><span>查看調整紀錄（${formatNumber(history.length)}）</span><b>${escapeHtml(order.orderAdjustedAt || entries[0]?.adjustedAt || "")}</b></summary>
    <div class="order-adjustment-history-list">${entries.map((entry) => {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      return `<section><div><strong>${escapeHtml(entry.adjustedAt || "")}</strong><span>${escapeHtml(entry.reasonLabel || entry.status || "")}</span></div>
        <ul>${changes.map((change) => {
          const item = change.after || change.before || {};
          const name = `${item.name || ""}${item.variant ? `｜${item.variant}` : ""}`;
          const text = change.type === "added"
            ? `新增 ${name} × ${change.after?.qty || 0}`
            : change.type === "removed"
              ? `取消 ${name} × ${change.before?.qty || 0}`
              : `${name}：${change.before?.qty || 0} → ${change.after?.qty || 0}`;
          return `<li>${escapeHtml(text)}</li>`;
        }).join("")}</ul>
        <p>訂單金額 NT $${formatNumber(entry.previousTotal)} → NT $${formatNumber(entry.adjustedTotal)}</p>
        <small>${entry.notificationSentAt ? `LINE 通知已於 ${escapeHtml(entry.notificationSentAt)} 送出` : "LINE 通知未送達"}</small>
      </section>`;
    }).join("")}</div>
  </details>`;
}

async function handleOrderAction(event) {
  const button = event.target.closest("[data-edit-order], [data-reminder-order], [data-mall-reminder-order], [data-refund-order], [data-line-decision]");
  if (!button) return;
  if (button.dataset.editOrder) {
    openOrderEditor(button.dataset.editOrder);
    return;
  }
  if (button.dataset.lineDecision) {
    const decision = button.dataset.lineDecision;
    const confirmations = {
      received: "確定已至帳戶核對並收到這筆訂金？確認後會更新訂單狀態並發送收到訂金通知。",
      cancel_overdue: "確定沒有收到這筆訂金？訂單會立即取消並發送逾期取消通知。",
    };
    if (confirmations[decision] && !window.confirm(confirmations[decision])) return;
    button.disabled = true;
    try {
      const result = await adminPost({
        action: "adminResolveLineAlert",
        orderNo: button.dataset.lineOrder,
        decision,
      });
      if (!result.ok) throw new Error(result.error || "ORDER_UPDATE_FAILED");
      await loadAdminProducts();
      const messages = {
        received: result.order.notificationSent ? "已收到訂金並發送通知" : "已收到訂金，但 LINE 通知未送達",
        reviewed: "LINE 訊息已標記為已查看",
        cancel_overdue: result.order.notificationSent ? "訂單已取消並發送通知" : "訂單已取消，但 LINE 通知未送達",
      };
      showToast(messages[decision] || "LINE 訊息已處理");
    } catch (error) {
      button.disabled = false;
      const messages = {
        LINE_ALERT_ALREADY_RESOLVED: "這則 LINE 訊息已由其他頁面處理，請重新整理",
        ORDER_PAYMENT_OVERDUE: "訂單已逾期，請重新整理後選擇逾期取消",
        ORDER_CANCEL_NOT_DUE: "訂單尚未到自動取消時間",
        INVALID_ORDER_STATUS: "訂單狀態已改變，請重新整理",
      };
      showToast(messages[error.message] || "目前無法處理 LINE 訊息");
    }
    return;
  }
  if (button.dataset.refundOrder) {
    await confirmCashRefund(button);
    return;
  }
  button.disabled = true;
  try {
    const card = button.closest("[data-order-card]");
    const isMallReminder = Boolean(button.dataset.mallReminderOrder);
    const reminder = button.closest(".order-reminder");
    const payload = {
      action: isMallReminder ? "adminSendMallExpiryReminder" : "adminSendOrderReminder",
      orderNo: isMallReminder ? button.dataset.mallReminderOrder : button.dataset.reminderOrder,
      message: reminder.querySelector("textarea").value.trim(),
    };
    if (!payload.message) return showToast("請輸入提醒內容");
    const result = await adminPost(payload);
    if (!result.ok) throw new Error(result.error || "ORDER_UPDATE_FAILED");
    const index = adminState.orders.findIndex((order) => order.orderNo === result.order.orderNo);
    if (index >= 0) adminState.orders[index] = { ...adminState.orders[index], ...result.order };
    renderAdminOrders();
    showToast("提醒訊息已送出");
  } catch (error) {
    showToast("訂單操作失敗，請稍後再試");
  } finally { button.disabled = false; }
}

function renderShortageHistory(order, history) {
  const latest = history[history.length - 1] || {};
  const refundDue = Number(order.cashRefundDue || 0);
  const paymentLine = refundDue > 0
    ? order.cashRefundedAt
      ? `<strong class="refund-complete">已退現金 NT $${formatNumber(refundDue)}</strong><small>${escapeHtml(order.cashRefundedAt)}</small>`
      : `<strong class="refund-pending">待退現金 NT $${formatNumber(refundDue)}</strong><button type="button" data-refund-order="${escapeAttr(order.orderNo)}">確認已退現金</button>`
    : `<strong>後續應付 NT $${formatNumber(order.estimatedBalance)}</strong>`;
  return `<section class="shortage-history">
    <div><span>缺貨調整</span><b>${escapeHtml(order.shortageAdjustedAt || latest.adjustedAt || "")}</b></div>
    <p>原總額 NT $${formatNumber(order.originalEstimatedTotal)} → 已扣除 NT $${formatNumber(Number(order.originalEstimatedTotal || 0) - Number(order.estimatedTotal || 0))} → 新總額 NT $${formatNumber(order.estimatedTotal)}</p>
    <div class="shortage-payment">${paymentLine}</div>
    <small>${order.shortageNotificationSentAt ? `LINE 通知已於 ${escapeHtml(order.shortageNotificationSentAt)} 送出` : "LINE 通知未送達"}</small>
  </section>`;
}

function getOrderEditorContext() {
  const orderNo = document.getElementById("orderEditorOrderNo").value;
  return adminState.orders.find((entry) => entry.orderNo === orderNo);
}

function orderEditorProductOptions(currentItem) {
  const choices = adminState.products.filter((product) => product.active || product.id === currentItem?.productId);
  if (currentItem?.productId && !choices.some((product) => product.id === currentItem.productId)) {
    choices.unshift({ id: currentItem.productId, name: currentItem.name, active: false });
  }
  return choices.map((product) => `<option value="${escapeAttr(product.id)}" ${product.id === currentItem?.productId ? "selected" : ""}>${escapeHtml(product.name)}${product.active ? "" : "（原訂商品）"}</option>`).join("");
}

function orderEditorVariantOptions(product, selectedVariant, allowOriginalOnly = false) {
  let variants = allowOriginalOnly ? [selectedVariant] : [...(product?.variants || [])];
  if (selectedVariant && !variants.includes(selectedVariant)) variants.unshift(selectedVariant);
  if (!variants.length) variants = [""];
  return variants.map((variant) => `<option value="${escapeAttr(variant)}" ${variant === selectedVariant ? "selected" : ""}>${escapeHtml(variant || "無款式")}</option>`).join("");
}

function getOrderEditorReason() {
  return document.getElementById("orderEditorReason").value;
}

function addOrderEditorRow(item = null) {
  const list = document.getElementById("orderEditorItems");
  const shortageMode = getOrderEditorReason() === "shortage";
  const defaultProduct = item
    ? adminState.products.find((product) => product.id === item.productId)
    : adminState.products.find((product) => product.active);
  if (!item && !defaultProduct) return showToast("目前沒有可新增的上架商品");
  const source = item || {
    productId: defaultProduct.id,
    name: defaultProduct.name,
    variant: defaultProduct.variants?.[0] || "",
    qty: 1,
    unitPriceTwd: defaultProduct.priceTwd,
  };
  const product = adminState.products.find((entry) => entry.id === source.productId);
  const row = document.createElement("div");
  row.className = "order-editor-item";
  row.dataset.originalProductId = source.productId || "";
  row.dataset.originalVariant = source.variant || "";
  row.dataset.originalName = source.name || "";
  row.dataset.originalPrice = String(source.unitPriceTwd || (Number(source.subtotalTwd || 0) / Number(source.qty || 1)) || 0);
  row.innerHTML = `<label><span>商品</span><select data-order-editor-product ${shortageMode ? "disabled" : ""}>${orderEditorProductOptions(source)}</select></label>
    <label><span>款式</span><select data-order-editor-variant ${shortageMode ? "disabled" : ""}>${orderEditorVariantOptions(product, source.variant || "", Boolean(product && !product.active))}</select></label>
    <label class="order-editor-qty"><span>數量</span><input data-order-editor-qty type="number" min="1" max="20" step="1" inputmode="numeric" value="${Number(source.qty || 1)}" /></label>
    <button class="order-editor-remove" type="button" data-order-editor-remove aria-label="移除此品項">${shortageMode ? "缺貨取消" : "移除"}</button>`;
  list.appendChild(row);
  updateOrderEditorPreview();
}

function openOrderEditor(orderNo) {
  const order = adminState.orders.find((entry) => entry.orderNo === orderNo);
  if (!order) return;
  const status = normalizeAdminOrderStatus(order.status);
  if (!["待收訂金", PAYMENT_REPORTED_STATUS, "已收到訂金", IOPEN_MALL_READY_STATUS].includes(status)) return;
  document.getElementById("orderEditorOrderNo").value = orderNo;
  document.getElementById("orderEditorRevision").value = Number(order.orderRevision || 0);
  document.getElementById("orderEditorTitle").textContent = status === "待收訂金" ? "編輯訂單" : "調整訂單";
  document.getElementById("orderEditorMessage").textContent = `${orderNo}｜目前狀態：${status}`;
  const reason = document.getElementById("orderEditorReason");
  reason.innerHTML = status === IOPEN_MALL_READY_STATUS
    ? `<option value="shortage">韓國現場缺貨</option>`
    : status === "已收到訂金"
      ? `<option value="customer_change">顧客變更</option><option value="admin_correction" selected>管理修正</option><option value="shortage">韓國現場缺貨</option>`
      : `<option value="customer_change">顧客變更</option><option value="admin_correction" selected>管理修正</option>`;
  reason.disabled = status === IOPEN_MALL_READY_STATUS;
  resetOrderEditorForReason();
  document.getElementById("orderEditorDialog").showModal();
}

function resetOrderEditorForReason() {
  const order = getOrderEditorContext();
  if (!order) return;
  const status = normalizeAdminOrderStatus(order.status);
  const shortageMode = getOrderEditorReason() === "shortage";
  document.getElementById("orderEditorItems").innerHTML = "";
  (order.items || []).forEach((item) => addOrderEditorRow(item));
  document.getElementById("orderEditorAdd").hidden = shortageMode;
  document.getElementById("orderEditorWarning").textContent = shortageMode
    ? "缺貨只能減少或取消原有商品；已收訂金不會改寫，系統會計算調整後尾款或待退款。"
    : status === "待收訂金"
      ? "尚未收款：儲存後會依新總額重算 50% 訂金，付款期限維持原訂時間。"
      : status === PAYMENT_REPORTED_STATUS
        ? "顧客已回報匯款：儲存後保留回報資料與原訂金金額，請核帳時一併確認差額。"
        : "訂金已核帳：儲存後不會改寫已收訂金；若有溢付，後台會顯示待處理差額。";
  updateOrderEditorPreview();
}

function handleOrderEditorItemChange(event) {
  const productSelect = event.target.closest("[data-order-editor-product]");
  if (!productSelect || getOrderEditorReason() === "shortage") return;
  const row = productSelect.closest(".order-editor-item");
  const product = adminState.products.find((entry) => entry.id === productSelect.value);
  const variantSelect = row.querySelector("[data-order-editor-variant]");
  variantSelect.innerHTML = orderEditorVariantOptions(product, product?.variants?.[0] || "");
  updateOrderEditorPreview();
}

function handleOrderEditorItemClick(event) {
  const button = event.target.closest("[data-order-editor-remove]");
  if (!button) return;
  button.closest(".order-editor-item").remove();
  updateOrderEditorPreview();
}

function readOrderEditorItems() {
  return [...document.querySelectorAll("#orderEditorItems .order-editor-item")].map((row) => ({
    productId: row.querySelector("[data-order-editor-product]").value,
    variant: row.querySelector("[data-order-editor-variant]").value,
    qty: Number(row.querySelector("[data-order-editor-qty]").value),
  }));
}

function orderEditorUnitPrice(order, item) {
  const existing = (order.items || []).find((entry) => adminOrderItemKey(entry) === adminOrderItemKey(item));
  if (existing) return Number(existing.unitPriceTwd || (Number(existing.subtotalTwd || 0) / Number(existing.qty || 1)) || 0);
  return Number(adminState.products.find((product) => product.id === item.productId)?.priceTwd || 0);
}

function getOrderEditorCancellations(order, items) {
  const desiredByKey = new Map(items.map((item) => [adminOrderItemKey(item), item]));
  return (order.items || []).map((item, index) => {
    const desired = desiredByKey.get(adminOrderItemKey(item));
    return { index, qty: Number(item.qty || 0) - Number(desired?.qty || 0) };
  }).filter((entry) => entry.qty > 0);
}

function updateOrderEditorPreview() {
  const order = getOrderEditorContext();
  if (!order) return;
  const items = readOrderEditorItems();
  const keys = items.map(adminOrderItemKey);
  const shortageMode = getOrderEditorReason() === "shortage";
  const invalidQty = items.some((item) => !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20);
  const duplicate = new Set(keys).size !== keys.length;
  const originalByKey = new Map((order.items || []).map((item) => [adminOrderItemKey(item), item]));
  const invalidShortage = shortageMode && items.some((item) => {
    const original = originalByKey.get(adminOrderItemKey(item));
    return !original || item.qty > Number(original.qty || 0);
  });
  const cancellations = getOrderEditorCancellations(order, items);
  const totalQty = items.reduce((sum, item) => sum + (Number.isFinite(item.qty) ? item.qty : 0), 0);
  const total = items.reduce((sum, item) => sum + orderEditorUnitPrice(order, item) * (Number.isFinite(item.qty) ? item.qty : 0), 0);
  const status = normalizeAdminOrderStatus(order.status);
  const adjustedOrderDeposit = Math.ceil(total * 0.5);
  const receivedDeposit = status === "待收訂金" ? 0 : Number(order.depositTotal || 0);
  const settlementDeposit = status === "待收訂金" ? adjustedOrderDeposit : receivedDeposit;
  const balance = Math.max(total - settlementDeposit, 0);
  const overflow = ["已收到訂金", IOPEN_MALL_READY_STATUS].includes(status) ? Math.max(receivedDeposit - total, 0) : 0;
  const changedAmount = Math.abs(total - Number(order.estimatedTotal || 0));
  const error = !items.length && !shortageMode
    ? "訂單不可沒有商品；若要整筆取消，請使用訂單狀態。"
    : invalidQty
      ? "每個品項數量須為 1～20。"
      : totalQty > 100
        ? "單筆訂單最多 100 件。"
        : duplicate
          ? "相同商品與款式不可重複，請合併數量。"
          : invalidShortage
            ? "缺貨調整只能減少原有商品，不能新增或增加數量。"
            : shortageMode && !cancellations.length
              ? "請減少數量或移除至少一個缺貨品項。"
          : "";
  const receivedLabel = status === PAYMENT_REPORTED_STATUS ? "已回報訂金" : "已收訂金";
  const changeLabel = total > Number(order.estimatedTotal || 0) ? "這次增加金額" : total < Number(order.estimatedTotal || 0) ? "這次扣除金額" : "這次金額變動";
  document.getElementById("orderEditorPreview").innerHTML = `<div><span>原訂單金額</span><strong>NT $${formatNumber(order.estimatedTotal)}</strong></div>
    <div><span>${receivedLabel}</span><strong>NT $${formatNumber(receivedDeposit)}</strong></div>
    <div><span>商品件數</span><strong>${formatNumber(totalQty)} 件</strong></div>
    <div><span>調整後訂單總額</span><strong>NT $${formatNumber(total)}</strong></div>
    <div><span>調整後訂單訂金</span><strong>NT $${formatNumber(adjustedOrderDeposit)}</strong></div>
    <div><span>${changeLabel}</span><strong>NT $${formatNumber(changedAmount)}</strong></div>
    <div><span>調整後應付尾款</span><strong>NT $${formatNumber(balance)}</strong></div>
    ${overflow > 0 ? `<div><span>待處理退款</span><strong>NT $${formatNumber(overflow)}</strong></div>` : ""}
    ${error ? `<p>${escapeHtml(error)}</p>` : ""}`;
  document.getElementById("orderEditorSubmit").disabled = Boolean(error);
}

async function submitOrderAdjustment(event) {
  event.preventDefault();
  const orderNo = document.getElementById("orderEditorOrderNo").value;
  const submit = document.getElementById("orderEditorSubmit");
  submit.disabled = true;
  submit.textContent = "處理中…";
  try {
    const order = getOrderEditorContext();
    const items = readOrderEditorItems();
    const shortageMode = getOrderEditorReason() === "shortage";
    const common = {
      orderNo,
      expectedRevision: Number(document.getElementById("orderEditorRevision").value || 0),
      expectedStatus: normalizeAdminOrderStatus(order?.status || ""),
      adjustmentId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    };
    const result = await adminPost(shortageMode
      ? { action: "adminAdjustOrderShortage", ...common, cancellations: getOrderEditorCancellations(order, items) }
      : { action: "adminAdjustOrder", ...common, reason: getOrderEditorReason(), items });
    if (!result.ok) throw new Error(result.error || "ORDER_UPDATE_FAILED");
    document.getElementById("orderEditorDialog").close();
    await loadAdminProducts();
    showToast(result.duplicate
      ? "此筆調整已處理，未重複送出"
      : result.order.notificationSent
        ? `${shortageMode ? "缺貨" : "訂單"}調整完成並發送通知`
        : `${shortageMode ? "缺貨" : "訂單"}調整完成，但 LINE 通知未送達`);
  } catch (error) {
    const messages = {
      NO_ORDER_CHANGES: "訂單內容沒有變更",
      ORDER_CHANGED: "訂單已在其他頁面更新，請重新整理後再試",
      ORDER_EDIT_NOT_ALLOWED: "此狀態不可編輯訂單",
      PRODUCT_CHANGED: "商品已下架或款式已變更，請重新選擇",
      INVALID_SHORTAGE_ADJUSTMENT: "缺貨品項或數量不正確",
    };
    showToast(messages[error.message] || "訂單調整失敗，請重新確認");
  } finally {
    submit.disabled = false;
    submit.textContent = "確認修改並通知";
  }
}

async function confirmCashRefund(button) {
  const orderNo = button.dataset.refundOrder;
  if (!window.confirm(`確認訂單 ${orderNo} 已退還現金？`)) return;
  button.disabled = true;
  try {
    const result = await adminPost({ action: "adminConfirmCashRefund", orderNo });
    if (!result.ok) throw new Error(result.error || "ORDER_UPDATE_FAILED");
    const index = adminState.orders.findIndex((order) => order.orderNo === result.order.orderNo);
    if (index >= 0) adminState.orders[index] = { ...adminState.orders[index], ...result.order };
    renderAdminOrders();
    showToast("已記錄現金退款");
  } catch (error) {
    button.disabled = false;
    showToast("退款紀錄更新失敗");
  }
}

function confirmOrderStatusChange(orderNo, previousStatus, nextStatus) {
  const dialog = document.getElementById("orderStatusConfirmDialog");
  const isCancellation = nextStatus === "已取消";
  const isCompleted = nextStatus === ORDER_COMPLETED_STATUS;
  document.getElementById("orderStatusConfirmMessage").textContent = `訂單 ${orderNo} 將變更為以下狀態：`;
  document.getElementById("orderStatusPrevious").textContent = previousStatus;
  const next = document.getElementById("orderStatusNext");
  next.textContent = nextStatus;
  next.classList.toggle("is-cancelled", isCancellation);
  const note = document.getElementById("orderStatusConfirmNote");
  note.textContent = isCompleted
    ? "確認後將立即更新訂單；此狀態不會發送 LINE 通知。"
    : "確認後將立即更新訂單；並同步發送 LINE 通知。";
  note.classList.toggle("is-warning", isCancellation);
  const submit = document.getElementById("orderStatusConfirmSubmit");
  submit.textContent = isCancellation ? "確認取消訂單" : "確認變更";
  submit.classList.toggle("is-cancelled", isCancellation);
  dialog.returnValue = "";
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
    dialog.showModal();
  });
}

async function handleOrderStatusChange(event) {
  const select = event.target.closest("[data-status-order]");
  if (!select) return;
  const currentOrder = adminState.orders.find((order) => order.orderNo === select.dataset.statusOrder);
  const previous = normalizeAdminOrderStatus(currentOrder?.status || "待收訂金");
  const next = select.value;
  select.disabled = true;
  const confirmed = await confirmOrderStatusChange(select.dataset.statusOrder, previous, next);
  if (!confirmed) {
    select.value = previous;
    select.disabled = false;
    return;
  }
  try {
    const result = await adminPost(next === "已取消"
      ? {
          action: "adminCancelOrder",
          orderNo: select.dataset.statusOrder,
          reason: currentOrder?.mallPaymentExpired
            ? "已超過 iOPEN Mall 付款期限，管理員確認關閉賣場後結案。"
            : "此訂單已由管理員取消。",
        }
      : { action: "adminUpdateOrderStatus", orderNo: select.dataset.statusOrder, status: next });
    if (!result.ok) throw new Error(result.error || "ORDER_UPDATE_FAILED");
    const index = adminState.orders.findIndex((order) => order.orderNo === result.order.orderNo);
    if (index >= 0) adminState.orders[index] = { ...adminState.orders[index], ...result.order };
    renderAdminOrders();
    if (next === "已取消") {
      showToast(result.order.notificationSent
        ? "訂單已取消並發送通知"
        : "訂單已取消，但 LINE 通知未送達");
    } else if (result.order.notificationAttempted) {
      showToast(result.order.notificationSent
        ? `訂單已改為「${result.order.status}」並發送通知`
        : `訂單已改為「${result.order.status}」，但 LINE 通知未送達`);
    } else {
      showToast(previous === result.order.status
        ? `訂單原本就是「${result.order.status}」，未重複發送通知`
        : `訂單已改為「${result.order.status}」`);
    }
  } catch (error) {
    select.value = previous;
    select.disabled = false;
    showToast("訂單狀態更新失敗");
  }
}

function renderAdminProducts() {
  const search = document.getElementById("productSearch").value.trim().toLowerCase();
  const filter = document.getElementById("statusFilter").value;
  const products = adminState.products.filter((product) => {
    if (filter === "active" && !product.active) return false;
    if (filter === "inactive" && product.active) return false;
    return !search || `${product.name} ${product.category}`.toLowerCase().includes(search);
  });
  document.getElementById("activeCount").textContent = adminState.products.filter((product) => product.active).length;
  document.getElementById("totalCount").textContent = adminState.products.length;
  document.getElementById("adminProductList").innerHTML = products.map((product) => `<article class="admin-product-card ${product.active ? "" : "inactive"}">
    <img src="${escapeAttr(product.imageUrl || demoPlaceholder)}" alt="" />
    <div class="admin-product-info"><div class="admin-product-title"><h3>${escapeHtml(product.name)}</h3><span class="category-label">${escapeHtml(product.category)}</span></div>
    <p>台幣售價 NT$${formatNumber(product.priceTwd)}</p>
    <div class="admin-card-actions"><button type="button" data-edit="${escapeAttr(product.id)}">編輯</button><button type="button" class="${product.active ? "toggle-on" : "toggle-off"}" data-toggle="${escapeAttr(product.id)}">${product.active ? "上架中" : "已下架"}</button></div></div>
  </article>`).join("");
  if (!products.length) setAdminStatus("沒有符合條件的商品。");
  else setAdminStatus("", true);
}

function openEditor(product = null) {
  document.getElementById("editorTitle").textContent = product ? "編輯商品" : "新增商品";
  document.getElementById("productId").value = product?.id || "";
  document.getElementById("productName").value = product?.name || "";
  document.getElementById("productCategory").value = product?.category || "";
  document.getElementById("productTwdPrice").value = product?.priceTwd || "";
  document.getElementById("productVariants").value = Array.isArray(product?.variants) ? product.variants.join(", ") : (product?.variants || "");
  document.getElementById("productDescription").value = product?.description || "";
  document.getElementById("productSortOrder").value = product?.sortOrder ?? adminState.products.length + 1;
  document.getElementById("productActive").checked = product ? Boolean(product.active) : true;
  document.getElementById("productImageUrl").value = product?.imageUrl || "";
  document.getElementById("productImagePreview").src = product?.imageUrl || demoPlaceholder;
  document.getElementById("imageUploadHint").textContent = product?.imageUrl ? "點一下更換照片" : "拍照或從相簿選擇";
  updateAdminPricePreview();
  document.getElementById("productEditor").showModal();
}

async function handleProductAction(event) {
  const editButton = event.target.closest("[data-edit]");
  if (editButton) return openEditor(adminState.products.find((product) => product.id === editButton.dataset.edit));
  const toggleButton = event.target.closest("[data-toggle]");
  if (!toggleButton) return;
  const product = adminState.products.find((item) => item.id === toggleButton.dataset.toggle);
  if (!product) return;
  toggleButton.disabled = true;
  try {
    const result = await adminPost({ action: "adminToggleProduct", productId: product.id, active: !product.active });
    if (!result.ok) throw new Error(result.error || "TOGGLE_FAILED");
    product.active = result.product.active;
    renderAdminProducts();
    showToast(product.active ? "商品已上架" : "商品已下架");
  } catch (error) {
    showToast("更新失敗，請再試一次");
  } finally { toggleButton.disabled = false; }
}

async function uploadSelectedImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!CONFIG.apiUrl) return showToast("尚未設定 GAS API");
  adminState.uploadBusy = true;
  document.getElementById("uploadProgress").hidden = false;
  try {
    const compressed = await compressImage(file, 1200, .82);
    document.getElementById("productImagePreview").src = compressed.dataUrl;
    const result = await adminPost({ action: "adminUploadProductImage", fileName: file.name, mimeType: "image/jpeg", base64Data: compressed.dataUrl.split(",")[1] });
    if (!result.ok) throw new Error(result.error || "UPLOAD_FAILED");
    document.getElementById("productImageUrl").value = result.imageUrl;
    document.getElementById("productImagePreview").src = result.imageUrl;
    document.getElementById("imageUploadHint").textContent = "點一下更換照片";
    showToast("圖片上傳完成");
  } catch (error) {
    console.error(error);
    showToast("圖片上傳失敗，請換一張再試");
  } finally {
    adminState.uploadBusy = false;
    document.getElementById("uploadProgress").hidden = true;
    event.target.value = "";
  }
}

async function saveProduct(event) {
  event.preventDefault();
  if (adminState.uploadBusy) return showToast("請等圖片上傳完成");
  const button = document.getElementById("saveProduct");
  button.disabled = true;
  button.textContent = "儲存中…";
  try {
    const product = {
      id: document.getElementById("productId").value,
      name: document.getElementById("productName").value.trim(),
      category: document.getElementById("productCategory").value.trim(),
      imageUrl: document.getElementById("productImageUrl").value.trim(),
      priceTwd: Number(document.getElementById("productTwdPrice").value),
      variants: parseVariants(document.getElementById("productVariants").value),
      description: document.getElementById("productDescription").value.trim(),
      sortOrder: Number(document.getElementById("productSortOrder").value || 0),
      active: document.getElementById("productActive").checked,
    };
    if (!product.imageUrl) throw new Error("IMAGE_REQUIRED");
    const result = await adminPost({ action: "adminSaveProduct", product });
    if (!result.ok) throw new Error(result.error || "SAVE_FAILED");
    const index = adminState.products.findIndex((item) => item.id === result.product.id);
    if (index >= 0) adminState.products[index] = result.product;
    else adminState.products.push(result.product);
    adminState.products.sort((a, b) => a.sortOrder - b.sortOrder);
    document.getElementById("productEditor").close();
    renderAdminProducts();
    showToast("商品已儲存");
  } catch (error) {
    showToast(error.message === "IMAGE_REQUIRED" ? "請先上傳商品圖片" : "商品儲存失敗，請檢查欄位");
  } finally {
    button.disabled = false;
    button.textContent = "儲存商品";
  }
}

function fillSettings() {
  document.getElementById("saleClosed").checked = Boolean(adminState.settings.saleClosed);
  document.getElementById("saleClosedNotice").value = adminState.settings.saleClosedNotice || "本次連線已結束，謝謝大家的支持！";
  document.getElementById("adminPreorderNotice").value = adminState.settings.preorderNotice || "";
  document.getElementById("bankTransferInfoSetting").value = adminState.settings.bankTransferInfo || "";
  document.getElementById("bankName").value = adminState.settings.bankName || "";
  document.getElementById("bankCode").value = adminState.settings.bankCode || "";
  document.getElementById("bankAccount").value = adminState.settings.bankAccount || "";
  document.getElementById("bankAccountName").value = adminState.settings.bankAccountName || "";
  document.getElementById("bankQrUrl").value = adminState.settings.bankQrUrl || "";
  document.getElementById("bankQrPreview").src = adminState.settings.bankQrUrl || demoPlaceholder;
  document.getElementById("bankQrHint").textContent = adminState.settings.bankQrUrl ? "點一下更換 QR Code（小卡不顯示）" : "上傳匯款 QR Code（小卡不顯示）";
  document.getElementById("iopenMallUrl").value = adminState.settings.iopenMallUrl || "";
  updateAdminPricePreview();
}

async function saveSettings(event) {
  event.preventDefault();
  if (adminState.bankUploadBusy) return showToast("請等 QR Code 上傳完成");
  const settings = {
    saleClosed: document.getElementById("saleClosed").checked,
    saleClosedNotice: document.getElementById("saleClosedNotice").value.trim(),
    preorderNotice: document.getElementById("adminPreorderNotice").value.trim(),
    bankTransferInfo: document.getElementById("bankTransferInfoSetting").value.trim(),
    bankName: document.getElementById("bankName").value.trim(),
    bankCode: document.getElementById("bankCode").value.trim(),
    bankAccount: document.getElementById("bankAccount").value.trim(),
    bankAccountName: document.getElementById("bankAccountName").value.trim(),
    bankQrUrl: document.getElementById("bankQrUrl").value.trim(),
    iopenMallUrl: document.getElementById("iopenMallUrl").value.trim(),
  };
  try {
    const result = await adminPost({ action: "adminSaveSettings", settings });
    if (!result.ok) throw new Error(result.error || "SETTINGS_FAILED");
    adminState.settings = result.settings;
    updateAdminPricePreview();
    showToast(settings.saleClosed ? "已開啟前台停賣" : "已恢復前台販售");
  } catch (error) { showToast("設定儲存失敗"); }
}

async function uploadBankQr(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  adminState.bankUploadBusy = true;
  document.getElementById("bankQrProgress").hidden = false;
  try {
    const compressed = await compressImage(file, 1600, .92);
    document.getElementById("bankQrPreview").src = compressed.dataUrl;
    const result = await adminPost({ action: "adminUploadProductImage", fileName: `bank-qr-${file.name}`, mimeType: "image/jpeg", base64Data: compressed.dataUrl.split(",")[1] });
    if (!result.ok) throw new Error(result.error || "UPLOAD_FAILED");
    document.getElementById("bankQrUrl").value = result.imageUrl;
    document.getElementById("bankQrPreview").src = result.imageUrl;
    document.getElementById("bankQrHint").textContent = "點一下更換 QR Code（小卡不顯示）";
    showToast("QR Code 上傳完成，記得儲存設定");
  } catch (error) {
    showToast("QR Code 上傳失敗，請換一張再試");
  } finally {
    adminState.bankUploadBusy = false;
    document.getElementById("bankQrProgress").hidden = true;
    event.target.value = "";
  }
}

function updateAdminPricePreview() {
  document.getElementById("adminTwdPreview").textContent = `NT$${formatNumber(document.getElementById("productTwdPrice").value)}`;
}

async function adminPost(payload) {
  const response = await fetch(`${CONFIG.apiUrl}?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ ...payload, idToken: adminState.idToken, adminSessionToken: adminState.sessionToken }) });
  return response.json();
}

function compressImage(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", quality) });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function setAdminStatus(message, hidden = false) { const el = document.getElementById("adminStatus"); el.textContent = message; el.hidden = hidden; }
function friendlyAdminError(message) { if (message === "ADMIN_FORBIDDEN") return "這個 LINE 帳號沒有管理員權限。"; if (message === "API_NOT_CONFIGURED") return "請先在 config.js 設定 GAS API 網址。"; if (message === "LIFF_NOT_CONFIGURED") return "請先在 config.js 設定 LIFF ID。"; return "目前無法開啟後台，請稍後再試。"; }
function parseVariants(value) { return String(value || "").split(/[、,\n]/).map((item) => item.trim()).filter(Boolean); }
function formatNumber(value) { return Number(value || 0).toLocaleString("zh-TW"); }
function formatLineMessageType(value) { return ({ text: "文字", image: "圖片", file: "檔案", video: "影片", audio: "語音", location: "位置", sticker: "貼圖" })[String(value || "")] || "訊息"; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }
function escapeAttr(value) { return escapeHtml(value).replace(/'/g, "&#39;"); }
function showToast(message) { const toast = document.getElementById("toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400); }
