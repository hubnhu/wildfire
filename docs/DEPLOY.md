# 发布操作手册

## 自动部署

公开仓库 [hubnhu/wildfire](https://github.com/hubnhu/wildfire) 的 main 是发布分支。贡献者经 PR 合入，维护者负责发布；Cloudflare Workers Builds 安装锁定依赖，运行 `npm run build:ci`，再运行 `npm run deploy:ci`，以 wrangler.jsonc 更新 wildfire Worker。GitHub Actions 的 `.github/workflows/ci.yml` 在 PR 及 main、staging 推送上运行 `npm run build:ci`，不部署。

发布记录在 Git 与 Cloudflare；当前验证见 [PROJECT](PROJECT.md)。

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
| 运行时发信配置 | 见 [环境变量](../CONTRIBUTING.md#环境变量)；不填 Build Secrets |

申请开放前须配置发信密钥和收件邮箱。

Preview command 只上传版本。变量与密钥见 [CONTRIBUTING](../CONTRIBUTING.md#环境变量)。

## 团队测试站

`wildfire-staging` 服务 `wildfire-staging.hubn.com`，公开访问，无需登录。复用正式表单，关闭索引和备用网址；邮件标题加 `[测试]`，缺测试配置不回退正式发信。

统计不覆盖测试域名。首次部署后，在测试 Worker 设置[发信变量](../CONTRIBUTING.md#环境变量)。

测试部署保留后台变量，跳过 Wrangler 的严格差异拦截，并关闭差异日志以免打印收件名单。正式站的 CI 仍用严格检查。

- GitHub：两分支均须 PR、负责人审批和 `build` 通过；新提交须重审。员工从 fork 提 PR。主站 PR 合并前须同步最新 main，勿把 staging 合回功能分支；影响验收时复验。
- Cloudflare：测试 Worker 连同仓库，发布分支选 `staging`；根目录与 Build command 留空，Deploy command 填 `npm run deploy:staging`。关闭其他分支预览；如须填写 Preview command，填 `npx wrangler versions upload --env staging`。
- 合入 staging 后自动部署；一次验收一个版本，用合成资料检查页面、移动端、申请、收件及附件。仅将已验收改动提 PR 到 main。

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
node scripts/wrangler.mjs rollback --config wrangler.jsonc --env=
```

选择已验证且配置兼容的版本。代码与静态资源一起回滚；核对当前及历史须知可访问、同意版本一致。回滚不改变 main，下次自动部署仍从 main 构建，需要同步源码修复或回退。

## 常见故障

- **没有新构建**：核对 main、仓库连接及 GitHub App 权限。构建历史在 Deployments 底部 View build history；Settings → Builds 是设置入口。
- **构建失败**：查看安装、测试、Node、assets 路径和 strict 差异日志。旧网站可访问不代表新版本成功；从干净 Git 克隆复现，避免本机文件掩盖缺失。
- **归档目录 ENOENT**：保留 `.gitkeep`，原因见 [CONTRIBUTING](../CONTRIBUTING.md#参与须知更新)。
- **申请拒绝或发信失败**：核对关闭状态、须知日期、邮件绑定及供应商额度；API 受理不等于实际送达，不打印个人信息或供应商异常正文。
- **权限不足**：由维护者检查构建 Token 或本地登录权限，不通过分享密钥解决。
