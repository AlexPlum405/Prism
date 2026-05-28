import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  writeTextFile,
} from '../../../platform/tauri/fileSystem';
import { appDataDir } from '../../../platform/tauri/path';
import { addRecentFile } from '../../workspace/services/recentFiles';
import { basename, joinPath } from '../../workspace/services/path';
import { grantMarkdownFileScope } from '../../../lib/fileSystemScope';
import { getFileSnapshotOrNull } from '../fileSnapshot';
import { useDocumentStore } from '../store';

const RECOVERY_DIR = 'recovery';
const MAX_RECOVERY_SNAPSHOTS_PER_DOCUMENT = 10;

export type RecoverySnapshotReason = 'autosave' | 'manual-save';

export interface RecoverySnapshot {
  id: string;
  documentId: string;
  documentPath: string;
  documentName: string;
  content: string;
  createdAt: number;
  reason: RecoverySnapshotReason;
  filePath: string;
}

interface RecoverySnapshotFile {
  version: 1;
  documentPath: string;
  documentName?: string;
  content: string;
  createdAt: number;
  reason: RecoverySnapshotReason;
}

export function getRecoveryDocumentId(documentPath: string): string {
  let hash = 2166136261;
  for (let i = 0; i < documentPath.length; i += 1) {
    hash ^= documentPath.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function getRecoveryRootPath(): Promise<string> {
  return joinPath(await appDataDir(), RECOVERY_DIR);
}

async function getRecoveryDocumentPath(documentPath: string): Promise<string> {
  return joinPath(await getRecoveryRootPath(), getRecoveryDocumentId(documentPath));
}

async function ensureRecoveryDocumentPath(documentPath: string): Promise<string> {
  const root = await getRecoveryRootPath();
  if (!(await exists(root))) {
    await mkdir(root, { recursive: true });
  }

  const documentDir = await getRecoveryDocumentPath(documentPath);
  if (!(await exists(documentDir))) {
    await mkdir(documentDir, { recursive: true });
  }
  return documentDir;
}

function toRecoverySnapshot(filePath: string, documentId: string, file: RecoverySnapshotFile): RecoverySnapshot {
  const documentName = typeof file.documentName === 'string' && file.documentName.trim()
    ? file.documentName
    : basename(file.documentPath);

  return {
    id: `${documentId}:${file.createdAt}`,
    documentId,
    documentPath: file.documentPath,
    documentName,
    content: file.content,
    createdAt: file.createdAt,
    reason: file.reason,
    filePath,
  };
}

function isValidRecoverySnapshotFile(file: unknown): file is RecoverySnapshotFile {
  if (!file || typeof file !== 'object') return false;
  const snapshot = file as Partial<RecoverySnapshotFile>;
  return (
    snapshot.version === 1
    && typeof snapshot.documentPath === 'string'
    && snapshot.documentPath.length > 0
    && typeof snapshot.content === 'string'
    && typeof snapshot.createdAt === 'number'
    && Number.isFinite(snapshot.createdAt)
    && (snapshot.reason === 'autosave' || snapshot.reason === 'manual-save')
  );
}

async function listRecoverySnapshotsForDocument(documentPath: string): Promise<RecoverySnapshot[]> {
  const documentId = getRecoveryDocumentId(documentPath);
  const documentDir = await getRecoveryDocumentPath(documentPath);
  if (!(await exists(documentDir))) return [];

  const entries = await readDir(documentDir);
  const snapshots: RecoverySnapshot[] = [];

  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith('.json')) continue;
    const filePath = joinPath(documentDir, entry.name);
    try {
      const file = JSON.parse(await readTextFile(filePath));
      if (!isValidRecoverySnapshotFile(file) || file.documentPath !== documentPath) continue;
      snapshots.push(toRecoverySnapshot(filePath, documentId, file));
    } catch {
      // Ignore unreadable recovery files so one bad file does not block startup.
    }
  }

  return snapshots.sort((a, b) => b.createdAt - a.createdAt);
}

