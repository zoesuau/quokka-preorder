# 鼠購易｜韓國小物預購

獨立於原梨子訂購系統的 LIFF + Google Apps Script 預購專案。

## 已完成

- 手機優先的兩欄商品頁、分類與款式選擇
- 商品可輸入韓幣售價並依共用費率、固定加價自動計算台幣售價，台幣售價仍可手動調整
- 分類會記住既有商品資料，可由下拉選單直接選取或新增分類
- 每項商品可上傳最多 10 張照片並指定封面；前台商品詳情可切換瀏覽
- 商品可設定庫存數量；儲存為 0 時會自動下架，缺貨商品不顯示於前台
- 訂單取消會在同一個 Script Lock 內回補有限庫存；重複取消不會再次回補，售罄商品回補後重新上架
- 訂金比例、提醒時間、正式付款期限與內部寬限時間可由系統設定調整
- 支援部署層級的單一訂單流程：既有 iOPEN Mall 訂金模式，或 7-11 店到店全額付款模式
- 7-11 模式每張訂單固定加收 NT$60 運費，分開下單不合併運費；前台必填取件人真實姓名、電話、六位店號與店名
- 7-11 模式由管理員確認全款入帳，訂單依序進入待寄出、已寄出與完成；已寄出不要求填寫編號
- 全額付款後若採買缺貨，可在寄出前取消部分品項並列出待退款；仍有商品保留運費，全數取消才退商品與運費
- 訂單小卡不顯示帳號；客戶按「匯款資訊」後會送出 LINE 文字訊息，由管理方回覆
- 後台可一鍵停賣，前台以遮罩顯示「本次連線已結束」公告，後端同步停止收單
- LINE 身分驗證、預購送單與顯示全部歷史訂單的「我的預購」
- 賣場開設後顯示 iOPEN Mall 連結，付款期限日數可由系統設定調整
- 手機商品後台：拍照／相簿上傳、建立、編輯，並可從商品卡片直接調整庫存與上下架
- 獨立系統設定頁：前台內容、共用計價、訂金規則、iOPEN Mall、停賣公告與後台登入碼
- 已收訂金訂單可取消缺貨品項，保留原始金額與調整紀錄，並自動計算後續應付或出貨時待退現金
- 待收訂金與已收到訂金可由後台編輯／調整商品；保留最近異動、完整歷史與 LINE 訂單資訊卡片
- LINE Webhook 訊息警示：顧客傳送文字、圖片或檔案時，後台標示待核對並暫停逾期自動取消
- 本次不提供顧客匯款回報頁；LINE 訊息只在粉紅色待收訂金卡片進入人工核對，管理員確認入帳後直接改為「已收到訂金」
- 訂金正式期限為 24 小時，系統內部保留 1 小時寬限；提醒只在第 12～24 小時由管理員手動發送
- iOPEN Mall 逾期只在前後台標示待確認，不自動取消或發送結案通知
- LINE 訂單通知統一使用訂購系統色系的 Flex Message 卡片
- GAS 伺服器端重新驗證商品、款式與金額
- Google Sheet 商品及預購紀錄
- 後台可下載完整訂單 CSV，並依 LINE User ID（缺少時以電話）去重匯出客戶資料；匯出前會重新驗證管理員且不受畫面篩選影響

## 檔案

- `index.html`：客戶預購頁
- `storefront.js`：前台互動程式；`index.html` 會先載入官方 LIFF SDK
- `app.js`：舊版內嵌 LIFF SDK 發布檔，僅保留作為既有部署參考
- `admin.html`：手機商品後台
- `stress-test.html`：不連入正式導覽的安全訂單併發壓力測試頁
- `stress-test.js`、`stress-test.css`：壓測安全握手、併發送出、統計、驗收與專用樣式
- `config.js`：GAS API 與 LIFF ID
- `Code.gs`：Google Apps Script 後端
- `webhook-worker/`：驗證 LINE Webhook 簽章並安全轉送至 GAS 的中央入口
- `TODO.md`：後續 OA／Postback、客服與 CRM 開發規劃

## 部署

