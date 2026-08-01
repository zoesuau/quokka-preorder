const CONFIG = window.QUOKKA_CONFIG || {};
window.QUOKKA_APP_VERSION = "20260729-orders-first";
const state = {
  products: [],
  settings: { preorderNotice: "", depositPercent: 50, saleClosed: false, saleClosedNotice: "本次連線已結束，謝謝大家的支持！" },
  catalogReady: false,
  catalogLoadPromise: null,
  category: "全部",
  search: "",
  cart: [],
  selectedProduct: null,
  line: { idToken: "", userId: "", displayName: "" },
  myOrders: null,
  pendingOrderRequest: null,
};

const PENDING_ORDER_REQUEST_KEY = "quokka-pending-order-request-v1";

const demoProducts = [
  { id: "demo-1", name: "矮袋鼠造型鑰匙圈", category: "吊飾", imageUrl: "", priceTwd: 330, variants: ["QUOKKA", "BOBO"], description: "韓國現場預購示意商品", active: true, sortOrder: 1 },
  { id: "demo-2", name: "矮袋鼠便利貼組", category: "文具", imageUrl: "", priceTwd: 190, variants: [], description: "韓國現場預購示意商品", active: true, sortOrder: 2 },
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  document.getElementById("brandName").textContent = CONFIG.brandName || "袋著走";
  bindEvents();
  const ordersShortcut = isOrdersShortcut();
  if (ordersShortcut) showOrdersLoading();
  if (!ordersShortcut) await ensureCatalogLoaded();
  try {
    await initLine();
    if (ordersShortcut && document.documentElement.dataset.lineStatus === "verified") {
      await showMyOrders();
      void ensureCatalogLoaded();
    }
  } catch (error) {
    setLineStatus(error?.message || "LIFF_INIT_FAILED");
    console.error(error);
  }
}

function ensureCatalogLoaded() {
  if (state.catalogReady) return Promise.resolve();
  if (state.catalogLoadPromise) return state.catalogLoadPromise;
  state.catalogLoadPromise = loadCatalog()
    .catch((error) => {
      if (error?.message !== "API_URL_NOT_CONFIGURED") console.error(error);
      useDemoCatalog();
    })
    .finally(() => {
      state.catalogReady = true;
      state.catalogLoadPromise = null;
    });
  return state.catalogLoadPromise;
}

function bindEvents() {
  document.getElementById("saleClosedDialog").addEventListener("cancel", (event) => event.preventDefault());
  document.getElementById("addToCart").addEventListener("click", addSelectedProduct);
  document.getElementById("openCheckout").addEventListener("click", openCheckout);
  document.getElementById("orderForm").addEventListener("submit", submitOrder);
  document.getElementById("myOrdersButton").addEventListener("click", showMyOrders);
  document.getElementById("backToCatalog").addEventListener("click", showCatalog);
  document.getElementById("catalogSearch").addEventListener("input", (event) => {
    state.search = event.target.value.trim();
    renderCatalog();
  });
  document.getElementById("dialogImageThumbnails").addEventListener("click", (event) => {
    const button = event.target.closest("[data-dialog-image]");
    if (!button || !state.selectedProduct) return;
    selectDialogImage(state.selectedProduct, Number(button.dataset.dialogImage));
  });
  document.getElementById("checkoutItems").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;
    state.cart.splice(Number(button.dataset.remove), 1);
    updateCart();
    renderCheckout();
    if (!state.cart.length) document.getElementById("checkoutDialog").close();
  });
}

