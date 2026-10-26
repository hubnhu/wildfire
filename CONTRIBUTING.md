# 协作指南

公开仓库 [hubnhu/wildfire](https://github.com/hubnhu/wildfire)。贡献者 fork 后在自己的 fork 开分支，向本仓库 main 提 PR，说明改了什么、为什么、本地跑了哪些检查；较大的改动请先开 issue 讨论。main 不接受直接推送，仅维护者（文档中称负责人，GitHub 上的 @hubnhu）能合并并发布。合入 main 会触发部署，流程见 [DEPLOY](docs/DEPLOY.md)。Node.js 版本与本地命令见 [README](README.md)；贡献不需要任何生产凭据，维护者也不会索取你的凭据。

提交 PR 即表示同意你的代码贡献按 [MIT 许可证](LICENSE) 发布。网站文案、项目和发起人资料由维护者确认后更新，外部 PR 请不要改 `src/data/` 里的内容，除非 issue 里已经商定。仓库历史重建过，更早的克隆不能直接合并回来。

## 内容编辑

以下供维护者更新内容时参考。

- 加岗位：在 `src/data/roles.json` 追加唯一 id 和名称，数组顺序决定表单顺序，项目仅引用 id。
- 加发起人：在 `src/data/initiators.json` 填唯一 slug、姓名、简介及 bio 段落；至少有一个已发布项目才生成专页。首页发起人由 `src/data/site.json` 的 founder 指定。
- 发起人可选 `links: [{ "label": "博客", "url": "https://..." }]`。
- 加项目：在 `src/data/projects.json` 填 [SPEC](docs/SPEC.md#5-内容数据) 字段，引用存在的发起人和岗位；详情岗位须有说明。published 控制展示，acceptingApplications 为 true 且 published 才进入申请下拉。slug 发布后不要改。
- 站点大小变化同步 `RESUME_MAX_MB`；公共协作条目在 `src/data/collaboration.json`，按稳定 id 替换说明。
- 未确认占位由 `scripts/check-content.mjs` 阻止发布。

## 参与须知更新

正文与版本来自 `src/data/terms/current.json`；`version: null` 为草稿，不发信。普通网站部署不更新须知日期。

1. 改正文前运行 `npm run terms:archive`，原样归档旧版。
2. 改正文及新版本日期，不覆盖归档或重用版本。
3. 同步 Wrangler 的 `TERMS_VERSION`，验证 `/terms/archive/{旧版本}`；旧同意版本需要重新阅读和勾选。

`src/data/terms/archive/.gitkeep` 必须存在：Git 不保存空目录，校验及归档测试需要该目录。

## 环境变量

本地复制 `.dev.vars.example` 到忽略的 `.dev.vars`，填示例值即可。发件邮箱获准共享；收件邮箱和密钥只放 Runtime Secret，不进 Git、日志、浏览器、构建产物或 `PUBLIC_` 变量。

| 名称 | 用途 / 存放位置 |
| --- | --- |
| `EMAIL_PROVIDER` | resend；Wrangler vars |
| `EMAIL_API_KEY` | 发信凭据；Runtime Secret |
| `EMAIL_FROM` | 固定已验证发件人；Wrangler vars |
| `APPLY_TO_EMAIL` | 固定收件人；Runtime Secret |
| `TERMS_VERSION` | 等于须知最后更新日期；Wrangler vars |
| `RESUME_MAX_MB` | 与站点限制一致，5MiB；Wrangler vars |
| `APPLICATIONS_CLOSED` | 字符串 '1' 关闭申请，其余开放；Wrangler vars |
| `WILDFIRE_APPLICATIONS_CLOSED` | 字符串 '1' 构建关闭申请界面；仅构建环境 |
| `ALLOW_DRAFT` | 1 允许开发占位；仅开发构建环境 |

## 文件边界

| 可提交 | 不提交 |
| --- | --- |
| 源码、网站内容、公共资源及 QR、依赖锁文件 | 密钥、`.dev.vars` 等实际环境文件、账号标识 |
| 规格、指南、架构和当前状态 | 真实申请、简历、邮件导出、申请人联系方式 |
| Wrangler 配置、获准共享的发件邮箱、合成测试夹具 | 本地日志、构建产物、截图、机器状态 |

维护者的私人笔记在忽略的 `docs/local/`，构建不依赖它。忽略目录也不用来保存真实申请或简历，不用强制添加绕过规则。误提交密钥或个人信息后立即通知维护者，由维护者决定撤销凭据或清理历史；忽略规则不清除旧历史。

## 提交前检查

运行 `npm test`、`npm run check:data`、`npm run build:ci`。页面变化运行 `npm run test:browser`；数据或归档变化运行 `npm run test:data-build`，该测试暂改并恢复数据，勿同时编辑。配置变化按 [DEPLOY](docs/DEPLOY.md#手动发布与打包检查) 做 dry-run。

PR 说明写清行为、原因和实际跑过的检查。真实验证范围见 [PROJECT](docs/PROJECT.md#验证现状)。
