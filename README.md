# 鼠購易｜韓國小物預購

獨立於原梨子訂購系統的 LIFF + Google Apps Script 預購專案。

## 已完成

- 手機優先的兩欄商品頁、分類與款式選擇
- 商品由後台直接設定台幣售價
- 商品總額 50% 訂金與回國後剩餘商品款
- LINE 身分驗證、預購送單與「我的預購」
- 手機商品後台：拍照／相簿上傳、建立、編輯、上下架
- 後台設定台幣售價、匯款資訊與預購說明
- GAS 伺服器端重新驗證商品、款式與金額
- Google Sheet 商品及預購紀錄

## 檔案

- `index.html`：客戶預購頁
- `admin.html`：手機商品後台
- `config.js`：GAS API 與 LIFF ID
- `Code.gs`：Google Apps Script 後端

## 部署

1. 建立一份 Google Sheet，開啟「擴充功能 → Apps Script」。
2. 將 `Code.gs` 貼入 Apps Script，執行一次 `setupQuokkaPreorder()` 並授權。
3. 在 Apps Script「專案設定 → 指令碼屬性」加入：
   - `LINE_CHANNEL_ID`：LINE Login Channel ID。
   - `ADMIN_LINE_USER_IDS`：管理員 LINE User ID；多個以逗號分隔。
   - `SPREADSHEET_ID`：只有使用獨立 Apps Script 專案時需要。
4. 部署為網頁應用程式：執行身分選擇自己，存取權選擇所有人。
5. 建立前台 LINE LIFF App，Endpoint URL 指向部署後的 `index.html`；建議再建立一個後台 LIFF App 指向 `admin.html`。
6. 將 GAS `/exec` 網址、前台 LIFF ID 與後台 LIFF ID 填入 `config.js`。
7. 將前端檔案發布到 HTTPS 靜態網站；管理頁網址為 `admin.html`。

## 試算表

第一次執行設定會建立：

- `Products`：商品名稱、分類、圖片、台幣售價、款式、狀態與排序。
- `Preorders`：預購人、商品明細、50% 訂金、剩餘商品款與匯款後五碼。
- `Settings`：匯款資訊、預購說明和 iOPEN Mall 網址（舊換算率僅保留供既有商品轉換）。

訂單狀態可直接在 `Preorders` 的 `status` 欄人工修改。回國後將 iOPEN Mall 連結透過 LINE 通知客人，請客人在商城訂單備註填預購編號以便核對。

## 預覽模式

`config.js` 尚未填 API 時，前台會顯示兩個示意商品，方便先確認版面；預覽模式不會送出訂單。後台必須完成 GAS 與 LIFF 設定後才能進入。