async function initLine() {
  if (!CONFIG.liffId || isLocalPreview()) return;
  setLineStatus("initializing");
  const lineRuntime = window.QuokkaLineRuntime || window.liff;
  if (!lineRuntime) throw new Error("LIFF_SDK_UNAVAILABLE");
  await lineRuntime.init({ liffId: CONFIG.liffId });
  if (!lineRuntime.isLoggedIn()) {
    setLineStatus("redirecting");
    lineRuntime.login({ redirectUri: getLiffRedirectUri() });
    return;
  }
  state.line.idToken = lineRuntime.getIDToken() || "";
  setLineStatus(state.line.idToken ? "ready" : "missing-token");
  cleanLiffCallbackParams();
  try {
    const profile = await lineRuntime.getProfile();
    state.line.userId = profile.userId || "";
    state.line.displayName = profile.displayName || "";
  } catch (error) {
    console.warn("LINE profile unavailable", error);
  }
  await validateLineSession();
}

function isLocalPreview() {
  return ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
}

async function validateLineSession() {
  if (!CONFIG.apiUrl || !state.line.idToken) return;
  const result = await apiPost({ action: "readMyPreorders", idToken: state.line.idToken });
  if (!result.ok) {
    if (result.error === "LINE_TOKEN_INVALID" && restartLineLogin()) return;
    throw new Error(result.error || "LINE_SESSION_CHECK_FAILED");
  }
  state.myOrders = Array.isArray(result.orders) ? result.orders : [];
  sessionStorage.removeItem("quokka-line-login-retry");
  setLineStatus("verified");
}

function restartLineLogin() {
  const lineRuntime = window.QuokkaLineRuntime || window.liff;
  if (!lineRuntime || sessionStorage.getItem("quokka-line-login-retry") === "1") return false;
  sessionStorage.setItem("quokka-line-login-retry", "1");
  setLineStatus("refreshing");
  lineRuntime.logout();
  lineRuntime.login({ redirectUri: getLiffRedirectUri() });
  return true;
}

function setLineStatus(value) {
  document.documentElement.dataset.lineStatus = String(value || "unknown");
}

function getLiffRedirectUri() {
  const redirectUrl = new URL(`${location.origin}${location.pathname}`);
  if (isOrdersShortcut()) redirectUrl.searchParams.set("view", "orders");
  return redirectUrl.toString();
}

function isOrdersShortcut() {
  return new URL(location.href).searchParams.get("view") === "orders";
}

function cleanLiffCallbackParams() {
  const url = new URL(location.href);
  ["code", "state", "liffClientId", "liffRedirectUri"].forEach((key) => url.searchParams.delete(key));
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

async function loadCatalog() {
  if (!CONFIG.apiUrl) throw new Error("API_URL_NOT_CONFIGURED");
  const url = new URL(CONFIG.apiUrl);
  url.searchParams.set("action", "readPublicCatalog");
  url.searchParams.set("t", Date.now());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = await response.json();
    if (!response.ok || !data.ok || !Array.isArray(data.products)) throw new Error(data.error || "CATALOG_LOAD_FAILED");
    state.products = data.products.filter((product) => product.active);
    state.settings = { ...state.settings, ...(data.settings || {}) };
    renderCatalog();
    updateSaleClosedState();
  } finally {
    clearTimeout(timeout);
  }
}

function useDemoCatalog() {
  state.products = demoProducts;
  renderCatalog();
  document.getElementById("catalogStatus").innerHTML = CONFIG.apiUrl
    ? "目前無法讀取商品，暫時顯示示意內容。"
    : "目前為版面預覽。部署 GAS 後，商品會由手機後台顯示在這裡。";
  document.getElementById("catalogStatus").hidden = false;
}

