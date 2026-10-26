# 安全问题报告

范围：本仓库代码，以及由它部署的 [wildfire.hubn.com](https://wildfire.hubn.com)，特别是申请接口 `POST /api/apply` 和申请资料（称呼、联系方式、简历）的处理。

发现漏洞请通过 GitHub 的私密报告提交：[Report a vulnerability](https://github.com/hubnhu/wildfire/security/advisories/new)。不要开公开 issue，也不要在报告之外传播细节。维护者会尽快确认并回复。

测试时请：

- 不要提交真实的申请人信息或简历，用合成资料。
- 不要对线上申请接口做高频或大流量测试，申请会直接进入真人邮箱。
- 不要尝试访问或留存他人的申请资料。

仓库不含密钥，邮件凭据和收件邮箱只在 Cloudflare Runtime Secret 中。如果你在仓库、构建产物或页面里看到任何像凭据或个人信息的内容，同样按上面的方式报告。
