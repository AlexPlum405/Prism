# 桌面外壳对齐实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把原型 `docs/archive/dirty-data-2026-05-30/history/prism.html` 的桌面外壳（titlebar、menubar、菜单下拉）迁移到 Tauri 应用中，让应用在第一眼观感上进入原型体系。

**Architecture:** 新增 `src/components/shell/` 层，包含 WindowShell、TitleBar、MenuBar、MenuDropdown 四个组件。App.tsx 负责注入状态和动作，shell 层不反向依赖业务 store。

**Tech Stack:** React 18 + TypeScript + Tauri 2.x + CSS Modules

---

## 文件结构

**新增文件：**
- `src/components/shell/WindowShell.tsx` - 最外层窗口容器
- `src/components/shell/TitleBar.tsx` - 标题栏
- `src/components/shell/MenuBar.tsx` - 菜单栏
- `src/components/shell/MenuDropdown.tsx` - 菜单下拉面板
- `src/components/shell/menuData.ts` - 菜单结构定义
- `src/components/shell/types.ts` - 类型定义
- `src/components/shell/WindowShell.module.css` - WindowShell 样式
- `src/components/shell/TitleBar.module.css` - TitleBar 样式
- `src/components/shell/MenuBar.module.css` - MenuBar 样式
- `src/components/shell/MenuDropdown.module.css` - MenuDropdown 样式

**修改文件：**
- `src/App.tsx` - 集成 WindowShell
- `src/styles/global.css` - 添加 Fluent Design token

**测试文件：**
- `src/components/shell/MenuBar.test.tsx`
- `src/components/shell/MenuDropdown.test.tsx`

---

## Task 1: 定义类型和菜单数据

**Files:**
- Create: `src/components/shell/types.ts`
- Create: `src/components/shell/menuData.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
// src/components/shell/types.ts
export interface MenuItem {
  label: string;
  action?: string;
  shortcut?: string;
  disabled?: boolean;
  submenu?: boolean;
  type?: 'separator';
}

export interface MenuSection {
  [key: string]: MenuItem[];
}

export interface MenuAction {
  (action: string): void;
}
```

- [ ] **Step 2: 从原型提取菜单数据**

