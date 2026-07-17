const CONFIG = window.QUOKKA_CONFIG || {};
const adminState = { products: [], orders: [], settings: { exchangeRate: .022, depositPerItem: 50 }, purchaseSummary: { orderCount: 0, totalQty: 0, items: [] }, idToken: "", sessionToken: "", uploadBusy: false, bankUploadBusy: false };
const demoPlaceholder = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#eee6df"/><text x="200" y="210" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#9b8b7e">NO IMAGE</text></svg>`)}`;

document.addEventListener("DOMContentLoaded", initAdmin);

async function initAdmin() {
  bindAdminEvents();
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
  document.getElementById("productKrwPrice").addEventListener("input", updateAdminPricePreview);
  document.getElementById("productImageInput").addEventListener("change", uploadSelectedImage);
  document.getElementById("productForm").addEventListener("submit", saveProduct);
  document.getElementById("settingsForm").addEventListener("submit", saveSettings);
  document.getElementById("adminProductList").addEventListener("click", handleProductAction);
  document.getElementById("adminOrderList").addEventListener("click", handleOrderAction);
  document.getElementById("orderSearch").addEventListener("input", renderAdminOrders);
  document.getElementById("shippingFilter").addEventListener("change", renderAdminOrders);
  document.getElementById("bankQrInput").addEventListener("change", uploadBankQr);
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
  const filter = document.getElementById("shippingFilter").value;
  const unshipped = adminState.orders.filter((order) => order.shippingStatus !== "已出貨").length;
  document.getElementById("unshippedCount").textContent = `${formatNumber(unshipped)} 筆未出貨`;
  const orders = adminState.orders.filter((order) => {
    const shipped = order.shippingStatus === "已出貨";
    if (filter === "unshipped" && shipped) return false;
    if (filter === "shipped" && !shipped) return false;
    const haystack = `${order.orderNo} ${order.customerName} ${order.phone} ${order.lineDisplayName} ${order.socialProfileId}`.toLowerCase();
    return !search || haystack.includes(search);
  });
  document.getElementById("adminOrderList").innerHTML = orders.length ? orders.map(renderAdminOrderCard).join("") : `<div class="empty-orders">沒有符合條件的訂單。</div>`;
}

function renderAdminOrderCard(order) {
  const shipped = order.shippingStatus === "已出貨";
  const items = Array.isArray(order.items) ? order.items : [];
  return `<article class="admin-order-card ${shipped ? "shipped" : "unshipped"}">
    <header><div><span>${shipped ? "已出貨" : "未出貨"}</span><h3>${escapeHtml(order.orderNo)}</h3><time>${escapeHtml(order.createdAt)}</time></div><b>${formatNumber(order.totalQty)} 件</b></header>
    <div class="packing-items">${items.map((item) => `<div><strong>${escapeHtml(item.name)}</strong>${item.variant ? `<small>${escapeHtml(item.variant)}</small>` : ""}<b>× ${formatNumber(item.qty)}</b></div>`).join("") || `<pre>${escapeHtml(order.itemsSummary)}</pre>`}</div>
    <dl class="customer-details">
      <div><dt>訂購人</dt><dd>${escapeHtml(order.customerName)}　${escapeHtml(order.phone)}</dd></div>
      <div><dt>LINE</dt><dd>${escapeHtml(order.lineDisplayName || "—")}</dd></div>
      <div><dt>社群 ID</dt><dd>${escapeHtml(order.socialProfileId || "未填寫")}</dd></div>
      <div><dt>金額</dt><dd>總額 NT$${formatNumber(order.estimatedTotal)}／訂金 NT$${formatNumber(order.depositTotal)}／尾款 NT$${formatNumber(order.estimatedBalance)}</dd></div>
      <div><dt>備註</dt><dd>${escapeHtml(order.note || "無")}</dd></div>
      ${shipped && order.shippedAt ? `<div><dt>出貨時間</dt><dd>${escapeHtml(order.shippedAt)}</dd></div>` : ""}
    </dl>
    <button class="shipping-action" type="button" data-shipping-order="${escapeAttr(order.orderNo)}" data-shipped="${shipped ? "true" : "false"}">${shipped ? "改回未出貨" : "標記已出貨"}</button>
  </article>`;
}

async function handleOrderAction(event) {
  const button = event.target.closest("[data-shipping-order]");
  if (!button) return;
  button.disabled = true;
  try {
    const result = await adminPost({ action: "adminToggleOrderShipping", orderNo: button.dataset.shippingOrder, shipped: button.dataset.shipped !== "true" });
    if (!result.ok) throw new Error(result.error || "SHIPPING_UPDATE_FAILED");
    const index = adminState.orders.findIndex((order) => order.orderNo === result.order.orderNo);
    if (index >= 0) adminState.orders[index] = { ...adminState.orders[index], ...result.order };
    renderAdminOrders();
    showToast(result.order.shippingStatus === "已出貨" ? "已標記出貨" : "已改回未出貨");
  } catch (error) {
    showToast("出貨狀態更新失敗");
  } finally { button.disabled = false; }
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
    <p>₩${formatNumber(product.krwPrice)} → NT$${formatNumber(toTwd(product.krwPrice))}</p>
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
  document.getElementById("productKrwPrice").value = product?.krwPrice || "";
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
      krwPrice: Number(document.getElementById("productKrwPrice").value),
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
  document.getElementById("exchangeRate").value = adminState.settings.exchangeRate || .022;
  document.getElementById("depositPerItem").value = adminState.settings.depositPerItem ?? 50;
  document.getElementById("adminPreorderNotice").value = adminState.settings.preorderNotice || "";
  document.getElementById("bankTransferInfoSetting").value = adminState.settings.bankTransferInfo || "";
  document.getElementById("bankName").value = adminState.settings.bankName || "";
  document.getElementById("bankCode").value = adminState.settings.bankCode || "";
  document.getElementById("bankAccount").value = adminState.settings.bankAccount || "";
  document.getElementById("bankAccountName").value = adminState.settings.bankAccountName || "";
  document.getElementById("bankQrUrl").value = adminState.settings.bankQrUrl || "";
  document.getElementById("bankQrPreview").src = adminState.settings.bankQrUrl || demoPlaceholder;
  document.getElementById("bankQrHint").textContent = adminState.settings.bankQrUrl ? "點一下更換 QR Code" : "上傳匯款 QR Code（選填）";
  document.getElementById("iopenMallUrl").value = adminState.settings.iopenMallUrl || "";
  updateAdminPricePreview();
}

async function saveSettings(event) {
  event.preventDefault();
  if (adminState.bankUploadBusy) return showToast("請等 QR Code 上傳完成");
  const settings = {
    exchangeRate: Number(document.getElementById("exchangeRate").value),
    depositPerItem: Number(document.getElementById("depositPerItem").value),
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
    showToast("預購設定已儲存");
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
    document.getElementById("bankQrHint").textContent = "點一下更換 QR Code";
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
  document.getElementById("adminTwdPreview").textContent = `NT$${formatNumber(toTwd(document.getElementById("productKrwPrice").value))}`;
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
function toTwd(krw) { return Math.round(Number(krw || 0) * Number(adminState.settings.exchangeRate || .022)); }
function formatNumber(value) { return Number(value || 0).toLocaleString("zh-TW"); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }
function escapeAttr(value) { return escapeHtml(value).replace(/'/g, "&#39;"); }
function showToast(message) { const toast = document.getElementById("toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400); }
