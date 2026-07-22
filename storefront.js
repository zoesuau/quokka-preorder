const CONFIG = window.QUOKKA_CONFIG || {};
window.QUOKKA_APP_VERSION = "20260722-line-runtime";
const state = {
  products: [],
  settings: { preorderNotice: "", bankTransferInfo: "", saleClosed: false, saleClosedNotice: "本次連線已結束，謝謝大家的支持！" },
  category: "全部",
  cart: [],
  selectedProduct: null,
  line: { idToken: "", userId: "", displayName: "" },
  myOrders: null,
};

const demoProducts = [
  { id: "demo-1", name: "矮袋鼠造型鑰匙圈", category: "吊飾", imageUrl: "", priceTwd: 330, variants: ["QUOKKA", "BOBO"], description: "韓國現場預購示意商品", active: true, sortOrder: 1 },
  { id: "demo-2", name: "矮袋鼠便利貼組", category: "文具", imageUrl: "", priceTwd: 190, variants: [], description: "韓國現場預購示意商品", active: true, sortOrder: 2 },
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  document.getElementById("brandName").textContent = CONFIG.brandName || "袋著走";
  bindEvents();
  try {
    await loadCatalog();
  } catch (error) {
    if (error?.message !== "API_URL_NOT_CONFIGURED") console.error(error);
    useDemoCatalog();
  }
  if (state.settings.saleClosed) return;
  try {
    await initLine();
  } catch (error) {
    setLineStatus(error?.message || "LIFF_INIT_FAILED");
    console.error(error);
  }
}

function bindEvents() {
  document.getElementById("saleClosedDialog").addEventListener("cancel", (event) => event.preventDefault());
  document.getElementById("addToCart").addEventListener("click", addSelectedProduct);
  document.getElementById("openCheckout").addEventListener("click", openCheckout);
  document.getElementById("orderForm").addEventListener("submit", submitOrder);
  document.getElementById("myOrdersButton").addEventListener("click", showMyOrders);
  document.getElementById("backToCatalog").addEventListener("click", showCatalog);
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
  if (!CONFIG.liffId) return;
  setLineStatus("initializing");
  const lineRuntime = window.QuokkaLineRuntime;
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
  const lineRuntime = window.QuokkaLineRuntime;
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
  return `${location.origin}${location.pathname}`;
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
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || !data.ok || !Array.isArray(data.products)) throw new Error(data.error || "CATALOG_LOAD_FAILED");
  state.products = data.products.filter((product) => product.active);
  state.settings = { ...state.settings, ...(data.settings || {}) };
  renderCatalog();
  updateSaleClosedState();
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

  const visible = state.category === "全部" ? state.products : state.products.filter((product) => product.category === state.category);
  document.getElementById("productCount").textContent = `${visible.length} 件商品`;
  document.getElementById("preorderNotice").textContent = state.settings.preorderNotice || "商品下訂後才會採購。下單先付商品總額的 50% 訂金，回國後再支付剩餘商品款。";
  const grid = document.getElementById("productGrid");
  grid.innerHTML = visible.map((product) => {
    return `<article class="product-card" role="button" tabindex="0" aria-label="查看 ${escapeAttr(product.name)}" data-product-id="${escapeAttr(product.id)}">
      ${productImage(product)}
      <div class="product-card-body"><span class="category-label">${escapeHtml(product.category || "韓國小物")}</span>
      <h3>${escapeHtml(product.name)}</h3><p class="price">NT$${formatNumber(product.priceTwd)}</p><small>訂金 50%</small></div>
    </article>`;
  }).join("");
  grid.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", () => openProduct(card.dataset.productId));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openProduct(card.dataset.productId);
    });
  });
  document.getElementById("catalogStatus").hidden = visible.length > 0;
  if (!visible.length) document.getElementById("catalogStatus").textContent = "這個分類目前還沒有上架商品。";
}

function productImage(product) {
  if (product.imageUrl) return `<img src="${escapeAttr(product.imageUrl)}" alt="${escapeAttr(product.name)}" loading="lazy" />`;
  return `<img src="data:image/svg+xml,${encodeURIComponent(placeholderSvg())}" alt="${escapeAttr(product.name)}" />`;
}

function placeholderSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="100%" height="100%" fill="#f3dfcf"/><circle cx="300" cy="270" r="120" fill="#c99570"/><circle cx="220" cy="155" r="55" fill="#c99570"/><circle cx="380" cy="155" r="55" fill="#c99570"/><circle cx="260" cy="250" r="10"/><circle cx="340" cy="250" r="10"/><path d="M275 305 Q300 325 325 305" stroke="#3d332d" stroke-width="10" fill="none" stroke-linecap="round"/><text x="300" y="470" text-anchor="middle" font-family="sans-serif" font-size="32" fill="#8b684f">KOREA PICK</text></svg>`;
}

function openProduct(id) {
  if (state.settings.saleClosed) return updateSaleClosedState();
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  state.selectedProduct = product;
  const image = document.getElementById("dialogImage");
  image.src = product.imageUrl || `data:image/svg+xml,${encodeURIComponent(placeholderSvg())}`;
  image.alt = product.name;
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
  const existing = state.cart.find((item) => item.productId === product.id && item.variant === variant);
  if (existing) existing.qty += qty;
  else state.cart.push({ productId: product.id, variant, qty });
  document.getElementById("productDialog").close();
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
  const depositTotal = Math.round(estimatedTotal * 0.5);
  return { qty, estimatedTotal, depositTotal, balanceTotal: estimatedTotal - depositTotal };
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
    const image = product.imageUrl || `data:image/svg+xml,${encodeURIComponent(placeholderSvg())}`;
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
    const result = await apiPost(payload);
    if (!result.ok) throw new Error(result.error || "ORDER_FAILED");
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

function updateSaleClosedState() {
  const dialog = document.getElementById("saleClosedDialog");
  document.getElementById("saleClosedNotice").textContent = state.settings.saleClosedNotice || "本次連線已結束，謝謝大家的支持！";
  document.getElementById("cartDock").hidden = Boolean(state.settings.saleClosed) || state.cart.length === 0;
  if (state.settings.saleClosed) {
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
  document.getElementById("catalogView").hidden = true;
  document.getElementById("ordersView").hidden = false;
  document.getElementById("cartDock").hidden = true;
  const status = document.getElementById("ordersStatus");
  const list = document.getElementById("orderList");
  list.innerHTML = "";
  status.hidden = false;
  status.textContent = "正在讀取我的預購…";
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

function showCatalog() {
  document.getElementById("catalogView").hidden = false;
  document.getElementById("ordersView").hidden = true;
  updateCart();
}

function renderOrder(order) {
  return `<article class="order-card"><div class="order-card-header"><div><h3>${escapeHtml(order.orderNo)}</h3><time>${escapeHtml(order.createdAt)}</time></div><span class="order-status">${escapeHtml(order.status || "待人工確認")}</span></div><pre>${escapeHtml(order.itemsSummary)}</pre><div class="order-money"><div><span>商品總額</span><strong>NT$${formatNumber(order.estimatedTotal)}</strong></div><div><span>本次訂金（50%）</span><strong>NT$${formatNumber(order.depositTotal)}</strong></div><div><span>回國後商品款</span><strong>NT$${formatNumber(order.estimatedBalance)}</strong></div></div></article>`;
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