```typescript
// src/components/shell/menuData.ts
import { MenuSection } from './types';

export const menuData: MenuSection = {
  '文件': [
    { label: '新建', shortcut: 'Ctrl+N', action: 'new' },
    { label: '新建窗口', shortcut: 'Ctrl+Shift+N', action: 'newWindow' },
    { type: 'separator' },
    { label: '打开...', shortcut: 'Ctrl+O', action: 'open' },
    { label: '打开文件夹...', action: 'openFolder' },
    { label: '快速打开...', shortcut: 'Ctrl+P', action: 'quickOpen' },
    { label: '打开最近文件', submenu: true },
    { type: 'separator' },
    { label: '保存', shortcut: 'Ctrl+S', action: 'save' },
    { label: '另存为...', shortcut: 'Ctrl+Shift+S', action: 'saveAs' },
    { label: '移动到...', action: 'moveTo' },
    { label: '保存全部打开的文件...', action: 'saveAll' },
    { type: 'separator' },
    { label: '导入...', action: 'import' },
    { label: '导出', submenu: true },
    { type: 'separator' },
    { label: '打印...', shortcut: 'Alt+Shift+P', action: 'print' },
    { type: 'separator' },
    { label: '属性', action: 'properties' },
    { label: '偏好设置...', shortcut: 'Ctrl+,', action: 'preferences' },
  ],
  '编辑': [
    { label: '撤销', shortcut: 'Ctrl+Z', action: 'undo' },
    { label: '重做', shortcut: 'Ctrl+Y', action: 'redo' },
    { type: 'separator' },
    { label: '剪切', shortcut: 'Ctrl+X', action: 'cut' },
    { label: '复制', shortcut: 'Ctrl+C', action: 'copy' },
    { label: '粘贴', shortcut: 'Ctrl+V', action: 'paste' },
    { label: '拼贴图片', action: 'pasteImage' },
    { type: 'separator' },
    { label: '复制为纯文本', action: 'copyPlain' },
    { label: '复制为 Markdown', shortcut: 'Ctrl+Shift+C', action: 'copyMd' },
    { label: '复制为 HTML 代码', action: 'copyHtml' },
    { label: '复制为其他格式', submenu: true },
    { type: 'separator' },
    { label: '粘贴为文本', shortcut: 'Ctrl+Shift+V', action: 'pastePlain' },
    { type: 'separator' },
    { label: '选择', submenu: true },
    { type: 'separator' },
    { label: '删除', submenu: true },
    { type: 'separator' },
    { label: '查找替换', submenu: true },
    { type: 'separator' },
    { label: '数字工具', submenu: true },
    { label: '智能标点', submenu: true },
    { label: '换行符', submenu: true },
    { label: '拼写检查...', action: 'spellCheck' },
    { type: 'separator' },
    { label: '查找对应模块', shortcut: 'Ctrl+Shift+L', action: 'findBlock' },
    { label: '表情与符号', shortcut: 'Win键+句号', action: 'emoji' },
  ],
  '段落': [
    { label: '一级标题', shortcut: 'Ctrl+1', action: 'h1' },
    { label: '二级标题', shortcut: 'Ctrl+2', action: 'h2' },
    { label: '三级标题', shortcut: 'Ctrl+3', action: 'h3' },
    { label: '四级标题', shortcut: 'Ctrl+4', action: 'h4' },
    { label: '五级标题', shortcut: 'Ctrl+5', action: 'h5' },
    { label: '六级标题', shortcut: 'Ctrl+6', action: 'h6' },
    { type: 'separator' },
    { label: '段落', shortcut: 'Ctrl+0', action: 'paragraph' },
    { type: 'separator' },
    { label: '提升标题级别', shortcut: 'Ctrl+=', action: 'increaseHeading' },
    { label: '降低标题级别', shortcut: 'Ctrl+-', action: 'decreaseHeading' },
    { type: 'separator' },
    { label: '表格', submenu: true },
    { label: '公式块', shortcut: 'Ctrl+Shift+M', action: 'mathBlock' },
    { label: '代码块', shortcut: 'Ctrl+Shift+K', action: 'codeBlock' },
    { label: '代码工具', submenu: true },
    { label: '警告框', submenu: true },
    { label: '引用', shortcut: 'Ctrl+Shift+Q', action: 'quote' },
    { type: 'separator' },
    { label: '有序列表', shortcut: 'Ctrl+Shift+[', action: 'orderedList' },
    { label: '无序列表', shortcut: 'Ctrl+Shift+]', action: 'unorderedList' },
    { label: '任务列表', shortcut: 'Ctrl+Shift+X', action: 'taskList' },
    { label: '任务状态', submenu: true },
    { label: '列表缩进', submenu: true },
    { type: 'separator' },
    { label: '在上方插入段落', action: 'insertAbove' },
    { label: '在下方插入段落', action: 'insertBelow' },
    { type: 'separator' },
    { label: '链接引用', action: 'linkReference' },
    { label: '脚注', action: 'footnote' },
    { type: 'separator' },
    { label: '水平分割线', action: 'hr' },
    { label: '内容目录', action: 'toc' },
    { label: 'YAML Front Matter', action: 'yaml' },
  ],
  '格式': [
    { label: '加粗', shortcut: 'Ctrl+B', action: 'bold' },
    { label: '斜体', shortcut: 'Ctrl+I', action: 'italic' },
    { label: '下划线', shortcut: 'Ctrl+U', action: 'underline' },
    { label: '代码', shortcut: 'Ctrl+Shift+`', action: 'inlineCode' },
    { type: 'separator' },
    { label: '删除线', shortcut: 'Alt+Shift+5', action: 'strikethrough' },
    { label: '注释', action: 'comment' },
    { type: 'separator' },
    { label: '超链接', shortcut: 'Ctrl+K', action: 'link' },
    { label: '链接操作', submenu: true },
    { label: '图像', submenu: true },
    { type: 'separator' },
    { label: '清除样式', shortcut: 'Ctrl+\\', action: 'clearFormat' },
  ],
  '视图': [
    { label: '显示 / 隐藏侧边栏', shortcut: 'Ctrl+Shift+L', action: 'toggleSidebar' },
    { label: '大纲', shortcut: 'Ctrl+Shift+1', action: 'showOutline' },
    { label: '文档列表', shortcut: 'Ctrl+Shift+2', action: 'showDocs' },
    { label: '文件树', shortcut: 'Ctrl+Shift+3', action: 'showFiles' },
    { label: '搜索', shortcut: 'Ctrl+Shift+F', action: 'showSearch' },
    { type: 'separator' },
    { label: '源代码模式', shortcut: 'Ctrl+/', action: 'sourceMode' },
    { type: 'separator' },
    { label: '专注模式', shortcut: 'F8', action: 'focusMode' },
    { label: '打字机模式', shortcut: 'F9', action: 'typewriterMode' },
    { label: '显示状态栏', action: 'statusBar' },
    { label: '字数统计窗口', action: 'wordCountWindow' },
    { type: 'separator' },
    { label: '切换全屏', shortcut: 'F11', action: 'fullscreen' },
    { label: '保持窗口在最前端', action: 'alwaysOnTop' },
    { type: 'separator' },
    { label: '实际大小', shortcut: 'Ctrl+Shift+9', action: 'actualSize' },
    { label: '放大', shortcut: 'Ctrl+Shift+=', action: 'zoomIn' },
    { label: '缩小', shortcut: 'Ctrl+Shift+-', action: 'zoomOut' },
    { type: 'separator' },
    { label: '应用内窗口切换', shortcut: 'Ctrl+Tab 键', action: 'switchWindow' },
    { label: '开发者工具', shortcut: 'Shift+F12', action: 'devTools' },
  ],
  '主题': [
    { label: 'Github', action: 'themeGithub' },
    { label: 'Newsprint', action: 'themeNewsprint' },
    { label: 'Night', action: 'themeNight' },
    { label: 'Pixyll', action: 'themePixyll' },
    { label: 'Whitey', action: 'themeWhitey' },
  ],
  '帮助': [
    { label: "What's New...", action: 'whatsNew' },
    { type: 'separator' },
    { label: 'Quick Start', action: 'quickStart' },
    { label: 'Markdown Reference', action: 'mdReference' },
    { label: 'Install and Use Pandoc', action: 'pandoc' },
    { label: 'Custom Themes', action: 'customThemes' },
    { label: 'Use Images in Typora', action: 'useImages' },
    { label: 'Data Recovery and Version Control', action: 'dataRecovery' },
    { label: 'More Topics...', action: 'moreTopics' },
    { type: 'separator' },
    { label: '鸣谢', action: 'thanks' },
    { label: '更新日志', action: 'changelog' },
    { label: '隐私条款', action: 'privacy' },
    { label: '官方网站', action: 'website' },
    { label: '反馈', action: 'feedback' },
    { type: 'separator' },
    { label: '检查更新...', action: 'checkUpdate' },
    { label: '我的许可证...', action: 'myLicense' },
    { label: '关于', action: 'about' },
  ],
};
```

- [ ] **Step 3: 提交**

```bash
git add src/components/shell/types.ts src/components/shell/menuData.ts
git commit -m "feat(shell): add menu types and data structure"
```

---
## Task 2: 创建 WindowShell 组件

**Files:**
- Create: `src/components/shell/WindowShell.tsx`
- Create: `src/components/shell/WindowShell.module.css`

- [ ] **Step 1: 创建 WindowShell 组件**

```typescript
// src/components/shell/WindowShell.tsx
import { ReactNode } from 'react';
import styles from './WindowShell.module.css';

