---
name: l2t-autopilot
description: 启动 Long2Text 自动驾驶模式 — 设置所有定时任务，让团队自己跑起来
---

# Long2Text 自动驾驶模式

当用户说 `/l2t-autopilot`、"自动驾驶"、"团队跑起来"、"autopilot" 时触发。

## 执行流程

使用 CronCreate 设置以下定时任务：

### 1. 每日站会（每天上午 10:23）
```
cron: "23 10 * * *"
```
并行启动 PM + QA + Growth，输出简报和 owner 待办。

### 2. 周复盘（每周一下午 14:17）
```
cron: "17 14 * * 1"
```
启动 Analyst + PM + Growth，生成周报和下周计划，保存到 marketing/weekly-report-{日期}.md。

### 3. 内容生产（每周三、六上午 11:42）
```
cron: "42 11 * * 3,6"
```
Growth 自动生成 2 条推广帖子，追加到 marketing/reddit-posts.md。

## 注意事项

- Cron 任务仅在当前 session 存活（最多7天）
- 每次新开 session 需要重新设置（说 "autopilot" 即可）
- 所有任务在 REPL 空闲时触发，不会打断你的工作
- 如果你不在，任务会在你下次打开时补执行