function renderCatalog() {
  const categories = ["全部", ...new Set(state.products.map((product) => product.category).filter(Boolean))];
  document.getElementById("categoryChips").innerHTML = categories.map((category) => `<button type="button" class="${category === state.category ? "active" : ""}" data-category="${escapeAttr(category)}">${escapeHtml(category)}</button>`).join("");
  document.getElementById("categoryChips").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    state.category = button.dataset.category;
    renderCatalog();
  }));

  const query = state.search.toLocaleLowerCase("zh-TW");
  const categoryProducts = state.category === "全部" ? state.products : state.products.filter((product) => product.category === state.category);
  const visible = query
    ? categoryProducts.filter((product) => {
      const variants = Array.isArray(product.variants) ? product.variants.join(" ") : String(product.variants || "");
      return `${product.name} ${product.category} ${product.description || ""} ${variants}`.toLocaleLowerCase("zh-TW").includes(query);
    })
    : categoryProducts;
  document.getElementById("productCount").textContent = `${visible.length} 件商品`;
  document.getElementById("preorderNotice").textContent = state.settings.preorderNotice || "商品下訂後才會採購。下單先付商品總額的 50% 訂金，回國後再支付剩餘商品款。";
  const depositPercent = Number(state.settings.depositPercent || 50);
  document.getElementById("depositRuleLabel").textContent = `本次訂金（商品總額 ${depositPercent}%）`;
  document.getElementById("preorderAgreementText").textContent = `我了解這是預購商品；下單先付商品總額的 ${depositPercent}% 訂金。採購成功後取消訂單，訂金不予退還；若韓國現場缺貨，該商品訂金將退回。`;
  const grid = document.getElementById("productGrid");
  grid.innerHTML = visible.map((product) => {
    return `<article class="product-card" data-product-id="${escapeAttr(product.id)}">
      ${productImage(product)}
      <div class="product-card-body"><span class="category-label">${escapeHtml(product.category || "韓國小物")}</span>
      <h3>${escapeHtml(product.name)}</h3>
      <div class="product-card-purchase"><p class="price">NT$${formatNumber(product.priceTwd)}</p><button class="card-add-button" type="button" data-add-product="${escapeAttr(product.id)}" aria-label="加入 ${escapeAttr(product.name)}">＋ 加入</button></div>
      <small>訂金 NT$${formatNumber(calculateDeposit(product.priceTwd))}</small></div>
    </article>`;
  }).join("");
  grid.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => openProduct(card.dataset.productId));
  });
  grid.querySelectorAll("[data-add-product]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      quickAddProduct(button.dataset.addProduct);
    });
  });
  document.getElementById("catalogStatus").hidden = visible.length > 0;
  if (!visible.length) document.getElementById("catalogStatus").textContent = query ? `找不到符合「${state.search}」的商品。` : "這個分類目前還沒有上架商品。";
}

function productImage(product) {
  const imageUrl = productImageUrls(product)[0];
  if (imageUrl) return `<img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(product.name)}" loading="lazy" />`;
  return `<img src="data:image/svg+xml,${encodeURIComponent(placeholderSvg())}" alt="${escapeAttr(product.name)}" />`;
}

function productImageUrls(product) {
  const urls = Array.isArray(product?.imageUrls) ? product.imageUrls : [];
  return [...new Set([...urls, product?.imageUrl].map((url) => String(url || "").trim()).filter(Boolean))].slice(0, 10);
}

function selectDialogImage(product, index) {
  const urls = productImageUrls(product);
  const selectedIndex = Math.max(0, Math.min(index, urls.length - 1));
  const selectedUrl = urls[selectedIndex] || `data:image/svg+xml,${encodeURIComponent(placeholderSvg())}`;
  const image = document.getElementById("dialogImage");
  image.src = selectedUrl;
  image.alt = urls.length > 1 ? `${product.name}，照片 ${selectedIndex + 1}` : product.name;
  document.querySelectorAll("[data-dialog-image]").forEach((button) => button.classList.toggle("active", Number(button.dataset.dialogImage) === selectedIndex));
}

function placeholderSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="100%" height="100%" fill="#f3dfcf"/><circle cx="300" cy="270" r="120" fill="#c99570"/><circle cx="220" cy="155" r="55" fill="#c99570"/><circle cx="380" cy="155" r="55" fill="#c99570"/><circle cx="260" cy="250" r="10"/><circle cx="340" cy="250" r="10"/><path d="M275 305 Q300 325 325 305" stroke="#3d332d" stroke-width="10" fill="none" stroke-linecap="round"/><text x="300" y="470" text-anchor="middle" font-family="sans-serif" font-size="32" fill="#8b684f">KOREA PICK</text></svg>`;
}

function openProduct(id) {
  if (state.settings.saleClosed) return updateSaleClosedState();
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  state.selectedProduct = product;
  const imageUrls = productImageUrls(product);
  document.getElementById("dialogImageThumbnails").innerHTML = imageUrls.length > 1 ? imageUrls.map((url, index) => `<button type="button" data-dialog-image="${index}" aria-label="查看第 ${index + 1} 張照片"><img src="${escapeAttr(url)}" alt="" /></button>`).join("") : "";
  selectDialogImage(product, 0);
  document.getElementById("dialogCategory").textContent = product.category || "韓國小物";
  document.getElementById("dialogName").textContent = product.name;
  document.getElementById("dialogTwd").textContent = `售價 NT$${formatNumber(product.priceTwd)}`;
  document.getElementById("dialogDescription").textContent = product.description || "韓國旅途中現場代購商品";
  const variants = Array.isArray(product.variants) ? product.variants : parseVariants(product.variants);
  document.getElementById("variantField").hidden = variants.length === 0;
  document.getElementById("dialogVariant").innerHTML = variants.map((variant) => `<option>${escapeHtml(variant)}</option>`).join("");
  document.getElementById("dialogQty").value = "1";
  document.getElementById("productDialog").showModal();
}

function addSelectedProduct() {
  if (state.settings.saleClosed) return updateSaleClosedState();
  const product = state.selectedProduct;
  if (!product) return;
  const variant = document.getElementById("variantField").hidden ? "" : document.getElementById("dialogVariant").value;
  const qty = Number(document.getElementById("dialogQty").value) || 1;
  addProductToCart(product, variant, qty);
  document.getElementById("productDialog").close();
}

function quickAddProduct(id) {
  if (state.settings.saleClosed) return updateSaleClosedState();
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  const variants = Array.isArray(product.variants) ? product.variants : parseVariants(product.variants);
  if (variants.length) return openProduct(id);
  addProductToCart(product, "", 1);
}

function addProductToCart(product, variant, qty) {
  const existing = state.cart.find((item) => item.productId === product.id && item.variant === variant);
  if (existing) existing.qty += qty;
  else state.cart.push({ productId: product.id, variant, qty });
  updateCart();
  showToast(`已加入 ${qty} 件商品`);
}

function updateCart() {
  const qty = state.cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById("cartDock").hidden = state.settings.saleClosed || qty === 0 || !document.getElementById("ordersView").hidden;
  document.getElementById("cartQty").textContent = qty;
  document.getElementById("cartDeposit").textContent = `NT$${formatNumber(getTotals().depositTotal)}`;
}

function getTotals() {
  let qty = 0;
  let estimatedTotal = 0;
  state.cart.forEach((item) => {
    const product = state.products.find((entry) => entry.id === item.productId);
    if (!product) return;
    qty += item.qty;
    estimatedTotal += Number(product.priceTwd || 0) * item.qty;
  });
  const depositTotal = calculateDeposit(estimatedTotal);
  return { qty, estimatedTotal, depositTotal, balanceTotal: estimatedTotal - depositTotal };
}

function calculateDeposit(amount) {
  return Math.ceil(Number(amount || 0) * Number(state.settings.depositPercent || 50) / 100);
}

function openCheckout() {
  if (state.settings.saleClosed) return updateSaleClosedState();
  renderCheckout();
  document.getElementById("checkoutDialog").showModal();
}

function renderCheckout() {
  document.getElementById("checkoutItems").innerHTML = state.cart.map((item, index) => {
    const product = state.products.find((entry) => entry.id === item.productId);
    if (!product) return "";
    const image = productImageUrls(product)[0] || `data:image/svg+xml,${encodeURIComponent(placeholderSvg())}`;
    return `<div class="checkout-item"><img src="${escapeAttr(image)}" alt="" /><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(item.variant || "單一款式")}・${item.qty} 件・NT$${formatNumber(Number(product.priceTwd || 0) * item.qty)}</small></div><button class="remove-item" type="button" data-remove="${index}">移除</button></div>`;
  }).join("");
  const totals = getTotals();
  document.getElementById("estimatedTotal").textContent = `NT$${formatNumber(totals.estimatedTotal)}`;
  document.getElementById("depositTotal").textContent = `NT$${formatNumber(totals.depositTotal)}`;
  document.getElementById("balanceTotal").textContent = `NT$${formatNumber(totals.balanceTotal)}`;
}

async function submitOrder(event) {
  event.preventDefault();
  if (state.settings.saleClosed) return updateSaleClosedState();
  if (!CONFIG.apiUrl) return showToast("尚未設定 GAS API，現在是版面預覽模式");
  if (!state.line.idToken) return showToast("請從 LINE 開啟此頁並完成登入");
  const button = document.getElementById("submitOrder");
  button.disabled = true;
  button.textContent = "正在送出預購…";
  try {
    const payload = {
      action: "createPreorder",
      idToken: state.line.idToken,
      lineDisplayName: state.line.displayName,
      customerName: document.getElementById("customerName").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      note: document.getElementById("note").value.trim(),
      items: state.cart.map((item) => ({ productId: item.productId, variant: item.variant, qty: item.qty })),
    };
    payload.requestId = getOrCreateOrderRequestId(payload);
    const result = await apiPost(payload);
    if (!result.ok) throw new Error(result.error || "ORDER_FAILED");
    clearPendingOrderRequest();
    state.cart = [];
    updateCart();
    document.getElementById("checkoutDialog").close();
    document.getElementById("orderForm").reset();
    alert(result.botMessageSent
      ? `訂單已成立！\n訂單編號：${result.orderNo}\n訂單小卡已傳送到鼠購易 LINE 對話；如需匯款，請按小卡下方的「匯款資訊」。`
      : `訂單已成立！\n訂單編號：${result.orderNo}\n小卡暫時未送達，請直接聯絡鼠購易確認匯款資訊。`);
    await showMyOrders();
  } catch (error) {
    console.error(error);
    const messages = {
      SALE_CLOSED: "本次連線已結束，暫停接受新訂單",
      PRODUCT_CHANGED: "商品資訊已更新，請重新整理後再送出",
      LINE_TOKEN_INVALID: "LINE 登入已過期，請關閉頁面後從 LINE 重新開啟",
      LINE_LOGIN_REQUIRED: "請從 LINE 開啟此頁並完成登入",
      LINE_CONFIG_MISSING: "LINE 登入設定尚未完成，請聯絡管理員",
      INVALID_CUSTOMER: "請確認姓名與手機號碼皆已正確填寫",
      INVALID_ITEMS: "購物車內容有誤，請重新選擇商品",
      INVALID_ORDER_REQUEST_ID: "訂單識別碼異常，請重新整理後再送出",
      ORDER_REQUEST_CONFLICT: "這次送單識別碼發生衝突，請重新整理後再試",
      OUT_OF_STOCK: "商品庫存不足，請重新整理商品後再送出",
      LOCK_TIMEOUT: "目前同時下單人數較多，請稍候再按一次送出；系統會使用同一識別碼避免重複訂單",
      ORDER_WRITE_FAILED: "訂單未完整寫入，系統已回滾；請稍候再按一次送出",
      SPREADSHEET_CONFIG_MISSING: "訂單系統尚未連接試算表，請聯絡管理員",
      SERVER_ERROR: "訂單系統暫時發生錯誤，請聯絡管理員",
    };
    if (error.message === "LINE_TOKEN_INVALID" && restartLineLogin()) {
      return;
    } else if (error.message === "SALE_CLOSED") {
      state.settings.saleClosed = true;
      updateSaleClosedState();
    } else {
      showToast(messages[error.message] || `送出失敗（${error.message || "網路連線異常"}）`);
    }
  } finally {
    button.disabled = false;
    button.textContent = "先送出預購訂單";
  }
}

function getOrCreateOrderRequestId(payload) {
  const fingerprint = JSON.stringify({
    customerName: payload.customerName,
    phone: payload.phone,
    note: payload.note,
    items: payload.items,
  });
  let pending = state.pendingOrderRequest;
  if (!pending) {
    try { pending = JSON.parse(sessionStorage.getItem(PENDING_ORDER_REQUEST_KEY) || "null"); }
    catch (error) { pending = null; }
  }
  if (
    pending &&
    pending.fingerprint === fingerprint &&
    /^ORDER-\d{8}-\d{6}-[A-Z0-9]{8,32}$/.test(String(pending.requestId || ""))
  ) {
    state.pendingOrderRequest = pending;
    return pending.requestId;
  }
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const bytes = new Uint8Array(8);
  if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  const random = Array.from(bytes, (value) => value.toString(36).toUpperCase().padStart(2, "0")).join("").slice(0, 16);
  pending = { requestId: `ORDER-${stamp}-${random}`, fingerprint };
  state.pendingOrderRequest = pending;
  try { sessionStorage.setItem(PENDING_ORDER_REQUEST_KEY, JSON.stringify(pending)); }
  catch (error) { console.warn("Unable to persist pending order request", error); }
  return pending.requestId;
}

function clearPendingOrderRequest() {
  state.pendingOrderRequest = null;
  try { sessionStorage.removeItem(PENDING_ORDER_REQUEST_KEY); }
  catch (error) { console.warn("Unable to clear pending order request", error); }
}

function updateSaleClosedState() {
  const dialog = document.getElementById("saleClosedDialog");
  const viewingOrders = !document.getElementById("ordersView").hidden;
  document.getElementById("saleClosedNotice").textContent = state.settings.saleClosedNotice || "本次連線已結束，謝謝大家的支持！";
  document.getElementById("cartDock").hidden = Boolean(state.settings.saleClosed) || state.cart.length === 0;
  if (state.settings.saleClosed && !viewingOrders) {
    ["productDialog", "checkoutDialog"].forEach((id) => {
      const openDialog = document.getElementById(id);
      if (openDialog.open) openDialog.close();
    });
    if (!dialog.open) dialog.showModal();
  } else if (dialog.open) {
    dialog.close();
  }
}

async function showMyOrders() {
  showOrdersLoading();
  const status = document.getElementById("ordersStatus");
  const list = document.getElementById("orderList");
  if (!CONFIG.apiUrl || !state.line.idToken) {
    status.textContent = "請從 LINE 開啟正式預購頁，即可查看自己的訂單。";
    return;
  }
  try {
    const result = Array.isArray(state.myOrders)
      ? { ok: true, orders: state.myOrders }
      : await apiPost({ action: "readMyPreorders", idToken: state.line.idToken });
    if (!result.ok || !Array.isArray(result.orders)) throw new Error(result.error || "READ_FAILED");
    state.myOrders = result.orders;
    if (!result.orders.length) { status.textContent = "目前還沒有預購紀錄。"; return; }
    status.hidden = true;
    list.innerHTML = result.orders.map(renderOrder).join("");
  } catch (error) {
    const messages = {
      LINE_TOKEN_INVALID: "LINE 登入已過期，請重新登入後再試。",
      LINE_LOGIN_REQUIRED: "尚未取得 LINE 登入資訊，請重新登入後再試。",
      LINE_CONFIG_MISSING: "LINE 登入設定尚未完成，請聯絡管理員。",
      SERVER_ERROR: "訂單系統暫時發生錯誤，請稍後再試。",
    };
    status.textContent = messages[error.message] || `目前無法讀取訂單（${error.message || "READ_FAILED"}）。`;
  }
}

function showOrdersLoading() {
  const saleClosedDialog = document.getElementById("saleClosedDialog");
  if (saleClosedDialog.open) saleClosedDialog.close();
  document.getElementById("catalogView").hidden = true;
  document.getElementById("ordersView").hidden = false;
  document.getElementById("cartDock").hidden = true;
  const status = document.getElementById("ordersStatus");
  const list = document.getElementById("orderList");
  list.innerHTML = "";
  status.hidden = false;
  status.textContent = "正在讀取我的預購…";
}

async function showCatalog() {
  document.getElementById("catalogView").hidden = false;
  document.getElementById("ordersView").hidden = true;
  updateCart();
  if (!state.catalogReady) await ensureCatalogLoaded();
  if (state.settings.saleClosed) updateSaleClosedState();
}

function renderOrder(order) {
  const mallReady = Boolean(order.mallPaymentDueText);
  const displayStatus = order.mallPaymentExpired ? "賣場付款已逾期" : (mallReady ? "賣場已開設" : (order.status || "待人工確認"));
  const depositLabel = order.status === "待收訂金"
    ? "應付訂金"
    : order.status === "待確認訂金"
      ? "已回報訂金"
      : "已付訂金";
  const mallAction = mallReady
    ? `<div class="mall-payment">${order.mallPaymentExpired
      ? `<p class="mall-payment-expired">付款期限為 ${escapeHtml(order.mallPaymentDueText)}，如仍需購買請聯絡客服。</p>`
      : `<p>請於 ${escapeHtml(order.mallPaymentDueText)} 前完成付款</p>${order.iopenMallUrl ? `<a class="payment-action" href="${escapeAttr(order.iopenMallUrl)}" target="_blank" rel="noopener noreferrer">前往 iOPEN Mall 賣場</a>` : ""}`}</div>`
    : "";
  const shortageNotice = order.shortageAdjustedAt
    ? `<div class="order-shortage-notice"><strong>已完成缺貨調整</strong><span>原總額 NT$${formatNumber(order.originalEstimatedTotal)} → 調整後 NT$${formatNumber(order.estimatedTotal)}</span>${Number(order.cashRefundDue || 0) > 0 ? `<span>${order.cashRefundedAt ? "已退現金" : order.status === "已取消" ? "待退款" : "出貨時待退現金"} NT$${formatNumber(order.cashRefundDue)}</span>` : ""}</div>`
    : "";
  const paymentReport = order.status === "待確認訂金"
      ? `<div class="payment-report-complete"><strong>已回報匯款後五碼 ${escapeHtml(order.transferLast5 || "")}</strong><span>${escapeHtml(order.paymentReportedAt || "等待管理員核帳")}</span></div>`
      : "";
  return `<article class="order-card"><div class="order-card-header"><div><h3>${escapeHtml(order.orderNo)}</h3><time>${escapeHtml(order.createdAt)}</time></div><span class="order-status ${order.mallPaymentExpired ? "overdue" : ""}">${escapeHtml(displayStatus)}</span></div><pre>${escapeHtml(order.itemsSummary || "品項已全數取消")}</pre>${shortageNotice}<div class="order-money"><div><span>商品總額</span><strong>NT$${formatNumber(order.estimatedTotal)}</strong></div><div><span>${depositLabel}</span><strong>NT$${formatNumber(order.depositTotal)}</strong></div><div><span>後續應付</span><strong>NT$${formatNumber(order.estimatedBalance)}</strong></div></div>${paymentReport}${mallAction}</article>`;
}

async function apiPost(payload) {
  const response = await fetch(`${CONFIG.apiUrl}?t=${Date.now()}`, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
  return response.json();
}

function parseVariants(value) { return String(value || "").split(/[、,\n]/).map((item) => item.trim()).filter(Boolean); }
function formatNumber(value) { return Number(value || 0).toLocaleString("zh-TW"); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }
function escapeAttr(value) { return escapeHtml(value).replace(/'/g, "&#39;"); }
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}
