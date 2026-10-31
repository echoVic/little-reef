# macOS 发布流程

当前发行平台为 macOS 12+、Apple 芯片。版本号同时维护在 `mygo.json`、`web/package.json` 和 `web/package-lock.json`，更新说明来自 `CHANGELOG.md` 对应版本节。

## 构建与校验

```sh
npm --prefix web ci --registry=https://registry.npmjs.org/
npm --prefix web run typecheck
npm --prefix web test
npm --prefix web run build
CGO_ENABLED=0 go test ./...
CGO_ENABLED=0 go vet ./...
```

正式构建通过环境变量 `MYGO_UPDATER_PRIVATE_KEY` 提供已有更新签名私钥，不能重新生成密钥或提交私钥。使用配置中的 Developer ID 与钥匙串公证凭据：

```sh
CGO_ENABLED=0 go tool mygo build -o build/release-<版本> .
```

`buildCommand` 会重新构建前端。`slug: app` 固定更新资产名称，与已发布版本一致。MyGo 自动完成签名、公证、更新压缩包及最近三个版本的增量包。

检查 `.app` 的 `codesign --verify --deep --strict`、`spctl --assess --type execute`，以及 DMG 的 `xcrun stapler validate`。按更新清单中的公钥、SHA-256、Ed25519 签名和字节数校验全量包与所有增量包；在临时目录应用上一版本的补丁，核对文件内容与新版本相同，并重新验证签名。

## 发布资产

- 复制构建出的 `app-<版本>-arm64.dmg` 为 `little-reef-<版本>-macos-arm64.dmg`，保持官网使用的下载命名。
- 上传 DMG、`app-<版本>-darwin-arm64.tar.gz`、全部 `.delta`、`update-darwin-arm64.json` 和重新计算的 `SHA256SUMS`。更新清单内 URL 的文件名必须与资产完全一致。
- 将发布源码提交并创建带更新说明的 `v<版本>` 注释标签，推送分支和标签。
- 先创建草稿 Release，上传并核对所有资产后再公开为 Latest。不要让已安装的应用读到缺少资产的更新清单。
- 公开后从 `releases/latest/download/update-darwin-arm64.json` 重新下载清单，核对版本、资产长度及 SHA-256。

## 官网

官网仓库是同级的 `echovic-apps`。同步 `products/reef.json` 的 `fallbackTag`、`fallbackAsset`、用户可见功能与安装包大小。更新截图（使用独立的演示存档）和中英文页面；站内更新日志由本仓库 `CHANGELOG.md` 生成。

先发布应用，再在官网仓库执行 `npm run build`，检查中英文静态下载链接指向新版本，并运行 `npx wrangler deploy --dry-run`。提交官网源码后按现有 Cloudflare Workers 流程部署，最后检查中英文主页、更新日志、图片和下载地址。
