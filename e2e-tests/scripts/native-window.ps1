param(
  [Parameter(Mandatory = $true)][string]$ExecutablePath,
  [Parameter(Mandatory = $true)][string]$ExpectedOwner,
  [ValidateSet('close', 'probe')][string]$Action = 'probe',
  [string]$WindowTitle
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$resolvedExecutable = (Resolve-Path -LiteralPath $ExecutablePath).Path
$fixtureDirectory = Split-Path -LiteralPath $resolvedExecutable
$fixtureRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../src-tauri/target/e2e')).Path
if ((Split-Path -LiteralPath $fixtureDirectory) -ne $fixtureRoot -or (Split-Path -Path $fixtureDirectory -Leaf) -notmatch '^run-[^/\\]+$') {
  throw 'Refusing to control a window outside the isolated E2E root'
}
if ([IO.File]::ReadAllText((Join-Path $fixtureDirectory '.e2e-owner')) -ne $ExpectedOwner) {
  throw 'Refusing to control an unowned E2E window'
}
$ownedProcesses = @(Get-Process -Name 'po-translator-gui' -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $resolvedExecutable })
if ($Action -eq 'probe') {
  @{ running = $ownedProcesses.Count -gt 0; count = $ownedProcesses.Count } | ConvertTo-Json -Compress
  exit 0
}
if ($ownedProcesses.Count -ne 1) { throw 'Expected exactly one process for the isolated executable' }

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class IsolatedWindowActions {
  public delegate bool EnumWindowsProc(IntPtr window, IntPtr parameter);
  [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr window, StringBuilder text, int length);
  [DllImport("user32.dll", SetLastError = true)] public static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
  public static IntPtr Find(uint processId, string title) {
    IntPtr result = IntPtr.Zero;
    EnumWindows((window, parameter) => {
      uint owner;
      GetWindowThreadProcessId(window, out owner);
      if (owner != processId) return true;
      var text = new StringBuilder(512);
      GetWindowText(window, text, text.Capacity);
      if (text.ToString() != title) return true;
      result = window;
      return false;
    }, IntPtr.Zero);
    return result;
  }
}
'@

$ownedProcess = $ownedProcesses[0]
$handle = [IsolatedWindowActions]::Find([uint32]$ownedProcess.Id, $WindowTitle)
if ($handle -eq [IntPtr]::Zero) { throw "Owned window not found: $WindowTitle" }
# SC_CLOSE follows the same native command as the title-bar close button.
if (-not [IsolatedWindowActions]::PostMessage($handle, 0x0112, [IntPtr]0xF060, [IntPtr]::Zero)) {
  throw 'Failed to post the native close command'
}
@{ pid = $ownedProcess.Id; title = $WindowTitle; command = 'SC_CLOSE'; handle = $handle.ToInt64() } | ConvertTo-Json -Compress
