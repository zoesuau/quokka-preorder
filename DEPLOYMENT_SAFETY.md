# 鼠購易部署安全規則

`project-identity.json` 是鼠購易唯一允許的部署身分。正式發布必須同時符合：

- repository：`zoesuau/quokka-preorder`
- branch：`main`
- Pages：`https://zoesuau.github.io/quokka-preorder/`
- GAS、LIFF 與前後台品牌：必須與 manifest 完全一致
- 部署事件：只能是受保護 `main` 的 push
- 成品：只包含 workflow 明確列出的前端檔案與 `deployment-identity.json`

本機安裝防線：

```bash
git config core.hooksPath .githooks
node scripts/verify-project-identity.mjs
node tests/project-isolation.test.js
```

GitHub 必須設定：

1. Repository variables 固定保存 `PROJECT_ID`、`PROJECT_REPOSITORY`、`PROJECT_PUBLIC_URL`、`PROJECT_BACKEND_URL`、`PROJECT_DATASTORE`、`PROJECT_LIFF_ID`；CI 必須以 repository 外的綁定值核對 manifest。
2. Pages Build and deployment Source 使用 GitHub Actions，不使用 branch 直接發布。
3. `main` 禁止 force push、禁止刪除，合併前必須通過 `Verify project identity`。
4. `github-pages` environment 只允許 `main` 部署。

任何新專案都必須建立自己的 repository、manifest、CI、Pages／Cloudflare 專案、後端、資料庫與身分服務綁定；不得複製本檔後只修改品牌文字。
