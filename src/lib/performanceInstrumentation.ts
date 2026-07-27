/**
 * Performance instrumentation for isolating document open → session ready bottlenecks.
 *
 * Enabled by setting localStorage['prism.perfInstrumentation'] = '1' before opening a document.
 * Events are logged to console and can be exported via getPerfEvents().
 */

export interface PerfEvent {
  name: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

const events: PerfEvent[] = [];
let enabled = false;
let sessionStart = 0;

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function isPerfInstrumentationEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (!enabled) {
    try {
      enabled = window.localStorage?.getItem('prism.perfInstrumentation') === '1';
    } catch {
      enabled = false;
    }
  }
  return enabled;
}

export function recordPerfEvent(name: string, metadata?: Record<string, unknown>): void {
  if (!isPerfInstrumentationEnabled()) return;

  events.push({
    name,
    timestamp: nowMs(),
    metadata,
  });
}

export function recordPerfDuration(name: string, durationMs: number, metadata?: Record<string, unknown>): void {
  if (!isPerfInstrumentationEnabled()) return;

  events.push({
    name,
    timestamp: nowMs(),
    duration: durationMs,
    metadata,
  });
}

export function startPerfSession(): void {
  if (!isPerfInstrumentationEnabled()) return;

  sessionStart = nowMs();
  events.length = 0;
  recordPerfEvent('session_start');
}

export function getPerfEvents(): PerfEvent[] {
  return events.slice();
}

export function getPerfSummary(): {
  sessionStart: number;
  events: Array<{ name: string; elapsedMs: number; duration?: number; metadata?: Record<string, unknown> }>;
} {
  if (events.length === 0 || sessionStart === 0) {
    return { sessionStart: 0, events: [] };
  }

  return {
    sessionStart,
    events: events.map(event => ({
      name: event.name,
      elapsedMs: Math.round((event.timestamp - sessionStart) * 10) / 10,
      duration: event.duration ? Math.round(event.duration * 10) / 10 : undefined,
      metadata: event.metadata,
    })),
  };
}

export function logPerfSummary(): void {
  if (!isPerfInstrumentationEnabled()) return;

  const summary = getPerfSummary();
  if (summary.events.length === 0) return;

  console.group('[Prism Performance Instrumentation]');
  console.table(summary.events);
  console.groupEnd();
}
