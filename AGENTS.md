# 鼠購易專案邊界

此 repository 只屬於 `quokka-preorder`（鼠購易｜韓國小物預購）。不得把其他專案或客戶的品牌、部署設定、後端、資料庫、LIFF、網域或部署歷史提交、合併、推送或部署到這裡。

任何 commit、merge、push、部署、後端設定或正式測試之前，先執行：

```bash
node scripts/verify-project-identity.mjs
node tests/project-isolation.test.js
```

正式部署必須由 `.github/workflows/deploy-pages.yml` 從受保護的 `main` 執行。不得直接以 repository branch 作為 Pages 發布來源，也不得手動上傳未通過 `--deploy` 驗證的成品。

`project-identity.json` 是本專案的部署身分白名單。若使用者要求的來源或目標與其中任何 repository、branch、hosting site、網址、GAS、資料綁定或 LIFF 身分不一致，立即停止並請使用者確認；不得依品牌名稱、共用程式、先前文件或目前工作目錄自行推定跨專案授權。
