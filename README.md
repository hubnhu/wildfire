# 野火 Wildfire

[wildfire.hubn.com](https://wildfire.hubn.com) 的源码。野火是白老师个人发起的项目社区：介绍理念、展示项目、接收共创申请。Astro 静态页面与申请接口部署在同一个 Cloudflare Worker，申请通过邮件送达，没有数据库。

## 本地运行

使用 `.node-version` 指定的 Node.js，执行 `npm ci`，再执行 `npm run dev` 编辑页面。

`npm run serve` 构建允许占位的开发版本并提供本地申请接口；`npm run worker:dev` 使用 Wrangler 和忽略的 `.dev.vars`。本地没有邮件配置时提交会失败，这是预期行为；开发不需要任何生产凭据。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm test` | 接口与内容检查 |
| `npm run build:draft` | 允许占位的开发构建 |
| `npm run build:ci` | 测试与严格构建 |
| `npm run build:closed` | 关闭申请构建 |
| `npm run test:browser` | 页面交互、手机布局与截图 |
| `npm run test:data-build` | 项目数量、发布过滤与须知归档场景 |

## 参与贡献

欢迎修 bug、改进可访问性和性能、补测试和文档，提 PR 前请读 [CONTRIBUTING](CONTRIBUTING.md)。网站文案、项目和发起人资料由维护者维护，想改内容请先开 issue 讨论。问题和建议用 [GitHub Issues](https://github.com/hubnhu/wildfire/issues)，安全问题见 [SECURITY](SECURITY.md)。

## 文档索引

- [代理规则](AGENTS.md)
- [贡献、内容编辑与变量](CONTRIBUTING.md)
- [产品规格](docs/SPEC.md)
- [实现与技术理由](docs/ARCHITECTURE.md)
- [发布操作](docs/DEPLOY.md)
- [当前状态与验证](docs/PROJECT.md)

## 许可证

代码以 [MIT 许可证](LICENSE) 开源。网站内容不在 MIT 授权范围内：`src/data/` 中的项目介绍、发起人简介和参与须知，页面与组件里的文案，以及 `public/assets/` 中的图片，版权归野火及各项目发起人所有，保留所有权利；复制或改编这些内容需另行取得许可。
