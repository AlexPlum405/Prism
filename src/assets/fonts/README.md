# Prism 字体资源

本目录存放 Prism 界面使用的自托管字体文件（ADR-0003：本地打包）。

## 基础字体（界面 + 编辑器，所有主题共用）

| 文件 | 体积 | 来源 | 用途 |
|---|---|---|---|
| `Inter-Variable.woff2` | 352 KB | https://github.com/rsms/inter | 界面 UI、默认正文（变量字体覆盖 100–900） |
| `JetBrainsMono-Regular.woff2` | 92 KB | https://github.com/JetBrains/JetBrainsMono | 编辑器、代码块 |
| `JetBrainsMono-Medium.woff2` | 94 KB | 同上 | 编辑器加粗、代码块 |
| `TsangerJinKai02-W04.ttf` | 19 MB | 仓耳官方 | 中文楷体（miaoyan / inkstone） |

## 主题专用字体（按 compatibility theme 切换）

每套字体跨越不同字体分类，确保任意两套主题视觉上一眼可辨。

| 文件 | 体积 | 字体分类 | 主题 | 来源 |
|---|---|---|---|---|
| `IBMPlexSans-Variable.woff2` | 46 KB | Humanist sans（人文无衬线） | slate | fontsource (IBM Plex) |
| `Newsreader-Variable.woff2` | 58 KB | Old-style serif（旧式衬线） | nocturne | fontsource (Production Type) |
| `SourceSerif4-Variable.woff2` | 51 KB | Modern serif（现代衬线） | nocturne fallback | fontsource (Adobe) |

`mono` 主题复用 `JetBrainsMono`，`inkstone` 主题复用仓耳今楷。

旧内容主题（classic / github / whitey / newsprint / pixyll / night）已经从运行时代码中移除。

## 挂载方式

`src/styles/tokens.css` 用 `@font-face` 以相对路径引用 `../assets/fonts/*.woff2`，并由 `src/styles/global.css` 按层导入；Vite 构建时自动作为静态资源处理（带 hash 指纹输出到 `dist/assets/`）。

变量字体使用 `format('woff2-variations')` + `font-weight: <min> <max>` 声明字重区间，CSS 中通过 `font-weight` 数值无极调用。

## 许可证

- Inter / JetBrains Mono / IBM Plex Sans / Source Serif 4 / Newsreader：均为 **SIL Open Font License 1.1**，允许随应用免费分发与商用。
- 仓耳今楷 02 W04：仓耳科技免费授权（个人 & 商业）。

"关于 Prism" 页面已致谢。
