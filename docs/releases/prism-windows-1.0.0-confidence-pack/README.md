# Prism Windows 1.0.0 发布信心包

> 日期：2026-07-09
> 基线：`tag=v1.0.0`, `target=e03f199e6f3bcd256bc9cc83c356302e69239d31`
> 当前结论：Conditional Go

## 结论

这轮 Windows 真机验证已经把最关键的链路跑通了：

- Windows bundle 已经能产出 MSI 和 NSIS。
- NSIS 静默安装、覆盖安装、卸载后保留用户工作区文档都已验证。
- MSI 管理员权限静默安装已通过；非管理员静默安装失败原因是 per-machine 权限前置条件。
- 开始菜单快捷方式可启动 Prism。
- Prism 可以打开 `.md`、`.markdown`、`.txt`、`.json`、`.sql` 文件。
- Markdown 预览、路径动作、主题语言、知识图谱、HTML 导出、复杂导出、导出诊断、长文预览和 80 文件大工作区 smoke 都已验证。
- 图片粘贴 / 拖拽有定向自动化覆盖。
- `Ctrl+B`、`Ctrl+I`、`Ctrl+O`、`Ctrl+N`、`F11` 已在修复分支重打包安装版中完成 Windows 真机复测。
- `F9` 打字机模式已在 Windows 真机中通过菜单触发和勾选状态完成补验。
- updater 已轮换到新的正式 key，Windows NSIS / MSI `.sig` 和 `windows-x86_64 latest.json` 均已生成并通过校验。
- 应用内 `检查更新...` 不会一直 loading，会给出“暂不可用”最终态。

但还不能把 Windows 1.0.0 记成稳定发布，原因也很明确：

- 旧 `v1.0.0` 安装版仍内嵌旧 updater public key；本轮 key rotation 后，旧安装版不能自动接受新 key 签名的更新，需要用户手动安装一次新版本。
- 删除到回收站需要用户动作前确认，125% / 150% 高 DPI 需要改系统缩放后补验。
- 额外 Rust workspace index job 查询风险已消减，定向测试通过。
- 条件项 `Ctrl` + 鼠标滚轮字号不属于当前 `e03f199e` 基线，按计划 Not Run。

## 已完成的证据

- [environment.md](./evidence/environment.md)
- [build-and-test.md](./evidence/build-and-test.md)
- [installer-artifacts.md](./evidence/installer-artifacts.md)
- [install-smoke.md](./evidence/install-smoke.md)
- [file-association.md](./evidence/file-association.md)
- [path-actions.md](./evidence/path-actions.md)
- [writing-preview.md](./evidence/writing-preview.md)
- [ui-and-shortcuts.md](./evidence/ui-and-shortcuts.md)
- [export.md](./evidence/export.md)
- [updater.md](./evidence/updater.md)
- [performance.md](./evidence/performance.md)
- [plan-coverage.md](./plan-coverage.md)
- [issues.md](./issues.md)
- [manifest.json](./manifest.json)

## 当前摘要

| 项目 | 结果 |
|---|---|
| 环境记录 | Pass |
| Windows bundle 产物 | Pass |
| 全量测试 | Pass |
| 导出 smoke | Pass |
| NSIS 安装 | Pass |
| 覆盖安装 | Pass |
| 卸载保留用户文档 | Pass |
| MSI 管理员静默安装 | Pass |
| 开始菜单启动 | Pass |
| `.md` 打开 | Pass |
| `.markdown` / `.txt` / `.json` / `.sql` 打开 | Pass |
| 路径复制 / 资源管理器定位 | Pass |
| 预览 | Pass |
| 搜索 / 替换 | Pass |
| 快捷键格式化 / 打开 / 新建 / 全屏 | Pass |
| F9 打字机模式 | Pass |
| 主题 / 语言 | Pass |
| 知识图谱入口 | Pass |
| HTML 导出 | Pass |
| PDF / PNG / DOCX 导出 smoke | Pass |
| 导出预检 / 坏链接 / 缺图诊断 | Pass |
| updater 签名产物 | Pass with key rotation |
| 检查更新 UI | Pass |
| 性能大工作区 | Pass |
| 长文预览 / 导出反馈 | Pass |
| 图片粘贴 / 拖拽自动化 | Pass |
| 索引取消 / 降级自动化 | Pass |
| 回收站删除 / 高 DPI 125% 150% | Blocked |

## Manifest 计数

| 状态 | 数量 |
|---|---:|
| Pass | 41 |
| Fail | 0 |
| Blocked | 2 |
| Not Run | 1 |

## Release Status 摘要

```text
Windows 1.0.0 release status: Conditional Go
Commit: e03f199e6f3bcd256bc9cc83c356302e69239d31
Windows version: Microsoft Windows 11 专业版 10.0.26200, x64
Installer: NSIS + MSI
SHA256:
  app.exe BF21B29C1AD0BD2D1B36ABCF98AA978E47B1D2C315174B664E283BEC1CBA6540
  installed app.exe A4D5220F5AC8026FD4B65BA0CD11D19360B54180BCD39F93B105E418021062E0
  Prism_1.0.0_x64-setup.exe D76BA7F01D50436EB4FA1B7A2D1E1D81CE4605CC1D12C06F4308E53524016E20
  Prism_1.0.0_x64_en-US.msi D1B23C336F716FB9D220E52841D98D9A7E9A0AF484048AEDFB5E074A5EB5E5F6
P0: Pass，MSI 管理员权限静默安装通过；非管理员 /qn 静默安装受 per-machine 权限限制
P1: Blocked，高 DPI、删除回收站需要补验
Known blockers: UI 删除需确认；高 DPI 需改系统缩放；旧 updater public key 安装版需手动升级到新 key 版本
Release note changes required: 不得把 Windows 1.0.0 写成 Released / Stable
```

## 产物位置

导出结果已经收进本包：

- `artifacts/export/complex-export.html`
- `artifacts/export/complex-export.pdf`
- `artifacts/export/complex-export.png`
- `artifacts/export/complex-export.docx`
- `artifacts/export/windows-smoke.html`