1. 建立一份 Google Sheet，開啟「擴充功能 → Apps Script」。
2. 將 `Code.gs` 貼入 Apps Script，執行一次 `setupQuokkaPreorder()` 並授權。
3. 在 Apps Script「專案設定 → 指令碼屬性」加入：
   - `LINE_CHANNEL_ID`：LINE Login Channel ID。
   - `ADMIN_LINE_USER_IDS`：管理員 LINE User ID；多個以逗號分隔。
   - `SPREADSHEET_ID`：只有使用獨立 Apps Script 專案時需要。
   - `WEBHOOK_FORWARDING_SECRET`：Webhook Worker 與 GAS 共用的高強度隨機密鑰。
   - `ORDER_FLOW_MODE`：此部署的訂單流程；新客戶設為 `seven_eleven_full`，未填時維持既有 `mall_deposit`。
   - `SHIPPING_FEE_TWD`：7-11 模式每張訂單運費；本次設為 `60`。
4. 部署為網頁應用程式：執行身分選擇自己，存取權選擇所有人。
5. 建立前台 LINE LIFF App，Endpoint URL 指向部署後的 `index.html`；建議再建立一個後台 LIFF App 指向 `admin.html`。
6. 將 GAS `/exec` 網址、前台 LIFF ID 與後台 LIFF ID 填入 `config.js`。
7. 將前端檔案發布到 HTTPS 靜態網站；管理頁網址為 `admin.html`。
8. 依照 `webhook-worker/README.md` 部署 LINE Webhook 中樞，再將 Worker 網址填入 LINE Developers。

## 試算表

第一次執行設定會建立：

- `Products`：商品名稱、分類、最多 10 張圖片、台幣售價、款式、庫存、狀態與排序。
- `Preorders`：預購人、商品明細、付款資料，以及成立時鎖定的流程模式、取件資料、運費與付款期限。新版欄位只會附加在既有欄位之後。
- `OrderRequestIds`：正式送單 requestId、訂單編號、LINE 使用者與 payload 雜湊；用於逾時重送冪等保護，不改動 `Preorders` 既有格式。
- `Settings`：前台說明、共用計價、訂金／付款規則、停賣公告和 iOPEN Mall 設定。舊匯款欄位只保留備份，不再顯示或提供前台使用。
- `LineInboundEvents`：Webhook 收到的最少必要訊息事件、訂單配對與人工核對狀態。

訂單狀態可直接在 `Preorders` 的 `status` 欄人工修改。回國後將 iOPEN Mall 連結透過 LINE 通知客人，請客人在商城訂單備註填預購編號以便核對。

訂單流程由部署者以 Script Property 選定，賣家後台不提供自行切換，以免同一部署的付款、物流與通知規則混用。新客戶的 7-11 全款模式設為 `ORDER_FLOW_MODE=seven_eleven_full`；未來同店多物流／多付款組合已另列在 `TODO.md`，本版不開放混搭。

缺貨時請從後台訂單卡片使用「取消缺貨品項」，不要直接修改試算表中的商品金額或訂金。一般訂單異動請使用粉紅卡的「編輯訂單」或藍／黃卡的「調整訂單」；紅色賣場卡只保留缺貨調整。第一次執行新版 `setupQuokkaPreorder()` 會自動補上原始訂單、缺貨調整、訂單調整歷史、版本、通知與退款相關欄位。

## 驗證

- `node tests/order-adjustment.test.js`：驗證訂金重算、保留已回報／已收訂金、溢付、狀態限制、下架商品、重複送出與同時修改保護。
- `node tests/product-card-controls.test.js`：驗證商品卡片的庫存快選、自訂數量、上下架控制與觸控尺寸契約。
- `node tests/line-notification-style.test.js`：驗證成立、付款提醒、收到訂金、賣場按鈕與取消卡片的 LINE Flex Message 樣式。
- `node tests/seven-eleven-full-payment.test.js`：驗證 7-11 全款、每單運費、取件欄位、取消退款及前後台入口。
- `node tests/stress-test.test.js`：驗證壓測開關、獨立工作表、假資料限制、冪等性及正式訂單／商品隔離。
- `node tests/stress-test-ui.test.js`：驗證 20 筆上限、測試 payload、重複請求及安全握手限制。
- `node tests/admin-export.test.js`：驗證訂單完整匯出、客戶去重統計、管理員驗證與 CSV 公式注入防護。
- `tests/run-live-formal-simulation.js`：只供人工授權後，對隔離 GAS 測試部署執行 1–20 筆正式流程模擬；不得指向正式部署。
- `LOAD_TEST_REPORT_2026-08-01.md`：2026-08-01 的 5／10／20 筆正式流程隔離模擬結果與安全核對。
- `tests/order-adjustment-preview.html`：訂單卡片及調整視窗的安全假資料視覺檢查頁。

