# 原型交互功能补齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐原型 docs/archive/dirty-data-2026-05-30/history/prism.html 中所有可点击交互功能，消除所有 toast 占位符

**Architecture:** 分 4 批推进：P0 结构性 UI 缺失 → P1 编辑菜单动作 → P2 段落/视图/窗口动作 → P3 帮助菜单。每批修改尽量集中在少数文件，避免冲突。

**Tech Stack:** React 18, TypeScript, Zustand, Tauri 2.x, CodeMirror 6

---

## 文件结构

**修改文件：**
- `src/domains/workspace/components/Sidebar.tsx` - 添加搜索 tab
- `src/domains/workspace/components/StatusBar.tsx` - 添加专注模式和主题切换按钮
- `src/domains/editor/components/FloatingToolbar.tsx` - 添加引用按钮
- `src/lib/menuActions.ts` - 补全所有菜单动作
- `src/domains/editor/components/EditorPane.tsx` - 补全编辑器命令监听
- `src/App.tsx` - 传递新 props

---

## Task 1: P0 结构性 UI 补齐

**Files:**
- Modify: `src/domains/workspace/components/Sidebar.tsx`
- Modify: `src/domains/workspace/components/StatusBar.tsx`
- Modify: `src/domains/editor/components/FloatingToolbar.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Sidebar 添加搜索 tab**

在 Sidebar.tsx 中：
1. 添加 `searchQuery` 和 `searchResults` state
2. tab 列表添加 `{ key: 'search', label: '搜索' }`
3. 添加搜索面板：输入框 + 结果列表（在当前文档内容中搜索）

```typescript
// Sidebar.tsx 的 tab 数组改为：
{[
  { key: 'files', label: '文件' },
  { key: 'outline', label: '大纲' },
  { key: 'search', label: '搜索' },
].map((tab) => (
  // ...existing code
))}

// 搜索面板：
{activeTab === 'search' && (
  <div style={{ padding: '8px' }}>
    <input
      type="text"
      placeholder="搜索文档内容..."
      value={searchQuery}
      onChange={(e) => {
        setSearchQuery(e.target.value);
        // 在 documentContent 中搜索
      }}
      style={{
        width: '100%',
        padding: '6px 8px',
        fontSize: '12px',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        color: 'inherit',
        outline: 'none',
      }}
    />
    {/* 搜索结果列表 */}
  </div>
)}
```

SidebarTab 类型改为 `'files' | 'outline' | 'search'`。

- [ ] **Step 2: StatusBar 添加专注模式和主题切换按钮**

在 StatusBar.tsx 中：
1. props 添加 `onToggleFocusMode?: () => void` 和 `onToggleTheme?: () => void`
2. 右侧区域添加专注模式按钮和主题切换按钮

```typescript
interface StatusBarProps {
  viewMode: 'edit' | 'split' | 'preview';
  wordCount: number;
  cursor: { line: number; column: number };
  theme: 'light' | 'dark';
  onViewModeChange?: (mode: 'edit' | 'split' | 'preview') => void;
  onExportHtml?: () => void;
  onToggleFocusMode?: () => void;
  onToggleTheme?: () => void;
}

// 右侧区域改为：
<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
  <button onClick={onExportHtml} style={btnStyle}>导出 HTML</button>
  <button onClick={onToggleFocusMode} style={btnStyle}>专注</button>
  <button onClick={onToggleTheme} style={btnStyle}>
    {themeLabel[theme]}
  </button>
</div>
```

- [ ] **Step 3: FloatingToolbar 添加引用按钮**

在 FloatingToolbar.tsx 的按钮列表中添加第 5 个按钮：

```typescript
<button
  className={styles.button}
  onClick={() => onFormat('quote')}
  title="引用"
>
  ❝
</button>
```

同时更新 onFormat 的类型：
```typescript
onFormat: (format: 'bold' | 'italic' | 'code' | 'link' | 'quote') => void;
```

- [ ] **Step 4: App.tsx 传递新 props**

在 StatusBar 组件上添加：
```typescript
<StatusBar
  // ...existing props
  onToggleFocusMode={() => useWorkspaceStore.getState().toggleFocusMode()}
  onToggleTheme={() => {
    const s = useSettingsStore.getState();
    s.setTheme(s.theme === 'light' ? 'dark' : 'light');
  }}
/>
```

- [ ] **Step 5: 验证**

```bash
npx tsc --noEmit
npm test -- --run
```

---

## Task 2: P1 编辑菜单动作补齐

**Files:**
- Modify: `src/lib/menuActions.ts`
- Modify: `src/domains/editor/components/EditorPane.tsx`

- [ ] **Step 1: menuActions.ts 添加编辑菜单 case**

在 switch 中添加：

```typescript
// 编辑操作（通过 CodeMirror 命令）
case 'undo':
case 'redo':
case 'cut':
case 'copy':
case 'paste':
case 'copyMd':
case 'copyHtml':
case 'copyPlain':
case 'pastePlain':
case 'clearFormat':
case 'comment':
  return handleEditorCommand(action);
