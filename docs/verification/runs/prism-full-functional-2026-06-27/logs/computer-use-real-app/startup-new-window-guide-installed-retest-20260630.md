# Prism Startup/New Window Default Guide Installed Retest 2026-06-30

- App: `/Applications/Prism.app`
- Bundle id: `com.prism.editor.v1`
- Expected workspace: `/Users/Alex/Documents/Prism`
- Expected document: `/Users/Alex/Documents/Prism/Examples/Prism Markdown 语法指南.md`
- Screenshot directory: `screenshots/27-installed-startup-guide-smoke/`

## Results

1. Cold app launch:
   - Frontmost process: `com.prism.editor.v1`
   - Window count: `1`
   - AX content includes `Examples`, `# 📖 Prism Markdown 语法指南`, and no `未命名` empty document state.
   - Screenshot: `PRISM-CU-271-startup-default-guide-open.png`
   - AX dump: `startup-guide-ax-dump-20260630.txt`

2. `File > 新建窗口`:
   - Menu item clicked: `menu item 新建窗口 of menu File`
   - Window count after action: `2`
   - AX content for both windows includes `Examples`, `# 📖 Prism Markdown 语法指南`, and no `未命名` empty document state.
   - Screenshot: `PRISM-CU-272-new-window-default-guide-open.png`
   - AX dumps:
     - `new-window-guide-ax-dump-window-1-20260630.txt`
     - `new-window-guide-ax-dump-window-2-20260630.txt`

## Conclusion

`P0-STARTUP-003` passes on the installed app for cold launch and native `File > 新建窗口`.
