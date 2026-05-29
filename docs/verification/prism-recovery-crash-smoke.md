# Prism Recovery Crash / Restart Smoke 验证

> 日期：2026-05-15
> 目标：验证 Prism 在异常退出或保存失败后能让用户找回未保存内容。
> 计划来源：`docs/archive/dirty-data-2026-05-30/historical-docs/prism-product-optimization-plan.md` 第 3 节“文件安全、自动保存与恢复”。
> 当前状态：本文档定义 smoke 协议和检查表；合法 recovery 快照注入后的真实 `.app` 启动提示和恢复动作已通过截图验证；真实编辑后异常退出生成 recovery、重启恢复、保存清理和二次重启不重复提示已在 macOS App-only smoke bundle 中通过。

## 1. 覆盖范围

本 smoke 覆盖：

- 已保存文档编辑后产生 recovery 快照。
- 自动保存或手动保存前先写入 recovery。
- 异常退出后重启出现恢复提示。
- 恢复快照后文档以 dirty 状态打开，避免误判为已保存。
- 丢弃快照后不再重复提示。
- recovery 快照保留数量上限为每文档 10 个。

本 smoke 不覆盖：

- Time Machine / 系统级备份。
- 云同步或跨设备恢复。
- Windows 崩溃转储分析。

## 2. 现有自动化覆盖

当前自动测试已覆盖主要 recovery 逻辑：

- `src/domains/document/services/recovery.test.ts`
  - 创建和列出 appData `recovery/` 快照。
  - 每个文档只保留最近 10 个快照。
  - 同一文档同一毫秒连续创建快照时不会覆盖旧快照。
  - 清理某个文档的所有快照。
  - 丢弃单个快照不会删除同一文档的其他新快照。
  - 启动扫描会忽略损坏 JSON 和目录 hash 与 `documentPath` 不匹配的错位快照。
  - 启动扫描会忽略 JSON 可解析但 `createdAt`、`reason` 或 `content` metadata 非法的快照。
  - 兼容缺少 `documentName` 的旧 recovery 快照，并回退显示文件 basename。
  - 恢复快照为 dirty 文档，并保留磁盘 mtime / size。
- `src/domains/document/hooks/useAutoSave.test.tsx`
  - 自动保存前创建 recovery。
  - 自动保存关闭时，dirty 文档仍按同一计时器写入 recovery 快照，但不写回原文件。
  - 保存失败时保留 failed 状态和错误信息。
  - 磁盘外部修改时不覆盖，进入 conflict。
- `src/domains/commands/registry.test.ts`
  - 手动保存前创建 `manual-save` recovery 快照。
  - 手动保存成功后清理当前文档 recovery 快照。
  - 手动保存检测到磁盘外部修改时保留 recovery 快照，不覆盖磁盘文件，并进入 conflict。
- `src/domains/document/components/RecoveryModal.test.tsx`
  - 无快照不渲染。
  - 有快照时显示恢复和丢弃动作。
- `src/domains/document/hooks/useRecoveryQueue.test.tsx`
  - 启动时调用 `listRecoverySnapshots()`，并把最新快照作为当前恢复提示。
  - 点击恢复后调用 `restoreRecoverySnapshot()`，从当前会话队列移除该快照，并继续显示下一条快照。
  - 点击丢弃后只删除当前快照，不清空同文档或其他文档的剩余快照。
  - 恢复失败时保留当前快照，并展示可见错误 toast。
  - 丢弃失败时保留当前快照，并展示可见错误 toast。
  - 启动扫描未完成就卸载时不会继续更新状态。
- `src/App.recovery.test.tsx`
  - `useRecoveryQueue()` 返回启动快照，且没有保存对话框 / 保存冲突时，`App` 会渲染 `RecoveryModal`。
  - `RecoveryModal` 的恢复 / 丢弃动作会从 `App` 正确转发到 queue hook handler。
  - 当前文档处于保存冲突时，recovery 提示会被隐藏，优先展示 `SaveConflictModal`。
  - `shouldShowRecoveryPrompt()` 明确覆盖 save dialog、save conflict 和无快照三类遮挡条件。

这些测试证明 domain 逻辑和 App 层 recovery 队列 contract 可用，但不能替代真实 Tauri app 的异常退出、重启扫描、modal 呈现和恢复后用户继续编辑的路径。

## 3. Smoke 工作区

建议固定使用仓库内临时目录，验证完成后可删除：

```text
.codex-smoke/recovery/
  recovery-target.md
```

初始内容：

```markdown
# Recovery Smoke

初始磁盘版本。
```

## 4. 操作步骤：异常退出恢复

