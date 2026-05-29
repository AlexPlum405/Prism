# Prism Windows 图标品牌一致性验证手册

> 状态：待 Windows 实机验证
> 适用场景：在 Windows 重新打包 Prism 后，验证小熊猫写作图标在 Windows 与 macOS 上是否保持同一品牌识别和接近一致的展示效果。
> 当前图标源：`docs/assets/prism-icon-red-panda-app-icon.png`
> 生成命令：`npm run icons:generate`

## 1. 验证目标

本次不是重新设计图标，而是验证同一品牌图标在 Windows 和 macOS 上的跨平台一致性。

必须满足：

- Windows 和 macOS 使用同一个品牌母版，不允许出现两套不同图标。
- Windows 小尺寸图标可以做轻微清晰度优化，但不能改变图形、颜色、构图和品牌识别。
- Windows 任务栏、开始菜单、桌面快捷方式、资源管理器里的图标不能糊成无法识别的色块。
- Windows 图标效果应和 macOS Dock 图标属于同一视觉家族，不能看起来像两个品牌。

## 2. 打包前检查

在 Windows 仓库根目录执行：

```powershell
git status --short --branch
npm ci
npm run icons:generate
npm run build
```

检查图标资产是否存在：

```powershell
Test-Path .\src-tauri\app-icon.png
Test-Path .\src-tauri\icons\icon.ico
Test-Path .\src-tauri\icons\Square44x44Logo.png
Test-Path .\src-tauri\icons\Square150x150Logo.png
Test-Path .\src-tauri\icons\Square310x310Logo.png
Test-Path .\src-tauri\icons\StoreLogo.png
```

预期：全部输出 `True`。

如果安装了 ImageMagick，可检查 ICO 尺寸层级：

```powershell
magick identify .\src-tauri\icons\icon.ico
```

预期至少包含：

```text
16x16
24x24
32x32
48x48
64x64
128x128
256x256
```

## 3. Windows 打包

普通本地验证可以先打 Windows 包：

```powershell
npm run tauri:build
```

如果只是快速看 `.exe` 图标，也可以使用 Tauri 实际生成的 release 目录产物。具体路径以打包输出为准，常见位置包括：

```text
src-tauri\target\release\
src-tauri\target\release\bundle\nsis\
src-tauri\target\release\bundle\msi\
```

## 4. 安装前图标检查

在资源管理器中打开：

```text
src-tauri\target\release\
```

检查项：

- `app.exe` 或最终 Prism 可执行文件显示的是小熊猫写作文档图标。
- 中等图标、大图标、超大图标模式下，图标仍是暖色圆角底 + 小熊猫头部 + 文档卡片。
- 不能显示成默认 Windows 空白应用图标。
- 不能显示成旧图标。
- 不能出现白底方块、黑边残影、透明背景错误。

通过标准：

- 资源管理器里能一眼认出和 macOS Dock 同一个图标。
- 大尺寸下小熊猫表情、耳朵和文档卡片清楚。
- 小尺寸下即使文档线条弱化，小熊猫头部和暖色圆角底仍清楚。

## 5. 安装后图标检查

安装 Prism 后，分别检查以下位置。

桌面快捷方式：

- 桌面快捷方式显示小熊猫写作图标。
- 缩放到小图标 / 中等图标 / 大图标时不丢失主体。

开始菜单：

- 开始菜单搜索 `Prism`，结果显示小熊猫写作图标。
- 固定到开始菜单后，磁贴或入口图标不是默认图标。

任务栏：

- 启动 Prism 后，任务栏图标显示小熊猫写作图标。
- 固定到任务栏后关闭并重新打开，固定图标仍是小熊猫写作图标。
- 任务栏小尺寸下不能糊成纯白点、纯橙色块或默认空白图标。

资源管理器：

- 安装目录中的主程序图标正常。
- `.md` 文件如果已关联 Prism，文件图标不能显示成默认空白文件。

## 6. 文件关联验证

准备一个测试文件：

```powershell
New-Item -ItemType File -Path "$env:USERPROFILE\Desktop\prism-icon-test.md" -Force
```

检查：

- 右键 `.md` 文件，选择“打开方式”，能看到 Prism 图标。
- 如果设置 Prism 为默认打开方式，桌面上的 `.md` 文件图标显示正常。
- 双击 `.md` 文件可以打开 Prism。
- 文件关联图标不要和应用主图标冲突到难以理解；如果产品决定文档图标和应用图标共用，也必须显示清晰。

## 7. Windows 显示缩放验证

至少检查两个缩放档位：

- 100%
- 125% 或 150%

如果有高分屏，再补充检查：

- 200%

每个缩放档位检查：

- 任务栏图标是否清楚。
- 开始菜单图标是否清楚。
- 资源管理器中等/大图标是否清楚。
- 图标边缘是否有锯齿、白边、黑边或透明异常。

## 8. 和 macOS 对比

打开 macOS 版本 Prism 或查看 macOS 图标：

```bash
open docs/assets/prism-icon-red-panda-app-icon.png
```

对比 Windows：

- 主体是否都是同一个小熊猫趴在文档卡片后的构图。
- 背景是否都是暖色圆角方形。
- 小熊猫、文档卡片和底部阴影的相对比例是否一致。
- 图标整体比例是否接近，不应出现 Windows 明显更胖、更窄、主体偏移或被裁切。

允许差异：

- Windows 小尺寸中文档线条更弱。
- Windows 小尺寸中小熊猫边缘略微更锐利。
- 不同系统抗锯齿导致边缘观感略有差异。

不允许差异：

- Windows 看起来像另一版图标。
- Windows 小尺寸小熊猫脸部、耳朵或文档卡片被裁掉。
- Windows 背景圆角消失、透明边缘异常或出现硬底。
- Windows 图标和 macOS 图标颜色明显不一致。

## 9. 验收结论模板

Windows 验证完成后，把结果追加到这里。

```text
日期：
Windows 版本：
屏幕缩放：
构建命令：
安装器或 exe 路径：

打包前图标资产检查：
ICO 尺寸层级：
资源管理器 exe 图标：
桌面快捷方式：
开始菜单：
任务栏运行态：
任务栏固定后：
.md 文件关联图标：
100% 缩放：
125% / 150% 缩放：
高分屏 / 200% 缩放：
和 macOS 对比：

发现的问题：
是否阻塞定稿：
结论：
```

## 10. 判定规则

可以通过：

- 所有 Windows 入口都能显示小熊猫写作图标。
- 小尺寸下主体仍能识别。
- 与 macOS 视觉一致，只有系统渲染和尺寸导致的轻微差异。

需要返工：

- 任务栏图标无法识别。
- 开始菜单或快捷方式显示默认图标。
- `.exe` 图标仍是旧图标。
- `.md` 文件关联图标显示异常。
- Windows 和 macOS 看起来像两个品牌。
