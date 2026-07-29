# LINE Webhook 中樞

這個 Cloudflare Worker 是 LINE OA 唯一 Webhook URL 的安全入口。

它只做三件事：

1. 使用 `LINE_CHANNEL_SECRET` 驗證 `x-line-signature`。
2. 擷取一對一聊天中的文字、圖片與檔案等訊息事件。
3. 使用內部密鑰將最少必要資料轉送到既有 Google Apps Script。

## 部署設定

在 `webhook-worker` 目錄執行：

```sh
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put WEBHOOK_FORWARDING_SECRET
npx wrangler secret put GAS_WEBHOOK_URL
npx wrangler deploy
```

- `LINE_CHANNEL_SECRET`：LINE Developers → Basic settings → Channel secret。
- `WEBHOOK_FORWARDING_SECRET`：自行產生的高強度隨機字串；GAS 指令碼屬性必須填入相同值。
- `GAS_WEBHOOK_URL`：目前 GAS 網頁應用程式的 `/exec` 網址。

部署後，將 Worker 的 HTTPS 網址填入 LINE Developers → Messaging API → Webhook URL，測試成功後再開啟 `Use webhook` 與 `Webhook redelivery`。