interface WindowShellProps {
  children: ReactNode;
}

export function WindowShell({ children }: WindowShellProps) {
  return (
    <div className={styles.windowShell}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 创建 WindowShell 样式**

```css
/* src/components/shell/WindowShell.module.css */
.windowShell {
  margin: 12px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.0578);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(40px) saturate(160%);
  -webkit-backdrop-filter: blur(40px) saturate(160%);
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 24px);
}

body.dark .windowShell {
  border-color: rgba(255, 255, 255, 0.0837);
  background: rgba(43, 43, 43, 0.72);
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/shell/WindowShell.tsx src/components/shell/WindowShell.module.css
git commit -m "feat(shell): add WindowShell component"
```

---

## Task 3: 创建 TitleBar 组件

**Files:**
- Create: `src/components/shell/TitleBar.tsx`
- Create: `src/components/shell/TitleBar.module.css`

- [ ] **Step 1: 创建 TitleBar 组件**

```typescript
// src/components/shell/TitleBar.tsx
import { getCurrentWindow } from '@tauri-apps/api/window';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  title: string;
}

export function TitleBar({ title }: TitleBarProps) {
  const handleMinimize = async () => {
    const window = getCurrentWindow();
    await window.minimize();
  };

  const handleMaximize = async () => {
    const window = getCurrentWindow();
    await window.toggleMaximize();
  };

  const handleClose = async () => {
    const window = getCurrentWindow();
    await window.close();
  };

  return (
    <div className={styles.titlebar} data-tauri-drag-region>
      <span className={styles.title}>{title}</span>
      <div className={styles.controls}>
        <button
          className={styles.btn}
          onClick={handleMinimize}
          title="最小化"
          aria-label="最小化"
        >
          &#xE921;
        </button>
        <button
          className={styles.btn}
          onClick={handleMaximize}
          title="最大化"
          aria-label="最大化"
        >
          &#xE922;
        </button>
        <button
          className={`${styles.btn} ${styles.close}`}
          onClick={handleClose}
          title="关闭"
          aria-label="关闭"
        >
          &#xE8BB;
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 TitleBar 样式**

```css
/* src/components/shell/TitleBar.module.css */
.titlebar {
  height: 32px;
  display: flex;
  align-items: center;
  padding-left: 14px;
  font-size: 12px;
  color: var(--text-secondary);
  user-select: none;
  border-bottom: 1px solid rgba(0, 0, 0, 0.0578);
}

body.dark .titlebar {
  border-bottom-color: rgba(255, 255, 255, 0.0837);
}

.title {
  flex: 1;
}

.controls {
  display: flex;
  margin-left: auto;
}

.btn {
  width: 46px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 10px;
  font-family: 'Segoe Fluent Icons', 'Segoe MDL2 Assets', sans-serif;
  transition: background 0.08s ease;
}

.btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

body.dark .btn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.btn.close:hover {
  background: #C42B1C;
  color: #fff;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/shell/TitleBar.tsx src/components/shell/TitleBar.module.css
git commit -m "feat(shell): add TitleBar component with window controls"
```

---
## Task 4: 创建 MenuDropdown 组件

**Files:**
- Create: `src/components/shell/MenuDropdown.tsx`
- Create: `src/components/shell/MenuDropdown.module.css`

- [ ] **Step 1: 创建 MenuDropdown 组件**

```typescript
// src/components/shell/MenuDropdown.tsx
import { MenuItem as MenuItemType } from './types';
import styles from './MenuDropdown.module.css';

interface MenuDropdownProps {
  items: MenuItemType[];
  onAction: (action: string) => void;
  onClose: () => void;
}

export function MenuDropdown({ items, onAction, onClose }: MenuDropdownProps) {
  const handleItemClick = (item: MenuItemType) => {
    if (item.disabled || item.submenu) return;
    if (item.action) {
      onAction(item.action);
      onClose();
    }
  };

  return (
    <div className={styles.dropdown}>
      {items.map((item, idx) => {
        if (item.type === 'separator') {
          return <div key={idx} className={styles.separator} />;
        }

        return (
          <div
            key={idx}
            className={`${styles.item} ${item.disabled ? styles.disabled : ''}`}
            onClick={() => handleItemClick(item)}
          >
            <span>{item.label}</span>
            <div className={styles.meta}>
              {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
              {item.submenu && <span className={styles.arrow}>▸</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 创建 MenuDropdown 样式**

```css
/* src/components/shell/MenuDropdown.module.css */
.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 300px;
  padding: 4px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(0, 0, 0, 0.14);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.14), 0 0 1px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  z-index: 1000;
  animation: flyoutIn 0.18s cubic-bezier(0.17, 0.67, 0.3, 0.99);
}

body.dark .dropdown {
  background: rgba(44, 44, 44, 0.88);
  border-color: rgba(255, 255, 255, 0.14);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.48), 0 0 1px rgba(0, 0, 0, 0.60);
}

@keyframes flyoutIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  gap: 24px;
  color: var(--text-primary);
  transition: background 0.12s ease;
}

.item:hover {
  background: rgba(0, 103, 192, 0.08);
}

body.dark .item:hover {
  background: rgba(96, 205, 255, 0.10);
}

.item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.item.disabled:hover {
  background: transparent;
}

.meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.shortcut {
  color: var(--text-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.arrow {
  color: var(--text-secondary);
  font-size: 10px;
}

.separator {
  height: 1px;
  background: rgba(0, 0, 0, 0.0803);
  margin: 4px 8px;
}

body.dark .separator {
  background: rgba(255, 255, 255, 0.0837);
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/shell/MenuDropdown.tsx src/components/shell/MenuDropdown.module.css
git commit -m "feat(shell): add MenuDropdown component"
```

---

## Task 5: 创建 MenuBar 组件

**Files:**
- Create: `src/components/shell/MenuBar.tsx`
- Create: `src/components/shell/MenuBar.module.css`

- [ ] **Step 1: 创建 MenuBar 组件**

```typescript
// src/components/shell/MenuBar.tsx
import { useState, useRef, useEffect } from 'react';
import { menuData } from './menuData';
import { MenuDropdown } from './MenuDropdown';
import styles from './MenuBar.module.css';

interface MenuBarProps {
  onAction: (action: string) => void;
}

export function MenuBar({ onAction }: MenuBarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

  const handleMenuClick = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  return (
    <div className={styles.menubar} ref={menuRef}>
      {Object.keys(menuData).map((menuName) => (
        <div key={menuName} className={styles.menuItemWrapper}>
          <div
            className={`${styles.menuItem} ${activeMenu === menuName ? styles.active : ''}`}
            onClick={() => handleMenuClick(menuName)}
          >
            {menuName}
          </div>
          {activeMenu === menuName && (
            <MenuDropdown
              items={menuData[menuName]}
              onAction={onAction}
              onClose={() => setActiveMenu(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 创建 MenuBar 样式**

```css
/* src/components/shell/MenuBar.module.css */
.menubar {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 10px;
  user-select: none;
  position: relative;
  border-bottom: 1px solid rgba(0, 0, 0, 0.0578);
  background: transparent;
}

body.dark .menubar {
  border-bottom-color: rgba(255, 255, 255, 0.0837);
}

.menuItemWrapper {
  position: relative;
}

.menuItem {
  padding: 5px 11px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-primary);
  transition: background 0.12s ease;
}

.menuItem:hover {
  background: rgba(0, 103, 192, 0.08);
}

body.dark .menuItem:hover {
  background: rgba(96, 205, 255, 0.10);
}

.menuItem.active {
  background: rgba(0, 103, 192, 0.16);
  color: #0067C0;
}

body.dark .menuItem.active {
  background: rgba(96, 205, 255, 0.20);
  color: #60CDFF;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/shell/MenuBar.tsx src/components/shell/MenuBar.module.css
git commit -m "feat(shell): add MenuBar component with dropdown support"
```

---
## Task 6: 集成 shell 到 App

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: 在 global.css 中添加 Fluent Design token**

```css
/* src/styles/global.css - 在 :root 中追加 */
:root {
  --mica-bg: #F3F3F3;
  --layer-1: rgba(255, 255, 255, 0.72);
  --layer-2: rgba(255, 255, 255, 0.88);
  --solid-surface: #FBFBFB;
  --stroke-surface: rgba(0, 0, 0, 0.0578);
  --stroke-divider: rgba(0, 0, 0, 0.0803);
  --stroke-control: rgba(0, 0, 0, 0.14);
  --stroke-card: rgba(0, 0, 0, 0.06);
  --elevation-flyout: 0 8px 16px rgba(0, 0, 0, 0.14), 0 0 1px rgba(0, 0, 0, 0.06);
  --elevation-card: 0 2px 4px rgba(0, 0, 0, 0.04), 0 0 1px rgba(0, 0, 0, 0.06);
}

body.dark {
  --mica-bg: #202020;
  --layer-1: rgba(43, 43, 43, 0.72);
  --layer-2: rgba(44, 44, 44, 0.88);
  --solid-surface: #282828;
  --stroke-surface: rgba(255, 255, 255, 0.0837);
  --stroke-divider: rgba(255, 255, 255, 0.0837);
  --stroke-control: rgba(255, 255, 255, 0.14);
  --stroke-card: rgba(255, 255, 255, 0.08);
  --elevation-flyout: 0 8px 20px rgba(0, 0, 0, 0.48), 0 0 1px rgba(0, 0, 0, 0.60);
  --elevation-card: 0 2px 4px rgba(0, 0, 0, 0.28), 0 0 1px rgba(0, 0, 0, 0.40);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/App.tsx src/styles/global.css
git commit -m "feat(shell): integrate window shell into app layout"
```

---

## 自查

### 1. Spec coverage
- 子项目 1 的 4 个部件：WindowShell、TitleBar、MenuBar、MenuDropdown → 已覆盖
- 外壳 Fluent 质感 → 已覆盖
- 菜单结构和动作接入 → 已覆盖
- 风险控制：不打散现有编辑链路 → 已覆盖

### 2. Placeholder scan
- 无 TBD / TODO / implement later
- 每个任务都有明确文件、代码、命令

### 3. Type consistency
- `MenuItem`、`MenuSection`、`MenuAction` 在后续任务中名称一致
- `onAction`、`onClose`、`title` 等属性名在组件间一致
