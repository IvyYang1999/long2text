# Long2Text — AI-Operated Product

## 项目概述
Long2Text 是一个长截图转文字的 Web SaaS 工具。由 AI 团队自主运营，人类 owner（YYT）参与度 <1%。

- **线上地址**: https://long2text.com
- **代码**: ~/projects/long2text/web/（Next.js 全栈）
- **支付**: Stripe（$0.99/次解锁）
- **OCR**: 腾讯云 GeneralBasicOCR
- **数据库**: Vercel Postgres（Drizzle ORM）
- **部署**: Vercel

## Agent 团队

本项目由 5 个专职 Agent 协作运营。在 `.claude/agents/` 中定义。

| Agent | 职责 | 调用方式 |
|-------|------|---------|
| **pm** | 产品决策、需求优先级、用户反馈分析、PRD | `Agent(subagent_type="l2t-pm")` |
| **dev** | 写代码、修 bug、性能优化、部署 | `Agent(subagent_type="l2t-dev")` |
| **growth** | 写推广内容、SEO 优化、社媒运营 | `Agent(subagent_type="l2t-growth")` |
| **analyst** | 数据分析、转化漏斗、定价策略 | `Agent(subagent_type="l2t-analyst")` |
| **qa** | 测试产品、发现 bug、验收功能 | `Agent(subagent_type="l2t-qa")` |

## 运营模式：AI 自动驾驶

本项目由 AI 团队自主运营。**AI 是 CEO，人类是线下代理人。**

### 自动化调度（说 "autopilot" 启动）

| 任务 | 频率 | 做什么 |
|------|------|--------|
| 每日站会 | 每天 10:23 | PM+QA+Growth 并行，输出简报 |
| 周复盘 | 每周一 14:17 | Analyst+PM+Growth，生成周报+下周计划 |
| 内容生产 | 每周三、六 11:42 | Growth 生成 2 条推广帖子 |

### AI 的职责（自动执行）
- 产品决策和优先级排序
- 代码开发和 bug 修复
- 推广内容生产
- 数据分析和转化优化
- 代码质量检查
- 竞品监控

### 人类 owner 的职责（每周 <15 分钟）
- 审核推广帖子 → 复制粘贴发布到 Reddit/Twitter
- 审核代码变更 → 执行 `cd web && npx vercel --prod`
- 转发用户反馈（如果有的话）
- 阅读周报（如果感兴趣的话）

### 快速命令

| 说 | 做什么 |
|----|--------|
| "autopilot" | 启动所有定时任务 |
| "开站会" | 立即召集团队站会 |
| "做功能：XXX" | PM评估→Dev实现→QA验收→Growth推广 |
| "修bug：XXX" | Dev修复→QA验收 |
| "写推广" | Growth 生成推广内容 |
| "分析数据" | Analyst 检查指标 |
| "周报" | 生成本周运营周报 |

## 技术规范

### 目录结构
```
long2text/
├── web/                    # Next.js 全栈应用
│   ├── src/app/           # 页面和 API 路由
│   ├── src/lib/           # 工具库
│   └── public/            # 静态资源
├── marketing/             # 推广素材
├── .claude/agents/        # Agent 定义
└── CLAUDE.md              # 本文件
```

### 开发规范
- 所有代码改动必须通过 `npm run build` 验证
- 不得引入不必要的依赖
- 页面使用 Tailwind CSS，保持现有浅色调设计
- 中英双语（`lang` state 控制）
- 新功能必须兼容移动端

### 商业模型
- 免费：无限次 OCR，≤500字完整结果
- 付费：$0.99/次解锁长文完整结果
- 目标用户：需要从长截图中提取文字的人（学生、研究者、开发者、运营）
- 目标市场：全球英文用户 + 中文用户
