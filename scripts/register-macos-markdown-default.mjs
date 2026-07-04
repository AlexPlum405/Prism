import { execFileSync, spawnSync } from 'child_process';
import { access, mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const explicitAppPath = args.find((arg) => !arg.startsWith('--'));
const appPath = path.resolve(explicitAppPath ?? '/Applications/Prism.app');
const buildAppPath = path.join(repoRoot, 'src-tauri', 'target', 'release', 'bundle', 'macos', 'Prism.app');
const bundleId = 'com.prism.editor.v1';
const markdownTypes = [
  'com.prism.editor.markdown',
  'net.daringfireball.markdown',
  'public.markdown',
  'net.ia.markdown',
  'com.unknown.md',
];
const textTypes = [
  'com.prism.editor.text',
  'public.plain-text',
  'public.text',
  'public.source-code',
  'public.json',
  'public.yaml',
  'public.xml',
  'public.comma-separated-values-text',
  'public.tab-separated-values-text',
  'org.iso.sql',
];
const registerText = args.includes('--text');

async function ensureReadableFile(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} does not exist: ${filePath}`);
  }
}

await ensureReadableFile(appPath, 'Prism.app');

if (path.resolve(appPath) !== buildAppPath) {
  const unregisterBuildApp = spawnSync(
    '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
    ['-u', buildAppPath],
    { stdio: 'ignore' },
  );

  if (unregisterBuildApp.status === 0) {
    console.log(`Unregistered duplicate build app: ${buildAppPath}`);
  }
}

execFileSync(
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
  ['-f', appPath],
  { stdio: 'inherit' },
);

const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'prism-ls-default-'));
const swiftPath = path.join(tempRoot, 'RegisterMarkdownDefault.swift');

try {
  await writeFile(swiftPath, `
import CoreServices
import Foundation

let bundleId = "${bundleId}" as CFString
let contentTypes = ${JSON.stringify(markdownTypes)}
let textTypes = ${JSON.stringify(textTypes)}
let registerText = ${registerText}
var failed = false

for contentType in contentTypes {
  let status = LSSetDefaultRoleHandlerForContentType(
    contentType as CFString,
    LSRolesMask.all,
    bundleId,
  )

  if status == noErr {
    print("Registered \\(contentType) -> ${bundleId}")
  } else {
    failed = true
    print("Failed \\(contentType): OSStatus \\(status)")
  }
}

if registerText {
  for contentType in textTypes {
    let status = LSSetDefaultRoleHandlerForContentType(
      contentType as CFString,
      LSRolesMask.all,
      bundleId,
    )

    if status == noErr {
      print("Registered \\(contentType) -> ${bundleId}")
    } else {
      failed = true
      print("Failed \\(contentType): OSStatus \\(status)")
    }
  }
}

exit(failed ? 1 : 0)
`);

  const result = spawnSync('/usr/bin/swift', [swiftPath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`Failed to register default handlers for ${bundleId}`);
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
