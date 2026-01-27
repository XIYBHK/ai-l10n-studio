/**
 * 开发者工具独立窗口管理
 * 使用 Tauri 的 WebviewWindow 创建独立窗口，可以拖到主窗口外部
 */

import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const DEV_TOOLS_WINDOW_LABEL = 'devtools';

export async function openDevToolsWindow(): Promise<void> {
  try {
    console.log('[DevTools] 尝试打开开发者工具窗口...');

    const existingWindow = await WebviewWindow.getByLabel(DEV_TOOLS_WINDOW_LABEL);

    if (existingWindow) {
      console.log('[DevTools] 窗口已存在，尝试聚焦...');
      try {
        await existingWindow.show();
        console.log('[DevTools] show() 调用成功');

        await existingWindow.setFocus();
        console.log('[DevTools] setFocus() 调用成功');

        await existingWindow.setAlwaysOnTop(true);
        console.log('[DevTools] setAlwaysOnTop(true) 调用成功');

        setTimeout(async () => {
          try {
            await existingWindow.setAlwaysOnTop(false);
            console.log('[DevTools] setAlwaysOnTop(false) 调用成功');
          } catch (err) {
            console.error('[DevTools] 取消置顶失败:', err);
          }
        }, 100);
      } catch (error) {
        console.error('[DevTools] 窗口操作失败:', error);
      }
      return;
    }

    console.log('[DevTools] 创建新窗口...');

    const isDev = window.location.hostname === 'localhost';
    const url = isDev ? 'http://localhost:1420/devtools.html' : 'devtools.html';

    console.log('[DevTools] 窗口 URL:', url);

    const devToolsWindow = new WebviewWindow(DEV_TOOLS_WINDOW_LABEL, {
      url,
      title: '🛠️ 开发者工具',
      width: 900,
      height: 700,
      minWidth: 700,
      minHeight: 500,
      resizable: true,
      center: true,
      decorations: true,
      alwaysOnTop: false,
      skipTaskbar: false,
    });

    devToolsWindow.once('tauri://created', () => {
      console.log('[DevTools] 窗口已创建');
    });

    devToolsWindow.once('tauri://error', (e) => {
      console.error('[DevTools] 窗口创建失败:', e);
    });

    console.log('[DevTools] 窗口创建成功');
  } catch (error) {
    console.error('[DevTools] 打开窗口时发生错误:', error);
    throw error;
  }
}

export async function closeDevToolsWindow(): Promise<void> {
  const window = await WebviewWindow.getByLabel(DEV_TOOLS_WINDOW_LABEL);
  if (window) {
    await window.close();
  }
}

export async function toggleDevToolsWindow(): Promise<void> {
  const window = await WebviewWindow.getByLabel(DEV_TOOLS_WINDOW_LABEL);

  if (window) {
    const isVisible = await window.isVisible();
    if (isVisible) {
      await window.hide();
    } else {
      await window.show();
      await window.setFocus();
    }
  } else {
    await openDevToolsWindow();
  }
}
