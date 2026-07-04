# Full Functional Manifest Summary

> Captured: 2026-07-04 02:29:27 CST
> Source: `docs/verification/runs/prism-full-functional-2026-06-27/manifest.json`

## Command

```bash
jq '.counts' docs/verification/runs/prism-full-functional-2026-06-27/manifest.json
jq -r '.testCases | group_by(.priority) | map({priority: .[0].priority, pass: map(select(.status=="Pass"))|length, fail: map(select(.status=="Fail"))|length, blocked: map(select(.status=="Blocked"))|length, notRun: map(select(.status=="Not Run"))|length})' docs/verification/runs/prism-full-functional-2026-06-27/manifest.json
jq -r '.testCases[] | select(.status=="Blocked") | [.id,.priority,.area,.feature,.notes] | @tsv' docs/verification/runs/prism-full-functional-2026-06-27/manifest.json
```

## Counts

| Metric | Count |
|---|---:|
| Total test cases | 168 |
| Pass | 156 |
| Fail | 0 |
| Blocked | 12 |
| Not Run | 0 |
| Screenshot files | 434 |
| Manifest screenshot references | 1016 |
| Unique manifest screenshot references | 455 |
| Real app evidence entries | 245 |

## Priority Breakdown

| Priority | Pass | Fail | Blocked | Not Run |
|---|---:|---:|---:|---:|
| P0 | 88 | 0 | 0 | 0 |
| P1 | 56 | 0 | 0 | 0 |
| P2 | 6 | 0 | 10 | 0 |
| P3 | 6 | 0 | 2 | 0 |

## Remaining Blocked Items

| ID | Priority | Area | Feature | Notes |
|---|---|---|---|---|
| PRISM-FF-148 | P2 | macOS | 沙盒授权 | Release pack 已部分验证：真实 Documents 权限弹窗出现，点击 Allow 后首启进入默认 Prism 工作区和指南文档；完整 manifest 仍需可重复权限重置或干净 profile 复测后才能改 Pass。 |
| PRISM-FF-150 | P2 | Windows | 标题栏布局 | 待真机回填。 |
| PRISM-FF-151 | P2 | Windows | 文件关联 | 待真机回填。 |
| PRISM-FF-152 | P2 | Windows | 路径处理 | 待真机回填。 |
| PRISM-FF-153 | P2 | Windows | 导出 | 待真机回填。 |
| PRISM-FF-154 | P2 | Linux | 标题栏布局 | 待真机回填。 |
| PRISM-FF-155 | P2 | Linux | 文件关联 | 待真机回填。 |
| PRISM-FF-156 | P2 | Linux | 导出 | 待真机回填。 |
| PRISM-FF-157 | P2 | 全平台 | 离线渲染 | 已有导出产物未发现明显远程资源引用，但不等同于断网验证。 |
| PRISM-FF-159 | P2 | 全平台 | 高 DPI | 需要专门矩阵验证后才能判定通过。 |
| PRISM-FF-163 | P3 | 内存释放 | 内存释放 | 需要单独性能脚本和时间窗口。 |
| PRISM-FF-164 | P3 | 导出大图内存 | 导出大图内存 | 已有单次复杂 PNG 导出证据，不等同于内存压力通过。 |

## Release Interpretation

- macOS P0/P1 release gate is currently satisfied by this manifest.
- `Fail=0` is satisfied.
- The remaining Blocked items must stay visible in release notes and the Go decision.
- Windows/Linux items must remain staged until real-device verification is attached.