1. 启动 Prism。
2. 打开 `.codex-smoke/recovery/recovery-target.md`。
3. 在正文末尾输入一段明显的新内容，例如：

   ```markdown
   这是异常退出前新增但尚未确认落盘的内容。
   ```

4. 等待超过当前自动保存策略时间，或手动触发一次保存动作前的 recovery 写入路径。
5. 不通过菜单正常退出，直接强退 Prism：

   ```bash
   pkill -f "Prism"
   ```

   如果 `pkill` 命中过宽，改用 Activity Monitor 或 `ps` 查出 Prism 进程后 `kill -9 <pid>`。

6. 重新启动 Prism。

通过标准：

- Prism 启动后显示恢复提示。
- 恢复提示展示文档名、路径和快照时间。
- 点击“恢复这个版本”后，新增内容回到编辑器。
- 恢复后的文档状态应为 dirty 或等价的未保存状态，不能显示为已保存。
- 保存后 recovery 快照被清理，重启不再重复提示同一快照。

## 5. 操作步骤：丢弃快照

1. 重复第 4 节创建一个 recovery 快照。
2. 重启 Prism 后选择“丢弃快照”。
3. 再次重启 Prism。

通过标准：

- 丢弃后不再提示同一快照。
- 磁盘上的原文件没有被 recovery 内容覆盖。
- 最近文档和 last session 不应因为丢弃快照丢失。

## 6. 操作步骤：保存失败路径

1. 准备一个正常打开的 Markdown 文档。
2. 模拟保存失败，推荐方式之一：
   - 将文件所在目录临时改为不可写。
   - 或把目标文件替换成权限受限文件。
3. 在 Prism 中修改文档，等待自动保存或手动保存。

通过标准：

- 状态栏显示保存失败或等价错误入口。
- 文档不被标记为 saved。
- recovery 快照存在。
- 修复权限后重新保存，文档可正常进入 saved 状态。

## 7. 操作步骤：快照上限

1. 对同一文档连续制造超过 10 次 recovery 写入。
2. 检查 appData `recovery/` 中该文档目录。

通过标准：

- 同一文档最多保留 10 个快照。
- 最新快照优先显示。
- 旧快照被清理时不影响其他文档的 recovery。

## 8. 检查位置

macOS 默认 appData 路径通常为：

```text
~/Library/Application Support/com.prism.editor.v1/recovery/
```

不要手工修改 recovery JSON 后再把结果算作通过；如果需要检查内容，只读查看。

## 9. 通过标准

全部路径通过，且没有 P0/P1 问题，即可认为“recovery crash/restart smoke 通过”。

P0 问题：

- 异常退出后没有任何恢复提示。
- 恢复后内容丢失。
- 恢复后文档被错误标记为 saved。
- 丢弃快照覆盖磁盘文件。

P1 问题：

- 快照时间、路径或文档名无法让用户判断是否恢复。
- 保存失败状态不清晰。
- recovery 快照没有按上限清理。

## 10. 本轮记录

2026-05-15 补强自动化证据：