async function pruneRecoverySnapshots(documentPath: string): Promise<void> {
  const snapshots = await listRecoverySnapshotsForDocument(documentPath);
  const stale = snapshots.slice(MAX_RECOVERY_SNAPSHOTS_PER_DOCUMENT);
  await Promise.all(stale.map((snapshot) => remove(snapshot.filePath).catch(() => undefined)));
}

async function getUniqueRecoverySnapshotPath(documentDir: string, createdAt: number) {
  let nextCreatedAt = createdAt;
  let filePath = joinPath(documentDir, `${nextCreatedAt}.json`);

  while (await exists(filePath)) {
    nextCreatedAt += 1;
    filePath = joinPath(documentDir, `${nextCreatedAt}.json`);
  }

  return { createdAt: nextCreatedAt, filePath };
}

export async function createRecoverySnapshot(input: {
  documentPath: string;
  documentName: string;
  content: string;
  reason: RecoverySnapshotReason;
}): Promise<RecoverySnapshot | null> {
  if (!input.documentPath) return null;

  const initialCreatedAt = Date.now();
  const documentId = getRecoveryDocumentId(input.documentPath);
  const documentDir = await ensureRecoveryDocumentPath(input.documentPath);
  const { createdAt, filePath } = await getUniqueRecoverySnapshotPath(documentDir, initialCreatedAt);
  const file: RecoverySnapshotFile = {
    version: 1,
    documentPath: input.documentPath,
    documentName: input.documentName || basename(input.documentPath),
    content: input.content,
    createdAt,
    reason: input.reason,
  };

  await writeTextFile(filePath, JSON.stringify(file));
  await pruneRecoverySnapshots(input.documentPath);
  return toRecoverySnapshot(filePath, documentId, file);
}

export async function clearRecoverySnapshotsForDocument(documentPath: string): Promise<void> {
  if (!documentPath) return;
  const documentDir = await getRecoveryDocumentPath(documentPath);
  if (!(await exists(documentDir))) return;
  await remove(documentDir, { recursive: true });
}

export async function deleteRecoverySnapshot(snapshot: RecoverySnapshot): Promise<void> {
  await remove(snapshot.filePath);
}

export async function listRecoverySnapshots(): Promise<RecoverySnapshot[]> {
  const root = await getRecoveryRootPath();
  if (!(await exists(root))) return [];

  const documentEntries = await readDir(root);
  const snapshots: RecoverySnapshot[] = [];

  for (const documentEntry of documentEntries) {
    if (!documentEntry.isDirectory) continue;
    const documentDir = joinPath(root, documentEntry.name);
    const fileEntries = await readDir(documentDir).catch(() => []);

    for (const fileEntry of fileEntries) {
      if (!fileEntry.isFile || !fileEntry.name.endsWith('.json')) continue;
      const filePath = joinPath(documentDir, fileEntry.name);
      try {
        const file = JSON.parse(await readTextFile(filePath));
        if (!isValidRecoverySnapshotFile(file)) continue;
        const documentId = getRecoveryDocumentId(file.documentPath);
        if (documentId !== documentEntry.name) continue;
        snapshots.push(toRecoverySnapshot(filePath, documentId, file));
      } catch {
        // Ignore corrupt snapshot files.
      }
    }
  }

  return snapshots.sort((a, b) => b.createdAt - a.createdAt);
}

export async function restoreRecoverySnapshot(snapshot: RecoverySnapshot): Promise<void> {
  await grantMarkdownFileScope(snapshot.documentPath).catch(() => undefined);
  const fileSnapshot = await getFileSnapshotOrNull(snapshot.documentPath);
  useDocumentStore.getState().openDocument(
    snapshot.documentPath,
    snapshot.documentName || basename(snapshot.documentPath),
    snapshot.content,
    fileSnapshot,
  );
  useDocumentStore.getState().updateContent(snapshot.content);
  addRecentFile(snapshot.documentPath, snapshot.documentName || basename(snapshot.documentPath));
}
