/**
 * 文档打开链路分阶段埋点。
 *
 * 目的：把 `openCommandToLastSessionMs` 拆成可归因的阶段，回答 CONTEXT.md
 * 「真实预览性能基准」要求的问题——DOM commit 或后处理是否真的是瓶颈。
 * 在此之前不得改动预览渲染策略。
 *
 * 启用方式：config.json 中 `perfInstrumentation: true`（由基准脚本写入）。
 * 输出：appData 目录下 `perf-trace.json`，基准进程可直接读取。
 * 未启用时所有 API 为无副作用空操作，不引入 Tauri 依赖、不影响正常运行时。
 */

export interface PerfMark {
  /** 阶段名。 */
  name: string;
  /** 相对 traceStart 的毫秒偏移。 */
  atMs: number;
  /** 该阶段自身耗时（仅部分阶段有）。 */
  durationMs?: number;
  meta?: Record<string, unknown>;
}

const marks: PerfMark[] = [];
let traceStart = 0;
let enabled = false;
let flushScheduled = false;
let flushTimer: number | null = null;

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * 由 bootstrap 在读取设置后调用。传入 false 时保持全链路关闭。
 */
export function initPerfInstrumentation(flag: boolean | undefined): void {
  enabled = flag === true;
  if (!enabled) return;
  traceStart = nowMs();
  marks.length = 0;
}

export function isPerfInstrumentationEnabled(): boolean {
  return enabled;
}

/** 记录一个时间点。 */
export function markPerf(name: string, meta?: Record<string, unknown>): void {
  if (!enabled) return;
  marks.push({ name, atMs: round(nowMs() - traceStart), meta });
  scheduleFlush();
}

/** 记录一个已知耗时的阶段。 */
export function markPerfDuration(
  name: string,
  durationMs: number,
  meta?: Record<string, unknown>,
): void {
  if (!enabled) return;
  marks.push({
    name,
    atMs: round(nowMs() - traceStart),
    durationMs: round(durationMs),
    meta,
  });
  scheduleFlush();
}

/**
 * 合并写盘：任一 mark 之后 400ms 内无新 mark 才落盘，避免把写盘成本
 * 摊进被测阶段。基准脚本轮询该文件，不依赖写入时机。
 */
function scheduleFlush(): void {
  if (typeof window === 'undefined') return;
  if (flushTimer !== null) window.clearTimeout(flushTimer);
  flushScheduled = true;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushPerfTrace();
  }, 400);
}

export function getPerfTrace(): { traceStartMs: number; marks: PerfMark[] } {
  return { traceStartMs: round(traceStart), marks: marks.slice() };
}

/** 把当前 trace 写入 appData/perf-trace.json。 */
export async function flushPerfTrace(): Promise<void> {
  if (!enabled || marks.length === 0) return;
  flushScheduled = false;
  try {
    const [{ appDataDir }, { writeTextFile }] = await Promise.all([
      import('../platform/tauri/path'),
      import('../platform/tauri/fileSystem'),
    ]);
    const dir = await appDataDir();
    const target = `${dir.replace(/\/$/, '')}/perf-trace.json`;
    await writeTextFile(target, `${JSON.stringify(getPerfTrace(), null, 2)}\n`);
  } catch {
    // 埋点失败不得影响应用行为。
  }
}

/** 仅测试用：重置模块状态。 */
export function resetPerfInstrumentationForTest(): void {
  enabled = false;
  traceStart = 0;
  marks.length = 0;
  flushScheduled = false;
  if (flushTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(flushTimer);
  }
  flushTimer = null;
}

/** 仅测试用：是否有待落盘的 flush。 */
export function hasPendingPerfFlushForTest(): boolean {
  return flushScheduled;
}