- `src/domains/document/services/recovery.ts` 的启动扫描现在会校验 recovery 目录名必须等于 `getRecoveryDocumentId(documentPath)`，避免错位快照污染恢复提示。
- `src/domains/document/services/recovery.test.ts` 新增“丢弃单个快照后保留同文档更新快照”和“忽略损坏 / 错位快照”的回归测试。
- `src/domains/document/services/recovery.ts` 现在会在同一文档同一毫秒连续创建 recovery 快照时寻找下一个可用时间戳文件名，避免 `Date.now()` 碰撞覆盖旧快照。
- `src/domains/document/services/recovery.test.ts` 新增“同一毫秒快照不覆盖”的回归测试，验证 `1000.json` 与 `1001.json` 同时保留且列表按最新优先排序。
- `src/domains/commands/registry.test.ts` 新增手动保存 recovery 回归：保存前先创建 `manual-save` 快照，保存成功后清理快照；如果保存前发现磁盘外部修改，则保留快照、不调用 `writeTextFile`，并进入 conflict。
- `src/domains/document/hooks/useRecoveryQueue.ts` 把 App 内启动扫描、当前快照队列、恢复/丢弃动作抽成可测 hook，`App.tsx` 只负责把 hook 结果接到 `RecoveryModal`。
- `src/domains/document/hooks/useRecoveryQueue.test.tsx` 新增 App 层 recovery 队列回归：启动扫描展示最新快照，恢复/丢弃只移除当前快照，恢复失败保留快照，卸载后不更新状态。
- `src/domains/document/services/recovery.ts` 的显式丢弃动作现在会把 `remove()` 失败向上抛出，避免磁盘删除失败时 UI 误报“已丢弃恢复快照”。
- `src/domains/document/services/recovery.test.ts` 和 `src/domains/document/hooks/useRecoveryQueue.test.tsx` 新增丢弃失败回归：底层删除失败时快照仍保留在列表中，并显示“丢弃失败”toast。
- `src/domains/document/services/recovery.ts` 新增 recovery 快照 metadata 校验：启动扫描只接受合法 `version`、非空 `documentPath`、字符串 `content`、有限数字 `createdAt` 和 `autosave | manual-save` reason。
- `src/domains/document/services/recovery.test.ts` 新增 malformed metadata 回归：JSON 可解析但 `createdAt` / `reason` / `content` 非法的快照不会污染恢复队列；缺少 `documentName` 的旧快照回退显示 basename。
- `src/App.tsx` 新增 `shouldShowRecoveryPrompt()`，把 recovery modal 的 App 级遮挡规则显式化：有快照、没有保存对话框、没有保存冲突时才显示。
- `src/App.recovery.test.tsx` 新增 App 层接线回归：启动快照会进入 `RecoveryModal`，恢复 / 丢弃点击会转发到 hook handler；保存冲突时隐藏 recovery 并展示冲突弹窗；save dialog 遮挡规则由 `shouldShowRecoveryPrompt()` 覆盖。
- `src/domains/document/hooks/useAutoSave.ts` 不再把 recovery 快照绑定到自动保存开关：只要已保存文档处于 dirty 且未处于 conflict，就会在计时器触发时先写入 recovery；当自动保存关闭时停在 recovery，不写回原文件。
- `src/domains/document/hooks/useAutoSave.test.tsx` 新增“自动保存关闭仍写 recovery”回归，确认不会调用 `stat`、`writeTextFile` 或清理 recovery，文档保持 dirty。

本批自动化证据完成时仍未真实强退 Prism；后续真实 crash / restart smoke 结果见下方追加记录。已执行的自动化验证在本批最终汇报中记录：

- `npm test -- --run src/domains/document/hooks/useAutoSave.test.tsx`：通过，1 file / 5 tests。
- `npm test -- --run`：通过，55 files / 315 tests。
- `npm run build`：通过，仅有既有 Vite large chunk warning。
- `git diff --check`：通过。
- `npm test -- --run src/App.recovery.test.tsx`：通过，1 file / 3 tests。
- `npm test -- --run src/domains/document/services/recovery.test.ts`：通过，10 tests。
- `npm test -- --run src/domains/document/services/recovery.test.ts src/domains/document/hooks/useRecoveryQueue.test.tsx src/domains/document/components/RecoveryModal.test.tsx`：通过，3 files / 17 tests。
- `npm test -- --run src/domains/document/hooks/useRecoveryQueue.test.tsx src/domains/document/components/RecoveryModal.test.tsx`：通过，2 files / 8 tests。
- `npm test -- --run src/domains/document/services/recovery.test.ts`：通过，7 tests。
- `npm test -- --run src/domains/commands/registry.test.ts`：通过，18 tests。
- `npm test -- --run`：通过，52 files / 284 tests。
- `npm run build`：通过，仅有既有 Vite large chunk warning。
- `git diff --check`：通过。
- `npm run tauri:build`：前端 build 与 Rust release 编译通过，已生成 `src-tauri/target/release/bundle/macos/Prism.app`；DMG 阶段 `bundle_dmg.sh` 失败，未生成最终 `.dmg`。
- 追加 `npm run tauri -- build --bundles dmg -v` 诊断：失败点是 `bundle_dmg.sh` 运行 Finder AppleScript 布局 DMG 时超时，具体错误为 `Finder` AppleEvent 超时 `(-1712)`；脚本随后已卸载临时 disk image。本次 recovery 代码改动未触碰 Rust / capabilities，失败点位于 macOS DMG 打包环境 / Finder AppleScript 阶段。
- 新增并执行 `npm run release:mac-dmg:skip-finder`：使用 Tauri 生成的 `bundle_dmg.sh --skip-jenkins` 成功生成 `src-tauri/target/release/bundle/macos/Prism_1.4.0_aarch64.dmg`；`hdiutil verify` 校验通过。

2026-05-15 真实启动提示 smoke 尝试：

