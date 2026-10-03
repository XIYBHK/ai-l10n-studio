/**
 * 开发者工具独立窗口管理
 * 使用 Tauri 的 WebviewWindow 创建独立窗口，可以拖到主窗口外部
 */

import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import i18n from '../i18n/config';

const DEV_TOOLS_WINDOW_LABEL = 'devtools';
let opening: Promise<void> | null = null;

async function openWindow(): Promise<void> {
  const existingWindow = await WebviewWindow.getByLabel(DEV_TOOLS_WINDOW_LABEL);
  if (existingWindow) {
    await existingWindow.show();
    await existingWindow.setFocus();
    return;
  }

  const devToolsWindow = new WebviewWindow(DEV_TOOLS_WINDOW_LABEL, {
    url: 'devtools.html',
    title: i18n.t('menu.devTools'),
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    resizable: true,
    center: true,
    decorations: true,
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const disposers: Array<() => void> = [];
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      disposers.forEach((dispose) => dispose());
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => finish(new Error(i18n.t('devTools.openFailed'))), 15000);
    const register = (registration: Promise<() => void>) => {
      void registration
        .then((dispose) => {
          if (settled) dispose();
          else disposers.push(dispose);
        })
        .catch(finish);
    };
    register(devToolsWindow.once('tauri://created', () => finish()));
    register(
      devToolsWindow.once('tauri://error', (event) =>
        finish(
          new Error(
            typeof event.payload === 'string' ? event.payload : i18n.t('devTools.openFailed')
          )
        )
      )
    );
  });
}

export function openDevToolsWindow(): Promise<void> {
  if (!opening)
    opening = openWindow().finally(() => {
      opening = null;
    });
  return opening;
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
