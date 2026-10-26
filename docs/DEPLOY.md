# 发布操作手册

## 自动部署

公开仓库 [hubnhu/wildfire](https://github.com/hubnhu/wildfire) 的 main 是发布分支。贡献者经 PR 合入，维护者负责发布；Cloudflare Workers Builds 安装锁定依赖，运行 `npm run build:ci`，再运行 `npm run deploy:ci`，以 wrangler.jsonc 更新 wildfire Worker。当前不用 GitHub Actions。

发布记录在 Git 与 Cloudflare；不因发布一次补写文档。当前状态与验证只见 [PROJECT](PROJECT.md)。

## 后台设置

入口：wildfire → Settings → Builds。后台由维护者操作。

| 设置 | 值 |
| --- | --- |
| Git repository | hubnhu/wildfire（公开） |
| Production branch | main |
| Root directory | 仓库根目录，默认留空 |
| Build command | npm run build:ci |
| Deploy command | npm run deploy:ci |
| Preview command | npx wrangler versions upload --config wrangler.jsonc |
| 非 main 分支构建 | 关闭 |
| Node.js | .node-version 指定版本 |
| 部署 Token | Cloudflare 构建生成，不提交或分享 |
| Runtime Secret | EMAIL_API_KEY、APPLY_TO_EMAIL；不用复制到 Build Secrets |

新仓库首次部署前必须先设置这两个 Secret，否则申请会失败。

Cloudflare 的 Preview command 是必填的测试版本上传命令，不替换线上部署；使用 wrangler.jsonc 与 build:ci 生成的 dist 一致。变量含义、存放边界只见 [CONTRIBUTING](../CONTRIBUTING.md#环境变量)。非秘密运行变量由 Wrangler 配置维护。

## 手动发布与打包检查

维护者先确认账号、Worker 与模式；多账号通过 CLOUDFLARE_ACCOUNT_ID 指定目标，实际账号标识不写共享文档。

```sh
node scripts/wrangler.mjs login
node scripts/wrangler.mjs whoami
npm run build:ci
npm run worker:check
npm run build:closed
node scripts/wrangler.mjs deploy --config wrangler.closed.jsonc --dry-run --outdir .worker-closed-build
```

`worker:check` 对 dist 做开放配置 dry-run；另一条命令打包关闭申请配置。dry-run 不发布、不验证远程配置或真实投递。Wrangler 的本地日志在忽略的 `.wrangler/logs`，统计关闭，日志不得包含密钥。

获准手动发布开放模式执行 `npm run deploy`，关闭模式执行 `npm run deploy:closed`。它们直接上传本机产物，不同步 GitHub。两种配置更新同一 Worker 和自定义域名；关闭申请不添加 noindex。开放发布清除开发构建变量，并做严格检查；占位由 `scripts/check-content.mjs` 阻止发布。

strict 差异检查失败时先核对配置，不默认去掉 strict 覆盖后台设置。发布前核对 assets、须知版本、大小、限流与发信绑定；发布后检查各类页面、404、同域资源、HTTPS、对应申请模式及 Secret 名称，不读取密钥值。真实邮件测试需负责人授权。

## 回滚

```sh
node scripts/wrangler.mjs rollback --config wrangler.jsonc
```

选择已验证且配置兼容的版本。代码与静态资源一起回滚；核对当前及历史须知可访问、同意版本一致。回滚不改变 main，下次自动部署仍从 main 构建，需要同步源码修复或回退。

## 常见故障

- **没有新构建**：核对 main、仓库连接及 GitHub App 权限。构建历史在 Deployments 底部 View build history；Settings → Builds 是设置入口。
- **构建失败**：查看安装、测试、Node、assets 路径和 strict 差异日志。旧网站可访问不代表新版本成功；从干净 Git 克隆复现，避免本机文件掩盖缺失。
- **归档目录 ENOENT**：保留 `.gitkeep`，原因见 [CONTRIBUTING](../CONTRIBUTING.md#参与须知更新)。
- **申请拒绝或发信失败**：核对关闭状态、须知日期、邮件绑定及供应商额度；API 受理不等于实际送达，不打印个人信息或供应商异常正文。
- **权限不足**：由维护者检查构建 Token 或本地登录权限，不通过分享密钥解决。