- 准备隔离 fixture：`.codex-smoke/recovery/recovery-target.md`。
- 写入单个 appData recovery 快照：`~/Library/Application Support/com.prism.editor.v1/recovery/a847e6cf/1778810576359.json`。
- 启动 `src-tauri/target/release/bundle/macos/Prism.app` 后确认 Prism 进程存在：`/Users/Alex/AI/project/Prism/src-tauri/target/release/bundle/macos/Prism.app/Contents/MacOS/app`。
- Computer Use 读取 Prism 失败：`codex app-server exited before returning a response`。
- AppleScript/System Events 窗口查询卡住，已终止查询进程，避免后台挂起。
- 系统截图只能看到 Warp 在前台、Prism 白色窗口在后台，无法确认 recovery modal 是否出现；截图路径：`/tmp/prism-recovery-smoke.png`、`/tmp/prism-recovery-smoke-front.png`。
- 已清理本次注入的 recovery 快照和 `.codex-smoke/recovery/` fixture。

结论：本次真实启动 smoke **未通过也不能算失败**，状态为 UI 读取 / 前台控制受阻。已确认 fixture 注入和 app 启动，但没有取得恢复提示可见性的可靠证据，因此不能把 recovery crash/restart 真实 smoke 标为闭环。

2026-05-15 第二次真实启动提示 smoke 尝试：

- 准备隔离 fixture：`.codex-smoke/recovery/recovery-target.md`，磁盘内容只保留“初始磁盘版本”。
- 写入合法 appData recovery 快照：`~/Library/Application Support/com.prism.editor.v1/recovery/a847e6cf/1778816524199.json`，快照内容包含“这是 recovery smoke 注入的未保存内容 2026-05-15”。
- 启动 release app：`open -n src-tauri/target/release/bundle/macos/Prism.app`。
- 确认 Prism 进程存在：PID `41372`，命令为 `.../Prism.app/Contents/MacOS/app`。
- Computer Use 读取 Prism 仍失败：`codex app-server exited before returning a response`。
- `open -b com.prism.editor.v1` 后 `screencapture` 只能得到全黑截图；`screencapture -l 21710` 返回 `could not create image from window`。
- `System Events` 查询窗口失败，原因为当前 `osascript` 没有辅助功能权限：`“osascript”不允许辅助访问。 (-25211)`。
- `lsappinfo visibleProcessList` 能看到 `"Prism"`。
- `swift` 调用 `CGWindowListCopyWindowInfo` 能看到 Prism 窗口：
  - window `21710`：`kCGWindowOwnerName = Prism`，`kCGWindowName = Prism`，`kCGWindowIsOnscreen = 1`，bounds 为 `990x685 @ (2193,146)`。
  - window `21711`：`kCGWindowOwnerName = Prism`，bounds 为 `500x500 @ (0,617)`。
- `/usr/bin/log show --predicate 'process == "app"' --last 5m` 显示 WebKit 资源加载完成并创建 WebContent 进程，但系统日志不能证明 recovery modal 已渲染。

结论：第二次尝试比第一次多确认了 release app 的窗口已创建且处于 onscreen 状态，但仍没有取得恢复弹窗正文、按钮或恢复后内容的可靠证据。当前阻塞是本机自动化环境的 Screen Recording / Accessibility / Computer Use 访问限制，不是 recovery 功能通过或失败的证据。因此 recovery crash/restart 真实 smoke 仍保持“未闭环”。

2026-05-15 第三次真实启动提示 smoke：合法快照注入 + `.app` 恢复动作

- 准备 fixture：`.codex-smoke/recovery-ui/recovery-target.md`，磁盘内容为“初始磁盘版本”。
- 写入合法 appData recovery 快照：`~/Library/Application Support/com.prism.editor.v1/recovery/a3588248/1778824835238.json`。
- 快照内容包含“这是 recovery smoke 注入的未保存内容。”。
- 启动方式：`open -n src-tauri/target/release/bundle/macos/Prism.app`。
- 通过 `System Events` 将 Prism 窗口移动到 `{80, 80}`，再用 `screencapture -R80,80,1100,760` 截图。
- 结果：Prism 真实窗口显示“恢复文档”modal，包含：
  - 标题：`恢复文档`
  - 文档名：`recovery-target.md`
  - 路径：`.codex-smoke/recovery-ui/recovery-target.md`
  - 提示：`Prism 找到一个本地恢复快照`
  - 按钮：`丢弃快照`、`恢复这个版本`
- 启动提示截图：`.codex-smoke/recovery-ui/prism-recovery-modal.png`。
- 使用坐标点击“恢复这个版本”后，真实窗口显示恢复后的正文：
  - `# Recovery Smoke`
  - `初始磁盘版本。`
  - `这是 recovery smoke 注入的未保存内容。`
- 标题栏状态显示“已编辑”，状态栏显示“未保存”，证明恢复后的文档没有被误标为 saved。
- 恢复后截图：`.codex-smoke/recovery-ui/prism-recovery-restored.png`。
- 已清理本次注入的 appData recovery JSON：`injected-recovery-cleaned=ok`。

