# Prism 写作体验 12 阶段全量优化验证记录

> 启动日期：2026-05-19  
> 目标：按 `CONTEXT.md` 已确认的 12 阶段顺序，增量完成 Prism 本地写作体验优化。  
> 主视觉：当前妙言风格（Miaoyan-style）。

## 基线

- `197655b`：确认妙言风格优化计划。
- 验证：`git diff --check` 通过。
- 推送：已推送 `origin/main`。

## 阶段 1：状态栏降噪

改动范围：

- `src/domains/workspace/components/StatusBar.tsx`
- `src/domains/workspace/components/StatusBar.module.css`
- `src/domains/workspace/components/StatusBar.test.tsx`

实现结果：

- 底部状态栏不再显示 `已保存` / `未保存` / `保存中`。
- 底部状态栏不再显示 `META` / `LINK n` / `BACKLINK n` / `TYPO n`。
- 中间统计压缩为 `字数 · 行:列`，选区状态为 `选区 n 字 · 行:列`。
- 可处理诊断聚合为右侧 `ERROR n`。
- 保留现有专注模式按钮与导出按钮。
- 保留后台导出状态 `导出中` 入口。

验证：

- `npm test -- --run src/domains/workspace/components/StatusBar.test.tsx`：7 项通过。
- `npm test -- --run`：69 个测试文件、415 项测试通过。
- `npm run build`：通过。
- `git diff --check`：通过。

跳过项：

- 未跑发布级 app/DMG smoke；本阶段只改前端状态栏呈现与测试，不涉及 Tauri capabilities、安装器、签名、公证、updater 或 file association。
