/**
 * 导出取消的本地信号。
 *
 * 导出管线跑在前端，若靠轮询 Rust 的 `cancel_requested` 来感知取消，每推进一个
 * 阶段都要一次 IPC，延迟还在几百毫秒量级。改为：UI 点取消只置一个内存标志，
 * 导出管线在下一次进度上报时抛 `ExportCancelledError`，收尾时再把 Rust 侧的
 * job 标成 cancelled——状态机一致，且不必轮询。
 */
let cancellationRequested = false;

export function requestExportCancellation(): void {
  cancellationRequested = true;
}

export function isExportCancellationRequested(): boolean {
  return cancellationRequested;
}

export function resetExportCancellation(): void {
  cancellationRequested = false;
}