结论：这次 smoke 通过了“合法 recovery 快照存在时，真实 `.app` 启动会显示恢复提示，并且点击恢复后注入内容回到编辑器且状态为未保存”。限制是：本次快照由 smoke 注入，不是通过真实编辑后异常退出自动生成；因此“异常退出生成快照”仍未闭环。

2026-05-15 第四次真实 crash / restart smoke：真实编辑生成快照 + 强退恢复

- 先发现旧 `.app` bundle 会导致误判：未重新构建前，真实编辑后 `target_contains_marker=no`、`recovery_contains_marker=no`、`recovery_files=0`。该结果只作为 stale bundle 诊断，不计入功能失败。
- 重新执行 `npm run tauri:build:app-smoke`，结果通过，生成 `src-tauri/target/release/bundle/macos/Prism.app`；该命令包含 `npm run build`，仅有既有 Vite large chunk warning。
- 准备 fixture：`.codex-smoke/recovery-real/recovery-target.md`，初始磁盘内容为 `Initial disk version.`。
- 临时备份 appData 配置到 `.codex-smoke/recovery-real/appdata-backup/config.json.before-real-crash-smoke`，并只在 smoke 期间设置：
  - `autoSaveEnabled=false`
  - `autoSaveInterval=500`
  - `autoSaveStrategy=instant`
  - `lastSession.filePath=.codex-smoke/recovery-real/recovery-target.md`
- marker：`CRASH_SMOKE_REAL_MARKER_20260515174022`；recovery document id：`6cd2604e`。
- 启动方式：`open -n src-tauri/target/release/bundle/macos/Prism.app`。
- 通过 Computer Use 对真实 CodeMirror 文本区设置完整内容，窗口标题显示“已编辑”，状态栏显示“未保存”。
- 等待 recovery 定时器后检查：
  - `target_contains_marker=no`，证明自动保存关闭时没有写回原文件。
  - `recovery_contains_marker=yes`，证明真实编辑内容已写入 appData recovery。
  - `recovery_files=1`，快照路径为 `~/Library/Application Support/com.prism.editor.v1/recovery/6cd2604e/1778838046405.json`。
  - 编辑态截图：`.codex-smoke/recovery-real/evidence/01-real-edit-dirty.png`。
- 使用 `kill -9 78147` 强退 Prism，随后确认 `process_after_kill=stopped`。
- 重新启动同一 App-only bundle 后，真实窗口显示“恢复文档”modal，包含：
  - 文档名：`recovery-target.md`
  - 路径：`.codex-smoke/recovery-real/recovery-target.md`
  - 提示：`Prism 找到一个本地恢复快照`
  - 按钮：`丢弃快照`、`恢复这个版本`
  - modal 截图：`.codex-smoke/recovery-real/evidence/02-restart-recovery-modal.png`
- 点击“恢复这个版本”后，真实编辑器恢复 marker 内容，标题栏为“已编辑”，状态栏为“未保存”；恢复截图：`.codex-smoke/recovery-real/evidence/03-restored-dirty.png`。
- 恢复后检查：
  - `target_contains_marker_after_restore=no`，证明恢复动作没有静默覆盖磁盘文件。
  - `recovery_contains_marker_after_restore=yes`，证明未保存状态下快照仍留在磁盘。
- 执行 `Cmd+S` 保存后检查：
  - `target_contains_marker_after_save=yes`，证明用户显式保存后内容写入原文件。
  - `recovery_dir_exists_after_save=no` / `recovery_files_after_save=0`，证明保存成功后清理该文档 recovery。
- 再次重启 Prism，恢复 modal 不再出现，窗口直接打开已保存文档；截图：`.codex-smoke/recovery-real/evidence/04-restart-after-save-no-modal.png`。
- smoke 结束后已恢复原 appData `config.json`，并确认 `recovery_dir_exists_final=no`。

结论：macOS App-only smoke 通过了真实编辑后异常退出生成 recovery、重启显示恢复提示、恢复后保持未保存状态、显式保存清理 recovery、再次重启不重复提示的完整链路。剩余未做的真实桌面路径是“丢弃快照”按钮、保存失败路径和 Windows crash/restart；这些已有自动化 contract 或需要对应平台 / 权限补验证，不能混同为本次 crash/restart 通过范围。

后续补充丢弃快照、保存失败或 Windows crash/restart smoke 时，在此追加：

```text
日期：
Prism 版本：
运行方式：
平台：
异常退出恢复：
丢弃快照：
保存失败路径：
快照上限：
结论：
```
