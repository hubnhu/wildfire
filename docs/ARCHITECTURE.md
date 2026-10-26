# 架构说明

## 实现结构

Astro 从 JSON 生成静态页面。`src/lib/content.mjs` 集中维护发布及申请过滤、岗位表和名称查找、站点发起人、表单枚举及须知版本。`worker/index.mjs` 通过 Workers Static Assets 提供资源，优先处理 `/api/*`，未知 API 返回 404；页面不依赖 JavaScript 阅读。

申请路径：访客 → POST /api/apply → 同源及格式检查 → 限流 → 有界读取 multipart → 蜜罐、字段和附件校验 → 须知及配置一致性 → Resend → 固定收件箱。字段与响应见 [SPEC](SPEC.md#7-申请表)，变量见 [CONTRIBUTING](../CONTRIBUTING.md#环境变量)。

- 关闭模式在读取请求体前返回 503。请求必须是 POST、multipart/form-data；返回 JSON 或无 JS 的 HTML。
- 请求流计数上限是附件限制加 128KiB，不能只信 Content-Length；multipart 和附件仍占请求内存。
- 单文件检查扩展名、MIME 和签名；DOCX 检查 ZIP 目录里的 Word 项，不解压。这不是完整文档解析或病毒扫描。
- Cloudflare 位置级限流每个 IP 每分钟五次，不是严格全局配额；本地服务使用进程内计数。
- 草稿须知、版本或大小不一致、缺必要配置时不发信。

`worker/email.mjs` 隔离 Resend HTTPS API。From/To 固定于服务端，单一合法邮箱才设 Reply-To，微信及自由文本只进正文。附件 Base64 编码，供应商请求超时为 30 秒；取得消息 ID 仅表示 API 受理，实际送达需收件箱验证。

没有数据库、对象存储、队列或自动补发。附件仅在请求内处理，不写磁盘；超时重试可能产生重复邮件。不记录申请内容或供应商异常正文，不向申请者自动回复；当前 observability 关闭。

## 访问统计

- Google Analytics 经 Cloudflare 的 Google tag gateway 与 Tag Manager 配置；脚本由 Cloudflare 在边缘插入，不在仓库。
- `/wd7e` 为统计脚本和数据的保留路径，网站不得使用此地址；由 Cloudflare 转发至 Google。
- 页面浏览自动记录；代码仅在 JS 申请成功时向 dataLayer 发出一次 apply_success，字段为 event 和 apply_project（any 或项目 slug），无 JS 路径不处理。
- 称呼、联系方式、状态、岗位、投入时间、文字回答、文件名和简历不得进入统计；仓库不得加载站外统计脚本。

## 构建与运行模式

| 模式 | 构建 / 配置 | 边界 |
| --- | --- | --- |
| 开发 | build:draft；serve 或 worker:dev | 允许占位；不代表生产配置 |
| 关闭申请 | build:closed；wrangler.closed.jsonc；dist-closed/ | 提示关闭、禁用表单、API 拒绝；不添加 noindex |
| 开放申请 | build；wrangler.jsonc；dist/ | 严格内容检查；按产品规格接收申请 |

两份部署配置指向同一 Worker 和域名，关闭模式不提供访问控制。自动部署流程只在 [DEPLOY](DEPLOY.md) 维护。

## 为什么这样做

- **Cloudflare Workers**：静态资源和接口同域发布，利用免费层及 Git 自动部署，减少服务维护；接受全球边缘，暂不部署大陆节点。
- **Astro 静态页面**：内容站无需重型客户端框架，手机和无 JS 阅读成本低。
- **5MiB 附件**：限制上传与 Base64 膨胀后的发信、请求内存开销；真实资源余量仍需验证。
- **不用数据库**：当前由邮箱处理申请，先避免增加存储、权限和管理系统；需要搜索、分派或跟进时再评估。
- **按项目开关开放申请**：展示与申请分开控制；前后端使用同一开放列表，关闭项目仍可展示并引导通用申请。
- **Resend 适配器**：专用发送子域与既有收件服务隔离，供应商可替换。
- **须知单一日期与归档**：页面、邮件和同意校验共用版本，旧正文可追溯，不引入第二套日期。
- **不另加 GitHub Actions**：Workers Builds 已承担构建与发布，避免重复部署链路。

自动补发需另评估队列与临时附件存储；多人频繁改内容再评估 CMS。持久存储或新增验证码属于范围变化，不能因复用邮件服务自动接入。
