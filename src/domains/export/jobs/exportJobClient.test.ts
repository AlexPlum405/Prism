import { describe, expect, it, vi } from 'vitest';
import { PrismNativeError } from '../../../platform/tauri/result';

// 原生命令统一抛"不可用"，强制走本地兜底作业路径。
// vi.mock 工厂会被提升到文件顶部，stub 必须在工厂内部构造。
vi.mock('../../../platform/tauri/exportJobs', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../platform/tauri/exportJobs')>();
  const rejectUnavailable = () => Promise.reject(new PrismNativeError({
    code: 'unknown_error',
    message: 'window.__tauri reading \'invoke\' is not a function',
  }));
  return {
    ...original,
    createExportJobNative: rejectUnavailable,
    updateExportJobNative: rejectUnavailable,
    completeExportJobNative: rejectUnavailable,
    failExportJobNative: rejectUnavailable,
    cancelExportJobNative: rejectUnavailable,
    getExportJobNative: rejectUnavailable,
    listExportJobsNative: rejectUnavailable,
  };
});

import {
  createExportJob,
  listExportJobs,
} from './exportJobClient';

describe('exportJobClient local job history', () => {
  it('evicts old local jobs beyond the retention limit', async () => {
    const created: Array<{ id: string }> = [];
    for (let index = 0; index < 21; index += 1) {
      created.push(await createExportJob({
        format: 'pdf',
        outputPath: `/tmp/prism-export-${index}.pdf`,
      }));
    }

    expect(created).toHaveLength(21);
    expect(created[0]?.id).toBeDefined();

    const list = await listExportJobs();

    expect(list).toHaveLength(20);
    expect(list.some((job) => job.id === created[0]!.id)).toBe(false);
    expect(list.some((job) => job.id === created[20]!.id)).toBe(true);
  });
});