## 預覽模式

`config.js` 尚未填 API 時，前台會顯示兩個示意商品，方便先確認版面；預覽模式不會送出訂單。後台必須完成 GAS 與 LIFF 設定後才能進入。

## 安全訂單併發壓力測試

### 安全原則

- `stress-test.html` 沒有出現在正式首頁、後台、導覽列或公開選單。
- 頁面不載入 `config.js`，GAS URL 預設空白，避免自動指向正式部署。
- 後端預設停用壓測。只有 Script Property `ENABLE_STRESS_TEST_MODE` 精確設為 `true` 時才接受測試。
- 第一筆測試訂單前會先執行 `stressTestHandshake`；舊版或未啟用的 GAS 不會收到 `createPreorder` 測試請求。
- 測試訂單只寫入 `壓力測試訂單`，編號以 `TEST-` 開頭，不驗證或使用真實 LINE token。
- 測試路徑不呼叫 LINE API、不寫入 `Preorders`、不修改 `Products`，也不加入付款、催款、取消或出貨排程。
- 「正式流程模擬」另寫入 `正式流程模擬訂單`，沿用正式 30 秒 Script Lock、設定／停賣判斷、商品價格、訂金計算及 `createOrderNo_` 編號產生器；模擬主鍵加上 `SIM-`，不建立真正的 `QK...` 訂單。
- 正式流程模擬固定把可用庫存設為 1；只有第一筆建立，後續請求必須明確回 `OUT_OF_STOCK`。它不會真的扣除 `Products`。
- 每批使用 `Promise.allSettled` 同時送出，總筆數硬性限制為 20，沒有循環或自動重跑。

### 本機檢查

在專案根目錄執行：

```bash
node --check stress-test.js
node tests/stress-test.test.js
node tests/stress-test-ui.test.js
node tests/order-adjustment.test.js
node tests/product-inventory.test.js
node tests/public-catalog-cache.test.js
node tests/serve-stress-test.js
```

瀏覽 `http://127.0.0.1:8080/stress-test.html` 可檢查頁面。沒有安全握手通過時，頁面不會送出測試訂單。

### GAS 測試部署

1. 複製正式 Google Sheet，明確命名為壓力測試用副本；不要讓測試 GAS 指向正式試算表。
2. 建立獨立 Apps Script 測試專案，貼入本分支的 `Code.gs`。
3. 在測試專案 Script Properties 設定副本的 `SPREADSHEET_ID`。
4. 在測試專案 Script Properties 新增 `ENABLE_STRESS_TEST_MODE=true`。
5. 不要在測試專案設定 `LINE_MESSAGING_ACCESS_TOKEN`；測試路徑雖不會使用，留空可增加第二層保護。
6. 執行一次 `setupQuokkaPreorder()`，確認副本具有 `Products`、`Preorders`、`OrderRequestIds` 與 `Settings`。
7. 將 Apps Script 部署為新的 Web App 測試版本，取得獨立 `/exec` URL。
8. 不要更新正式 `config.js`，也不要覆蓋目前正式 Web App 部署。

若只更新既有測試部署，必須建立「新版本」再更新測試 deployment；不要編輯或重新部署正式 deployment。

### 執行步驟

