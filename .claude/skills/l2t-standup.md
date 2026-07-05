---
name: l2t-standup
description: Long2Text 团队站会 — 一键召集所有 Agent 进行周会/日会
---

# Long2Text 团队站会

当用户说 `/l2t-standup` 或 "开站会"、"团队会议"、"long2text状态" 时触发。

## 执行流程

并行启动以下 Agent：

### 1. PM Agent
```
prompt: "你是 Long2Text 的产品经理。阅读项目 CLAUDE.md 和最新代码，输出：
1. 当前最高优先级的 3 件事
2. 不应该做的事
3. 给 dev/growth 的任务指令"
subagent_type: l2t-pm
```

### 2. QA Agent
```
prompt: "你是 Long2Text 的 QA。阅读当前代码，做一次代码审查，输出：
1. 发现的问题（按严重程度排序）
2. UX 改进建议"
subagent_type: l2t-qa
```

### 3. Growth Agent
```
prompt: "你是 Long2Text 的增长负责人。阅读 marketing/ 目录和当前落地页，输出：
1. 本周推广计划
2. 1-2 条新的推广帖子
3. 需要 owner 做的事"
subagent_type: l2t-growth
```

## 汇总后输出

等所有 Agent 返回后，汇总为一份简报：

```markdown
## Long2Text 团队站会 — [日期]

### PM 决策
[PM agent 输出]

### QA 状态
[QA agent 输出]

### 增长计划
[Growth agent 输出]

### Owner 待办（<15分钟）
- [ ] 具体行动1
- [ ] 具体行动2
```