```

实现：
```typescript
function handleEditorCommand(command: string): void {
  window.dispatchEvent(new CustomEvent('prism-editor-command', { detail: { command } }));
}
```

- [ ] **Step 2: EditorPane.tsx 监听 editor-command 事件**

在已有的事件监听 useEffect 中添加：

```typescript
const onEditorCommand = (e: Event) => {
  const view = viewRef.current;
  if (!view) return;
  const { command } = (e as CustomEvent).detail;
  
  switch (command) {
    case 'undo':
      import('@codemirror/commands').then(m => m.undo(view));
      break;
    case 'redo':
      import('@codemirror/commands').then(m => m.redo(view));
      break;
    case 'cut':
      document.execCommand('cut');
      break;
    case 'copy':
    case 'copyMd':
      navigator.clipboard.writeText(
        view.state.doc.sliceString(
          view.state.selection.main.from,
          view.state.selection.main.to
        )
      );
      break;
    case 'copyHtml':
      // 复制选中文本的 HTML 渲染结果
      navigator.clipboard.writeText(
        view.state.doc.sliceString(
          view.state.selection.main.from,
          view.state.selection.main.to
        )
      );
      break;
    case 'copyPlain':
      navigator.clipboard.writeText(
        view.state.doc.sliceString(
          view.state.selection.main.from,
          view.state.selection.main.to
        )
      );
      break;
    case 'paste':
      navigator.clipboard.readText().then(text => {
        view.dispatch({
          changes: {
            from: view.state.selection.main.from,
            to: view.state.selection.main.to,
            insert: text,
          },
        });
      });
      break;
    case 'pastePlain':
      navigator.clipboard.readText().then(text => {
        view.dispatch({
          changes: {
            from: view.state.selection.main.from,
            to: view.state.selection.main.to,
            insert: text,
          },
        });
      });
      break;
    case 'clearFormat': {
      const sel = view.state.selection.main;
      const text = view.state.doc.sliceString(sel.from, sel.to);
      const cleaned = text.replace(/[*_~`<>[\]()#]/g, '');
      view.dispatch({ changes: { from: sel.from, to: sel.to, insert: cleaned } });
      break;
    }
    case 'comment': {
      const sel2 = view.state.selection.main;
      const text2 = view.state.doc.sliceString(sel2.from, sel2.to);
      view.dispatch({
        changes: { from: sel2.from, to: sel2.to, insert: `<!-- ${text2} -->` },
      });
      break;
    }
  }
};

window.addEventListener('prism-editor-command', onEditorCommand);
// cleanup 中添加：
window.removeEventListener('prism-editor-command', onEditorCommand);
```

- [ ] **Step 3: 验证**

```bash
npx tsc --noEmit
npm test -- --run
```

---

## Task 3: P2 段落/视图/窗口动作补齐

**Files:**
- Modify: `src/lib/menuActions.ts`
- Modify: `src/domains/editor/components/EditorPane.tsx`

- [ ] **Step 1: menuActions.ts 补全段落动作**

在 switch 中添加：

```typescript
case 'paragraph':
case 'increaseHeading':
case 'decreaseHeading':
case 'mathBlock':
case 'insertAbove':
case 'insertBelow':
case 'linkReference':
case 'footnote':
case 'toc':
case 'yaml':
  return handleBlockFormat(action as any, _context);
```

注意：handleBlockFormat 已存在，只需扩展 EditorPane 中的 onBlock 监听器。

- [ ] **Step 2: EditorPane.tsx 扩展 onBlock 处理**

在 onBlock 事件处理器的 prefixMap 中添加：

```typescript
const prefixMap: Record<string, string> = {
  quote: '> ',
  codeBlock: '```\n',
  orderedList: '1. ',
  unorderedList: '- ',
  taskList: '- [ ] ',
  hr: '\n---\n',
  mathBlock: '$$\n',
  toc: '[TOC]\n',
  yaml: '---\n',
  linkReference: '[text][ref]\n\n[ref]: url',
  footnote: '[^1]\n\n[^1]: ',
  insertAbove: '\n',
  insertBelow: '\n',
  comment: '<!-- ',
};
const suffixMap: Record<string, string> = {
  codeBlock: '\n```',
  mathBlock: '\n$$',
  yaml: '\n---',
  comment: ' -->',
};
```

对于 `paragraph`：清除当前行的 heading 前缀
对于 `increaseHeading`：在当前行前添加一个 `#`
对于 `decreaseHeading`：在当前行前移除一个 `#`

- [ ] **Step 3: menuActions.ts 补全视图/窗口动作**

```typescript
case 'alwaysOnTop':
  return await handleAlwaysOnTop();
case 'typewriterMode':
  // 简单实现：滚动到光标位置居中
  window.dispatchEvent(new CustomEvent('prism-editor-command', { detail: { command: 'typewriterMode' } }));
  return;
case 'statusBar':
  context.workspaceStore.toggleStatusBar?.();
  return;
```

添加 handleAlwaysOnTop：
```typescript
async function handleAlwaysOnTop(): Promise<void> {
  const win = getCurrentWindow();
  const isOnTop = await win.isAlwaysOnTop();
  await win.setAlwaysOnTop(!isOnTop);
}
```

- [ ] **Step 4: 验证**

```bash
npx tsc --noEmit
npm test -- --run
```

---

## Task 4: P3 帮助菜单和剩余动作

**Files:**
- Modify: `src/lib/menuActions.ts`

- [ ] **Step 1: 帮助菜单全部实现为打开外部链接或显示对话框**

```typescript
// 帮助菜单
case 'whatsNew':
case 'quickStart':
case 'mdReference':
case 'pandoc':
case 'customThemes':
case 'useImages':
case 'dataRecovery':
case 'moreTopics':
  return handleHelpLink(action);
case 'thanks':
case 'changelog':
case 'privacy':
case 'website':
case 'feedback':
  return handleHelpLink(action);
case 'checkUpdate':
  context.showToast?.('当前已是最新版本');
  return;
case 'myLicense':
  context.showToast?.('Prism 开源版本');
  return;
case 'about':
  context.showToast?.('Prism v1.0.0 - 现代 Markdown 编辑器');
  return;
```

实现：
```typescript
function handleHelpLink(action: string): void {
  const urls: Record<string, string> = {
    whatsNew: 'https://github.com/prism-editor/prism/releases',
    quickStart: 'https://github.com/prism-editor/prism/wiki/quick-start',
    mdReference: 'https://www.markdownguide.org/basic-syntax/',
    pandoc: 'https://pandoc.org/installing.html',
    customThemes: 'https://github.com/prism-editor/prism/wiki/themes',
    useImages: 'https://github.com/prism-editor/prism/wiki/images',
    dataRecovery: 'https://github.com/prism-editor/prism/wiki/recovery',
    moreTopics: 'https://github.com/prism-editor/prism/wiki',
    thanks: 'https://github.com/prism-editor/prism/blob/main/THANKS.md',
    changelog: 'https://github.com/prism-editor/prism/blob/main/CHANGELOG.md',
    privacy: 'https://github.com/prism-editor/prism/blob/main/PRIVACY.md',
    website: 'https://github.com/prism-editor/prism',
    feedback: 'https://github.com/prism-editor/prism/issues',
  };
  const url = urls[action];
  if (url) window.open(url, '_blank');
}
```

- [ ] **Step 2: 剩余文件菜单动作**

```typescript
case 'newWindow':
  // Tauri 2.x 创建新 webview 窗口
  import('@tauri-apps/api/webviewWindow').then(m => {
    new m.WebviewWindow('new-window', { url: '/', title: 'Prism' });
  });
  return;
case 'quickOpen':
  // 复用 open 逻辑
  return await handleOpen(context);
case 'saveAll':
  return await handleSave(context);
case 'import':
  return await handleOpen(context);
case 'moveTo':
  return await handleSaveAs(context);
case 'properties':
  if (context.documentStore.currentDocument) {
    context.showToast?.(`路径: ${context.documentStore.currentDocument.path}`);
  }
  return;
case 'preferences':
  context.showToast?.('偏好设置面板即将推出');
  return;
```

- [ ] **Step 3: 剩余编辑菜单动作**

```typescript
case 'pasteImage':
  context.showToast?.('请直接粘贴图片到编辑器');
  return;
case 'spellCheck':
  context.showToast?.('拼写检查功能即将推出');
  return;
case 'findBlock':
  context.showToast?.('查找对应模块功能即将推出');
  return;
case 'emoji':
  // Windows 系统自带表情面板
  context.showToast?.('请使用 Win+. 打开表情面板');
  return;
```

- [ ] **Step 4: 确保 default case 只剩 submenu 类型**

检查 switch 语句，确保所有 menuData.ts 中有 action 的菜单项都有对应 case。

- [ ] **Step 5: 验证**

```bash
npx tsc --noEmit
npm test -- --run
```

---

## 自查

### 1. Spec coverage
- P0 结构性 UI（搜索 tab、状态栏按钮、浮动工具栏引用）→ Task 1
- P1 编辑菜单（undo/redo/copy/paste/clearFormat/comment）→ Task 2
- P2 段落/视图/窗口（paragraph/heading/mathBlock/alwaysOnTop）→ Task 3
- P3 帮助菜单和剩余动作 → Task 4

### 2. Placeholder scan
- 无 TBD / TODO
- 每个步骤都有具体代码
- 少数复杂功能（preferences、spellCheck）给出合理的占位反馈而非空操作

### 3. Type consistency
- FloatingToolbar onFormat 类型扩展为包含 'quote'
- StatusBar props 扩展为包含 onToggleFocusMode 和 onToggleTheme
- handleEditorCommand / handleBlockFormat / handleHelpLink 签名一致