1. 開啟未公開連結的 `stress-test.html`。
2. 貼上獨立 GAS 測試部署 `/exec` URL。
3. 先按「測試重複請求」，確認兩個回應皆成功、其中一個為 `duplicate:true`，工作表只新增一列。
4. 依序執行 5、10、20 筆；併發選項也依序選擇 5、10、20。
5. 每次檢查詳細表格、HTTP 狀態、後端內容、耗時與驗收清單。
6. GAS 限制、逾時、非 JSON、`success:false` 或缺少 `testMode:true` 都必須顯示為失敗；不得只看 HTTP 200。
7. 完成後到測試試算表核對 `壓力測試訂單` 的實際資料列。
8. 按「正式流程模擬（庫存上限 1）」後，應只有一筆建立成功，其餘明確顯示 `OUT_OF_STOCK`；再核對正式編號候選值與正式請求冪等性。

「停止後續批次」只會阻止尚未開始的下一批；已送到 GAS 的 HTTP 請求不能由瀏覽器撤回。

### 驗收案例

- 案例 A，同時 5 筆：成功 5 筆、測試表新增 5 列、無重複編號、通知數為 0。
- 案例 B，同時 10 筆：成功 10 筆、測試表新增 10 列、無漏單、`Products` 快照不變。
- 案例 C，同時 20 筆：逐筆記錄成功、失敗與耗時；GAS 限制造成的錯誤必須出現在詳細結果，不得靜默漏單。
- 案例 D，相同 `testRequestId` 同時兩筆：兩個 HTTP 回應皆成功，其中一筆 `duplicate:true`，測試表只新增一列。
- 案例 E，GAS 寫入失敗：前端顯示失敗及後端錯誤，不列入成功數。
- 案例 F，後端未進入 testMode：安全握手失敗時不送訂單；執行中若回應缺少 `testMode:true`，停止後續批次並顯示警告。
- 案例 G，正式流程模擬：只新增 `正式流程模擬訂單`；`Preorders`、`Products` 與 LINE 必須不變，並明確顯示正式流程是否已有庫存扣減與請求冪等鍵。

每次測試最後還會比對握手前後的 `Preorders` 與 `Products` 列數及內容雜湊。獨立測試環境中若有其他人同時修改這兩張表，驗收會保守判定失敗，需排除外部變更後重跑。

### 清除測試資料

1. 先確認目前開啟的是測試試算表副本。
2. 完成證據保存後，可刪除整張 `壓力測試訂單` 或 `正式流程模擬訂單` 工作表；下次測試會自動重建表頭。
3. 或保留表頭，只刪除第 2 列之後的測試資料。
4. 將測試 Apps Script 的 `ENABLE_STRESS_TEST_MODE` 改為 `false` 或刪除該屬性。
5. 不再使用時，封存或刪除測試 Web App deployment；不要刪除正式 deployment。

### 確認沒有影響正式訂單

- 壓測頁驗收必須顯示「正式訂單資料無異動」與「正式庫存／商品資料無異動」。
- 測試試算表的 `Preorders` 列數與內容雜湊在測試前後必須一致。
- `Products` 列數、庫存及內容雜湊在測試前後必須一致。
- `壓力測試訂單` 的 `notificationsSent`、`inventoryMutated`、`formalOrderCreated` 必須全部為 `FALSE`。
- 一般壓測編號只能以 `TEST-` 開頭；正式流程模擬主鍵只能以 `SIM-QK` 開頭，`QK...` 只能存在隔離表的候選值欄位，不得寫入 `Preorders`。
- `正式流程模擬訂單` 的 `notificationSent`、`inventoryMutated`、`formalOrderCreated` 必須全部為 `FALSE`。
- LINE OA 對話與管理員通知應無任何壓測訊息。

### 回滾

程式尚未部署時，直接停止使用或刪除 `feature/load-testing` 分支即可，正式環境不受影響。若已建立測試部署：

1. 將 `ENABLE_STRESS_TEST_MODE` 關閉。
2. 封存或刪除測試 deployment。
3. 切回部署前的 Apps Script 版本；不要動正式 deployment。
4. 測試資料只存在試算表副本的 `壓力測試訂單` 與 `正式流程模擬訂單`，可依上述方式清除。

若未來另行核准把此程式部署到正式 GAS，回滾時應重新部署前一個已驗證版本；測試功能預設仍因沒有 `ENABLE_STRESS_TEST_MODE=true` 而保持停用。
