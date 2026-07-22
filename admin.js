const CONFIG = window.QUOKKA_CONFIG || {};
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
  document.getElementById("orderSearch").addEventListener("input", renderAdminOrders);
  document.getElementById("orderStatusFilter").addEventListener("change", renderAdminOrders);
  document.getElementById("bankQrInput").addEventListener("change", uploadBankQr);
  document.querySelector(".admin-page-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-admin-page]");
    if (button) switchAdminPage(button.dataset.adminPage);
  });
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
    : `<p>目前還沒有訂單。</p>`;
}

function renderAdminOrders() {
  const search = document.getElementById("orderSearch").value.trim().toLowerCase();
  const filter = document.getElementById("orderStatusFilter").value;
  const pending = adminState.orders.filter((order) => order.status === "待收訂金").length;
  document.getElementById("unshippedCount").textContent = `${formatNumber(pending)} 筆待收訂金`;
  const orders = adminState.orders.filter((order) => {
    if (filter === "active" && order.status === "已取消") return false;
    if (!["active", "all"].includes(filter) && order.status !== filter) return false;
    const haystack = `${order.orderNo} ${order.customerName} ${order.phone} ${order.lineDisplayName}`.toLowerCase();
    return !search || haystack.includes(search);
  });
  document.getElementById("adminOrderList").innerHTML = orders.length ? orders.map(renderAdminOrderCard).join("") : `<div class="empty-orders">沒有符合條件的訂單。</div>`;
}

function renderAdminOrderCard(order) {
  const status = ["待收訂金", "已收到訂金", "已出貨", "已取消"].includes(order.status) ? order.status : "待收訂金";
  const statusClass = { "待收訂金": "pending", "已收到訂金": "deposit-received", "已出貨": "shipped", "已取消": "cancelled" }[status];
  const items = Array.isArray(order.items) ? order.items : [];
  return `<article class="admin-order-card ${statusClass}" data-order-card="${escapeAttr(order.orderNo)}">
    <header><div><span>${escapeHtml(status)}</span><h3>${escapeHtml(order.orderNo)}</h3><time>${escapeHtml(order.createdAt)}</time></div><b>${formatNumber(order.totalQty)} 件</b></header>
    <div class="packing-items">${items.map((item) => `<div><strong>${escapeHtml(item.name)}</strong>${item.variant ? `<small>${escapeHtml(item.variant)}</small>` : ""}<b>× ${formatNumber(item.qty)}</b></div>`).join("") || `<pre>${escapeHtml(order.itemsSummary)}</pre>`}</div>
    <dl class="customer-details">
      <div><dt>訂購人</dt><dd>${escapeHtml(order.customerName)}　${escapeHtml(order.phone)}</dd></div>
      <div><dt>LINE</dt><dd>${escapeHtml(order.lineDisplayName || "—")}</dd></div>
      <div><dt>金額</dt><dd>商品款 NT$${formatNumber(order.estimatedTotal)}／訂金 50% NT$${formatNumber(order.depositTotal)}／剩餘商品款 NT$${formatNumber(order.estimatedBalance)}</dd></div>
      <div><dt>備註</dt><dd>${escapeHtml(order.note || "無")}</dd></div>
      ${order.transferLast5 ? `<div><dt>匯款後五碼</dt><dd>${escapeHtml(order.transferLast5)}</dd></div>` : ""}
      ${status === "已出貨" && order.shippedAt ? `<div><dt>出貨時間</dt><dd>${escapeHtml(order.shippedAt)}</dd></div>` : ""}
      ${status === "已取消" && order.cancelledAt ? `<div><dt>取消時間</dt><dd>${escapeHtml(order.cancelledAt)}</dd></div>` : ""}
    </dl>
    ${order.reminderDue ? `<div class="order-reminder"><label>12 小時未收到訂金提醒<textarea rows="5" maxlength="500">${escapeHtml(order.reminderMessage)}</textarea></label><button type="button" data-reminder-order="${escapeAttr(order.orderNo)}">確認並送出提醒</button></div>` : order.reminderSentAt ? `<p class="reminder-sent">提醒已於 ${escapeHtml(order.reminderSentAt)} 送出</p>` : ""}
    <div class="order-status-actions">
      <label><span>訂單狀態</span><select data-status-order="${escapeAttr(order.orderNo)}" ${status === "已取消" ? "disabled" : ""}><option value="待收訂金" ${status === "待收訂金" ? "selected" : ""}>待收訂金</option><option value="已收到訂金" ${status === "已收到訂金" ? "selected" : ""}>已收到訂金</option><option value="已出貨" ${status === "已出貨" ? "selected" : ""}>已出貨</option></select></label>
      <button class="cancel-order-action" type="button" data-cancel-order="${escapeAttr(order.orderNo)}" ${status === "已取消" ? "disabled" : ""}>${status === "已取消" ? "訂單已取消" : "取消訂單"}</button>
    </div>
  </article>`;
}

async function handleOrderAction(event) {
  const button = event.target.closest("[data-cancel-order], [data-reminder-order]");
  if (!button) return;
  if (button.dataset.cancelOrder && !window.confirm(`確定要取消訂單 ${button.dataset.cancelOrder} 嗎？\n取消後會立即傳送取消通知給客戶。`)) return;
  button.disabled = true;
  try {
    const card = button.closest("[data-order-card]");
    const payload = button.dataset.cancelOrder
      ? { action: "adminCancelOrder", orderNo: button.dataset.cancelOrder }
      : { action: "adminSendOrderReminder", orderNo: button.dataset.reminderOrder, message: card.querySelector(".order-reminder textarea").value.trim() };
    if (payload.action === "adminSendOrderReminder" && !payload.message) return showToast("請輸入提醒內容");
    const result = await adminPost(payload);
    if (!result.ok) throw new Error(result.error || "ORDER_UPDATE_FAILED");
    const index = adminState.orders.findIndex((order) => order.orderNo === result.order.orderNo);
    if (index >= 0) adminState.orders[index] = { ...adminState.orders[index], ...result.order };
    renderAdminOrders();
    showToast(payload.action === "adminCancelOrder" ? (result.order.notificationSent ? "訂單已取消並發送通知" : "訂單已取消，但 LINE 通知未送達") : "提醒訊息已送出");
  } catch (error) {
    showToast("訂單操作失敗，請稍後再試");
  } finally { button.disabled = false; }
}

async function handleOrderStatusChange(event) {
  const select = event.target.closest("[data-status-order]");
  if (!select) return;
  const previous = adminState.orders.find((order) => order.orderNo === select.dataset.statusOrder)?.status || "待收訂金";
  select.disabled = true;
  try {
    const result = await adminPost({ action: "adminUpdateOrderStatus", orderNo: select.dataset.statusOrder, status: select.value });
    if (!result.ok) throw new Error(result.error || "ORDER_UPDATE_FAILED");
    const index = adminState.orders.findIndex((order) => order.orderNo === result.order.orderNo);
    if (index >= 0) adminState.orders[index] = { ...adminState.orders[index], ...result.order };
    renderAdminOrders();
    showToast(`訂單已改為「${result.order.status}」`);
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
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }
function escapeAttr(value) { return escapeHtml(value).replace(/'/g, "&#39;"); }
function showToast(message) { const toast = document.getElementById("toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400); }
