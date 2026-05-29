# Fluent Design 视觉精修设计文档

**日期：** 2026-04-26  
**目标：** 建立完整的设计 token 体系，统一全局视觉细节

---

## 背景

当前 Prism 已完成桌面外壳的基础实现（WindowShell、TitleBar、MenuBar、MenuDropdown），但视觉细节存在以下问题：

1. **缺少统一的设计 token**：圆角、强调色、透明度等值散落在各组件中
2. **硬编码值过多**：`rgba(...)` 和魔法数字直接写在 CSS 中
3. **与原型不完全一致**：`docs/archive/dirty-data-2026-05-30/history/prism.html` 有完整的设计规范，但当前实现未完全对齐

本次精修的目标是建立完整的设计 token 体系，让所有组件使用统一的视觉语言。

---

## 设计 Token 体系

### 1. 圆角 Token

从 `docs/archive/dirty-data-2026-05-30/history/prism.html` 提取的圆角规范：

```css
:root {
  --radius-sm: 4px;    /* 小圆角：菜单项、按钮 */
  --radius-md: 7px;    /* 中圆角：卡片、输入框 */
  --radius-lg: 8px;    /* 大圆角：下拉菜单、对话框 */
  --radius-xl: 12px;   /* 超大圆角：大卡片 */
  --radius-window: 14px; /* 窗口圆角 */
}
```

### 2. 强调色 Token

统一交互状态的颜色：

```css
:root {
  --accent: #0067C0;
  --accent-hover: #0078D4;
  --accent-tint: rgba(0, 103, 192, 0.08);
  --accent-tint-strong: rgba(0, 103, 192, 0.16);
}

body.dark {
  --accent: #60CDFF;
  --accent-hover: #99EBFF;
  --accent-tint: rgba(96, 205, 255, 0.10);
  --accent-tint-strong: rgba(96, 205, 255, 0.20);
}
```

### 3. 表面与描边 Token

已存在的 token，保持不变：

- `--layer-1`: 主要表面层（0.72 透明度）
- `--layer-2`: 次要表面层（0.88 透明度）
- `--solid-surface`: 不透明表面
- `--stroke-surface`: 表面边框
- `--stroke-divider`: 分隔线
- `--stroke-control`: 控件边框
- `--stroke-card`: 卡片边框

### 4. 阴影 Token

已存在的 token，保持不变：

- `--elevation-flyout`: 浮层阴影（菜单、下拉）
- `--elevation-card`: 卡片阴影

---

## 组件迁移计划

### Shell 组件（优先级 1）

#### WindowShell.module.css
```css
/* 修改前 */
border-radius: 14px;
border: 1px solid rgba(0, 0, 0, 0.0578);
background: rgba(255, 255, 255, 0.72);

/* 修改后 */
border-radius: var(--radius-window);
border: 1px solid var(--stroke-surface);
background: var(--layer-1);
```

#### TitleBar.module.css
```css
/* 修改前 */
border-bottom: 1px solid rgba(0, 0, 0, 0.0578);
.btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

/* 修改后 */
border-bottom: 1px solid var(--stroke-surface);
.btn:hover {
  background: var(--accent-tint);
}
```

#### MenuBar.module.css
```css
/* 修改前 */
border-radius: 4px;
border-bottom: 1px solid rgba(0, 0, 0, 0.0578);
.menuItem:hover {
  background: rgba(0, 103, 192, 0.08);
}
.menuItem.active {
  background: rgba(0, 103, 192, 0.16);
  color: #0067C0;
}

/* 修改后 */
border-radius: var(--radius-sm);
border-bottom: 1px solid var(--stroke-surface);
.menuItem:hover {
  background: var(--accent-tint);
}
.menuItem.active {
  background: var(--accent-tint-strong);
  color: var(--accent);
}
```

#### MenuDropdown.module.css
```css
/* 修改前 */
border-radius: 8px;
border: 1px solid rgba(0, 0, 0, 0.14);
background: rgba(255, 255, 255, 0.88);
box-shadow: 0 8px 16px rgba(0, 0, 0, 0.14), 0 0 1px rgba(0, 0, 0, 0.06);

.item {
  border-radius: 4px;
}
.item:hover {
  background: rgba(0, 103, 192, 0.08);
}
.separator {
  background: rgba(0, 0, 0, 0.0803);
}

/* 修改后 */
border-radius: var(--radius-lg);
border: 1px solid var(--stroke-control);
background: var(--layer-2);
box-shadow: var(--elevation-flyout);

.item {
  border-radius: var(--radius-sm);
}
.item:hover {
  background: var(--accent-tint);
}
.separator {
  background: var(--stroke-divider);
}
```

### 业务组件（优先级 2）

扫描以下组件的 CSS 文件，替换硬编码值：

- `src/domains/workspace/components/Sidebar.module.css`
- `src/domains/workspace/components/StatusBar.module.css`
- `src/domains/document/components/DocumentView.module.css`
- `src/domains/editor/components/EditorPane.module.css`

**替换规则：**
- `border-radius: 6px` → `var(--radius-md)` (7px)
- `border-radius: 4px` → `var(--radius-sm)`
- `border-radius: 8px` → `var(--radius-lg)`
- `rgba(0, 0, 0, 0.08)` → `var(--stroke-surface)` 或 `var(--border-color)`
- hover 背景色 → `var(--accent-tint)` 或 `var(--bg-hover)`

---

## 实施步骤

### Step 1: 扩展 global.css
- 在 `:root` 中添加圆角、强调色 token
- 在 `body.dark` 中添加对应的深色模式值
- 保持现有 token 不变

### Step 2: 迁移 shell 组件
按顺序迁移：
1. WindowShell.module.css
2. TitleBar.module.css
3. MenuBar.module.css
4. MenuDropdown.module.css

每个组件迁移后验证浅色/深色模式。

### Step 3: 扫描并迁移业务组件
```bash
# 查找所有硬编码的圆角值
grep -r "border-radius: [0-9]" src --include="*.css"

# 查找所有硬编码的 rgba 值
grep -r "rgba(" src --include="*.css"
```

逐个替换为对应 token。

### Step 4: 验证
- 启动开发服务器
- 切换浅色/深色模式
- 检查所有组件视觉一致性
- 运行 TypeScript 类型检查

---

## 风险与应对

### 风险 1: 规范外的值
**问题：** 某些组件用了规范外的值（如 `border-radius: 6px`）  
**应对：** 就近映射到规范值（6px → 7px），接受轻微视觉变化

### 风险 2: 深色模式微调
**问题：** 深色模式的某些 token 值可能需要调整  
**应对：** 先按原型值设置，视觉不对再微调

### 风险 3: 业务组件依赖
**问题：** 业务组件可能依赖特定的硬编码值  
**应对：** 迁移时保持视觉效果，必要时添加新 token

---

## 成功标准

- ✅ global.css 包含完整的设计 token（圆角、强调色、表面、阴影）
- ✅ shell 组件完全使用 token，无硬编码
- ✅ 业务组件至少 80% 使用 token
- ✅ 浅色/深色模式视觉正常
- ✅ TypeScript 编译通过
- ✅ 视觉效果与 `docs/archive/dirty-data-2026-05-30/history/prism.html` 原型一致

---

## 后续工作

本次精修完成后，设计 token 体系已建立。后续新增组件应：

1. 优先使用现有 token
2. 如需新 token，先在 global.css 中定义
3. 避免在组件 CSS 中硬编码视觉值
