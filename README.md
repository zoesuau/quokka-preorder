# 鼠購易｜韓國小物預購

獨立於原梨子訂購系統的 LIFF + Google Apps Script 預購專案。

## 已完成

- 手機優先的兩欄商品頁、分類與款式選擇
- 商品由後台直接設定台幣售價
- 商品總額 50% 訂金與回國後剩餘商品款
- 訂單小卡不顯示帳號；客戶按「匯款資訊」後會送出 LINE 文字訊息，由管理方回覆
- 後台可一鍵停賣，前台以遮罩顯示「本次連線已結束」公告，後端同步停止收單
- LINE 身分驗證、預購送單與顯示全部歷史訂單的「我的預購」
- 賣場開設後顯示 iOPEN Mall 連結與七日付款期限
- 手機商品後台：拍照／相簿上傳、建立、編輯、上下架
- 後台設定台幣售價、匯款資訊與預購說明
- 已收訂金訂單可取消缺貨品項，保留原始金額與調整紀錄，並自動計算後續應付或出貨時待退現金
- LINE Webhook 訊息警示：顧客傳送文字、圖片或檔案時，後台標示待核對並暫停逾期自動取消
- 顧客回報匯款後五碼後自動進入「待確認訂金」，由管理員核帳後改為「已收到訂金」
- 訂金正式期限為 24 小時，系統內部保留 1 小時寬限；提醒只在第 12～24 小時由管理員手動發送
- iOPEN Mall 逾期只在前後台標示待確認，不自動取消或發送結案通知
- LINE 訂單通知統一使用訂購系統色系的 Flex Message 卡片
- GAS 伺服器端重新驗證商品、款式與金額
- Google Sheet 商品及預購紀錄

## 檔案

- `index.html`：客戶預購頁
- `storefront.js`：前台互動程式；`index.html` 會先載入官方 LIFF SDK
- `app.js`：舊版內嵌 LIFF SDK 發布檔，僅保留作為既有部署參考
- `admin.html`：手機商品後台
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
4. 部署為網頁應用程式：執行身分選擇自己，存取權選擇所有人。
5. 建立前台 LINE LIFF App，Endpoint URL 指向部署後的 `index.html`；建議再建立一個後台 LIFF App 指向 `admin.html`。
6. 將 GAS `/exec` 網址、前台 LIFF ID 與後台 LIFF ID 填入 `config.js`。
7. 將前端檔案發布到 HTTPS 靜態網站；管理頁網址為 `admin.html`。
8. 依照 `webhook-worker/README.md` 部署 LINE Webhook 中樞，再將 Worker 網址填入 LINE Developers。

## 試算表

第一次執行設定會建立：

- `Products`：商品名稱、分類、圖片、台幣售價、款式、狀態與排序。
- `Preorders`：預購人、商品明細、50% 訂金、剩餘商品款與匯款後五碼。
- `Settings`：匯款資訊、預購說明和 iOPEN Mall 網址（舊換算率僅保留供既有商品轉換）。
- `LineInboundEvents`：Webhook 收到的最少必要訊息事件、訂單配對與人工核對狀態。

訂單狀態可直接在 `Preorders` 的 `status` 欄人工修改。回國後將 iOPEN Mall 連結透過 LINE 通知客人，請客人在商城訂單備註填預購編號以便核對。

缺貨時請從後台訂單卡片使用「取消缺貨品項」，不要直接修改試算表中的商品金額或訂金。第一次執行新版 `setupQuokkaPreorder()` 會自動補上原始訂單、缺貨調整、待退現金與退款時間欄位。

## 預覽模式

`config.js` 尚未填 API 時，前台會顯示兩個示意商品，方便先確認版面；預覽模式不會送出訂單。後台必須完成 GAS 與 LIFF 設定後才能進入。
