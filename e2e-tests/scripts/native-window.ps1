param(
  [Parameter(Mandatory = $true)][string]$ExecutablePath,
  [Parameter(Mandatory = $true)][string]$ExpectedOwner,
  [ValidateSet('close', 'probe', 'place')][string]$Action = 'probe',
  [string]$WindowTitle,
  [int]$X,
  [int]$Y
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
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll", SetLastError = true)] private static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
  [DllImport("user32.dll")] private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
  public static System.Collections.Generic.List<int[]> Bounds(uint processId) {
    var result = new System.Collections.Generic.List<int[]>();
    var previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
    try {
      EnumWindows((window, parameter) => {
        uint owner;
        GetWindowThreadProcessId(window, out owner);
        Rect rect;
        if (owner == processId && IsWindowVisible(window) && GetWindowRect(window, out rect))
          result.Add(new int[] { rect.Left, rect.Top, rect.Right, rect.Bottom });
        return true;
      }, IntPtr.Zero);
    } finally { SetThreadDpiAwarenessContext(previous); }
    return result;
  }
  public static int Place(uint processId, int x, int y) {
    var previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
    int count = 0;
    try {
      EnumWindows((window, parameter) => {
        uint owner;
        GetWindowThreadProcessId(window, out owner);
        if (owner == processId && IsWindowVisible(window)) {
          if (!SetWindowPos(window, IntPtr.Zero, x, y, 0, 0, 0x0015))
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
          count++;
        }
        return true;
      }, IntPtr.Zero);
    } finally { SetThreadDpiAwarenessContext(previous); }
    return count;
  }
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
if ($Action -eq 'place') {
  $placed = [IsolatedWindowActions]::Place([uint32]$ownedProcess.Id, $X, $Y)
  if ($placed -eq 0) { throw 'No visible owned test windows to place' }
  @{ pid = $ownedProcess.Id; command = 'place'; x = $X; y = $Y; count = $placed; bounds = @([IsolatedWindowActions]::Bounds([uint32]$ownedProcess.Id)) } | ConvertTo-Json -Depth 4 -Compress
  exit 0
}
$handle = [IsolatedWindowActions]::Find([uint32]$ownedProcess.Id, $WindowTitle)
if ($handle -eq [IntPtr]::Zero) { throw "Owned window not found: $WindowTitle" }
# SC_CLOSE follows the same native command as the title-bar close button.
if (-not [IsolatedWindowActions]::PostMessage($handle, 0x0112, [IntPtr]0xF060, [IntPtr]::Zero)) {
  throw 'Failed to post the native close command'
}
@{ pid = $ownedProcess.Id; title = $WindowTitle; command = 'SC_CLOSE'; handle = $handle.ToInt64() } | ConvertTo-Json -Compress
