import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

if (process.platform !== 'win32') {
  console.log('Skipping Windows icon resource patch on non-Windows platform.');
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const exePath = path.join(repoRoot, 'src-tauri', 'target', 'release', 'app.exe');
const icoPath = path.join(repoRoot, 'src-tauri', 'icons', 'icon.ico');

const powershell = String.raw`
$ErrorActionPreference = "Stop"
$code = @'
using System;
using System.IO;
using System.Runtime.InteropServices;

public static class PeIconUpdater {
  static readonly IntPtr RT_ICON = new IntPtr(3);
  static readonly IntPtr RT_GROUP_ICON = new IntPtr(14);

  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern IntPtr BeginUpdateResource(string pFileName, bool bDeleteExistingResources);
  [DllImport("kernel32.dll", SetLastError=true)]
  static extern bool UpdateResource(IntPtr hUpdate, IntPtr lpType, IntPtr lpName, ushort wLanguage, byte[] lpData, uint cbData);
  [DllImport("kernel32.dll", SetLastError=true)]
  static extern bool EndUpdateResource(IntPtr hUpdate, bool fDiscard);

  public static void PatchIcon(string exePath, string icoPath) {
    byte[] ico = File.ReadAllBytes(icoPath);
    ushort iconType = BitConverter.ToUInt16(ico, 2);
    ushort count = BitConverter.ToUInt16(ico, 4);

    if (iconType != 1 || count == 0) {
      throw new Exception("Invalid ICO file: " + icoPath);
    }

    IntPtr update = BeginUpdateResource(exePath, false);
    if (update == IntPtr.Zero) {
      throw new Exception("BeginUpdateResource failed " + Marshal.GetLastWin32Error());
    }

    bool committed = false;
    try {
      using (var groupStream = new MemoryStream())
      using (var group = new BinaryWriter(groupStream)) {
        group.Write((ushort)0);
        group.Write((ushort)1);
        group.Write(count);

        for (ushort i = 0; i < count; i++) {
          int entryOffset = 6 + i * 16;
          byte width = ico[entryOffset];
          byte height = ico[entryOffset + 1];
          byte colorCount = ico[entryOffset + 2];
          byte reserved = ico[entryOffset + 3];
          ushort planes = BitConverter.ToUInt16(ico, entryOffset + 4);
          ushort bitCount = BitConverter.ToUInt16(ico, entryOffset + 6);
          uint bytesInRes = BitConverter.ToUInt32(ico, entryOffset + 8);
          uint imageOffset = BitConverter.ToUInt32(ico, entryOffset + 12);
          ushort resourceId = (ushort)(i + 1);

          byte[] image = new byte[bytesInRes];
          Array.Copy(ico, imageOffset, image, 0, bytesInRes);

          if (!UpdateResource(update, RT_ICON, new IntPtr(resourceId), 0, image, (uint)image.Length)) {
            throw new Exception("UpdateResource RT_ICON failed " + Marshal.GetLastWin32Error());
          }

          group.Write(width);
          group.Write(height);
          group.Write(colorCount);
          group.Write(reserved);
          group.Write(planes);
          group.Write(bitCount);
          group.Write(bytesInRes);
          group.Write(resourceId);
        }

        byte[] groupData = groupStream.ToArray();
        if (!UpdateResource(update, RT_GROUP_ICON, new IntPtr(32512), 0, groupData, (uint)groupData.Length)) {
          throw new Exception("UpdateResource RT_GROUP_ICON failed " + Marshal.GetLastWin32Error());
        }
      }

      if (!EndUpdateResource(update, false)) {
        throw new Exception("EndUpdateResource failed " + Marshal.GetLastWin32Error());
      }
      committed = true;
    } finally {
      if (!committed) {
        EndUpdateResource(update, true);
      }
    }
  }
}
'@
Add-Type -TypeDefinition $code
[PeIconUpdater]::PatchIcon($env:PRISM_EXE_PATH, $env:PRISM_ICO_PATH)
`;

const result = spawnSync(
  'powershell',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', powershell],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      PRISM_EXE_PATH: exePath,
      PRISM_ICO_PATH: icoPath,
    },
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Patched Windows icon resources in ${exePath}`);
