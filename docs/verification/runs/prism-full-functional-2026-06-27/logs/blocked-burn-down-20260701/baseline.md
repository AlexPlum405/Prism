# Blocked Burn-down Baseline - 2026-07-01

## Scope

本轮按附件计划推进 Prism RC 验证，不从头重跑全量测试，优先闭环唯一 P0 Blocked：`PRISM-FF-026`。

## Git Baseline

```text
## codex/prism-full-optimization...origin/codex/prism-full-optimization
```

## Installed App

```text
CFBundleIdentifier = com.prism.editor.v1
CFBundleName = Prism
CFBundleShortVersionString = 1.4.1
CFBundleVersion = 1.4.1
```

## Manifest Counts

```json
{
  "total": 168,
  "Pass": 139,
  "Fail": 0,
  "Blocked": 29,
  "Not Run": 0,
  "screenshotFiles": 433,
  "manifestScreenshots": 1015,
  "uniqueManifestScreenshots": 454,
  "computerUseRealAppEvidence": 245
}
```

## Current Blocked Cases

```text
P0  PRISM-FF-026  复制为多格式 / 复制为多格式
P1  PRISM-FF-092  工作区导航 dirty guard / 工作区导航 dirty guard
P1  PRISM-FF-094  文件夹授权失败 / 文件夹授权失败
P1  PRISM-FF-096  删除当前打开文件 / 删除当前打开文件
P1  PRISM-FF-097  重命名当前文件夹 / 重命名当前文件夹
P1  PRISM-FF-103  用户主题包扫描 / 用户主题包扫描
P1  PRISM-FF-105  自托管字体 / 自托管字体
P1  PRISM-FF-116  预览源码 flash / 预览源码 flash
P1  PRISM-FF-118  索引任务取消 / 索引任务取消
P1  PRISM-FF-120  图谱 native 回退 / 图谱 native 回退
P1  PRISM-FF-134  设置迁移/旧配置 / 设置迁移/旧配置
P1  PRISM-FF-135  设置持久化错误 / 设置持久化错误
P1  PRISM-FF-138  Error Boundary / Error Boundary
P2  PRISM-FF-147  macOS / 文件关联
P2  PRISM-FF-148  macOS / 沙盒授权
P2  PRISM-FF-150  Windows / 标题栏布局
P2  PRISM-FF-151  Windows / 文件关联
P2  PRISM-FF-152  Windows / 路径处理
P2  PRISM-FF-153  Windows / 导出
P2  PRISM-FF-154  Linux / 标题栏布局
P2  PRISM-FF-155  Linux / 文件关联
P2  PRISM-FF-156  Linux / 导出
P2  PRISM-FF-157  全平台 / 离线渲染
P2  PRISM-FF-159  全平台 / 高 DPI
P3  PRISM-FF-161  性能日志 / 性能日志
P3  PRISM-FF-162  Worker 降级 / Worker 降级
P3  PRISM-FF-163  内存释放 / 内存释放
P3  PRISM-FF-164  导出大图内存 / 导出大图内存
P3  PRISM-FF-165  超大工作区 / 超大工作区
```

## Rules

- 每个用例只在证据足够时改 Pass。
- Windows/Linux、权限拒绝、破坏性操作、压力测试不靠推测补。
- 破坏性测试只允许在 `/tmp/prism-destructive-sandbox-<timestamp>/` 下执行。
