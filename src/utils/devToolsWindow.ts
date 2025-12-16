/**
 * 开发者工具独立窗口管理
 * 使用 Tauri 的 WebviewWindow 创建独立窗口，可以拖到主窗口外部
 */

import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const DEV_TOOLS_WINDOW_LABEL = 'devtools';

/**
 * 打开开发者工具窗口（独立窗口，可拖到主窗口外部）
 */
export async function openDevToolsWindow(): Promise<void> {
  try {
    console.log('[DevTools] 尝试打开开发者工具窗口...');

    // 检查窗口是否已存在（Tauri 2.0 中 getByLabel 是异步方法）
    const existingWindow = await WebviewWindow.getByLabel(DEV_TOOLS_WINDOW_LABEL);

    if (existingWindow) {
      // 如果窗口已存在，只需要聚焦并显示
      console.log('[DevTools] 窗口已存在，尝试聚焦...');
      try {
        // 先显示窗口
        await existingWindow.show();
        console.log('[DevTools] show() 调用成功');

        // 再设置焦点
        await existingWindow.setFocus();
        console.log('[DevTools] setFocus() 调用成功');

        // 临时置顶以确保窗口被带到前面
        await existingWindow.setAlwaysOnTop(true);
        console.log('[DevTools] setAlwaysOnTop(true) 调用成功');

        // 100ms 后取消置顶
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

    // 根据环境确定 URL
    // 开发模式：http://localhost:1420/devtools.html
    // 生产模式：devtools.html (相对路径)
    const isDev = window.location.hostname === 'localhost';
    const url = isDev ? 'http://localhost:1420/devtools.html' : 'devtools.html';

    console.log('[DevTools] 窗口 URL:', url);

    // 创建新窗口
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

    // 监听窗口事件
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

/**
 * 关闭开发者工具窗口
 */
export async function closeDevToolsWindow(): Promise<void> {
  const window = await WebviewWindow.getByLabel(DEV_TOOLS_WINDOW_LABEL);
  if (window) {
    await window.close();
  }
}

/**
 * 切换开发者工具窗口显示/隐藏
 */
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
