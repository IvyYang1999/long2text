---
name: l2t-sprint
description: Long2Text 开发冲刺 — PM定义需求 → Dev开发 → QA验收 → Growth准备推广的完整闭环
---

# Long2Text 开发冲刺

当用户说 `/l2t-sprint` 或 "做个功能"、"修bug"、"迭代" 时触发。

## 执行流程

### Phase 1: PM 评估（串行）
启动 PM Agent 评估用户描述的需求：
- 是否值得做？优先级如何？
- 如果做，最小可行方案是什么？
- 输出简要 PRD（<1屏）

### Phase 2: Dev 实现（串行）
将 PM 的 PRD 交给 Dev Agent：
- 实现功能/修复 bug
- 确保 `npm run build` 通过
- 输出改动摘要

### Phase 3: QA + Growth（并行）
同时启动：
- **QA Agent**: 审查 Dev 的代码变更，检查是否引入新问题
- **Growth Agent**: 如果是用户可见的改进，准备一条推广帖子

### Phase 4: 汇总
输出给 Owner：
```markdown
## Sprint 完成

### 做了什么
[改动摘要]

### QA 结果
[通过/问题]

### 部署指令
`cd ~/projects/long2text/web && npx vercel --prod`

### 推广帖子（如果有）
[准备好的帖子内容]
```
