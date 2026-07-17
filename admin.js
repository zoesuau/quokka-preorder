const CONFIG = window.QUOKKA_CONFIG || {};
const adminState = { products: [], settings: { exchangeRate: .022, depositPerItem: 50 }, idToken: "", uploadBusy: false };
const demoPlaceholder = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#eee6df"/><text x="200" y="210" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#9b8b7e">NO IMAGE</text></svg>`)}`;

document.addEventListener("DOMContentLoaded", initAdmin);

async function initAdmin() {
  bindAdminEvents();
  try {
    await initAdminLine();
    await loadAdminProducts();
  } catch (error) {
    if (!["LIFF_NOT_CONFIGURED", "API_NOT_CONFIGURED", "LINE_LOGIN_REDIRECT"].includes(error.message)) console.error(error);
    document.getElementById("adminStatus").textContent = friendlyAdminError(error.message);
  }
}

function bindAdminEvents() {
  document.getElementById("newProduct").addEventListener("click", () => openEditor());
  document.getElementById("refreshProducts").addEventListener("click", loadAdminProducts);
  document.getElementById("productSearch").addEventListener("input", renderAdminProducts);
  document.getElementById("statusFilter").addEventListener("change", renderAdminProducts);
  document.getElementById("productKrwPrice").addEventListener("input", updateAdminPricePreview);
  document.getElementById("productImageInput").addEventListener("change", uploadSelectedImage);
  document.getElementById("productForm").addEventListener("submit", saveProduct);
  document.getElementById("settingsForm").addEventListener("submit", saveSettings);
  document.getElementById("adminProductList").addEventListener("click", handleProductAction);
}

async function initAdminLine() {
  const adminLiffId = CONFIG.adminLiffId || CONFIG.liffId;
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
  adminState.settings = { ...adminState.settings, ...(result.settings || {}) };
  fillSettings();
  renderAdminProducts();
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
  document.getElementById("iopenMallUrl").value = adminState.settings.iopenMallUrl || "";
  updateAdminPricePreview();
}

async function saveSettings(event) {
  event.preventDefault();
  const settings = {
    exchangeRate: Number(document.getElementById("exchangeRate").value),
    depositPerItem: Number(document.getElementById("depositPerItem").value),
    preorderNotice: document.getElementById("adminPreorderNotice").value.trim(),
    bankTransferInfo: document.getElementById("bankTransferInfoSetting").value.trim(),
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

function updateAdminPricePreview() {
  document.getElementById("adminTwdPreview").textContent = `NT$${formatNumber(toTwd(document.getElementById("productKrwPrice").value))}`;
}

async function adminPost(payload) {
  const response = await fetch(`${CONFIG.apiUrl}?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ ...payload, idToken: adminState.idToken }) });
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
