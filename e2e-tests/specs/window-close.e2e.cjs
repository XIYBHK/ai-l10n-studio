const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zh = require('../../src/i18n/locales/zh-CN.json');
const { nativeWindow } = require('../scripts/native-window.cjs');

const evidence = process.env.TAURI_E2E_EVIDENCE_DIR
  ? path.resolve(process.env.TAURI_E2E_EVIDENCE_DIR)
  : path.resolve(__dirname, '../../docs/audits/2026-10-03/window-close');
const scenario = process.env.TAURI_E2E_CLOSE_SCENARIO || 'clean';

async function visible(selector) {
  let found;
  await browser.waitUntil(
    async () => {
      for (const element of await browser.$$(selector)) {
        if (await element.isDisplayed()) {
          found = element;
          return true;
        }
      }
      return false;
    },
    { timeoutMsg: 'No visible element: ' + selector }
  );
  return found;
}

async function chooseUnsaved(label) {
  const modal = await visible('.ant-modal-confirm');
  for (const button of await modal.$$('button')) {
    if ((await button.getText()).replace(/\s/g, '') === label) {
      await button.click();
      return;
    }
  }
  throw new Error('Unsaved choice not found: ' + label);
}

async function waitForExit() {
  await browser.waitUntil(() => !nativeWindow('probe').running, {
    timeout: 8000,
    interval: 400,
    timeoutMsg: 'native close left the application process running',
  });
}

describe('Native title-bar close', () => {
  it('handles ' + scenario + ' through SC_CLOSE and exits without forced cleanup', async () => {
    fs.mkdirSync(evidence, { recursive: true });
    const result = { scenario, requests: [] };
    await browser.$('[data-testid="menu-settings-button"]').waitForDisplayed();
    await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
    await browser.$('.ant-modal-close').click();
    const mainHandle = await browser.getWindowHandle();
    const originalFile = fs.readFileSync(process.env.TAURI_E2E_PO_PATH, 'utf8');
    await browser.execute(() => {
      window.closeProbeErrors = [];
      window.addEventListener('unhandledrejection', (event) => {
        window.closeProbeErrors.push(String(event.reason));
      });
    });
    const requestClose = (title) => result.requests.push(nativeWindow('close', title));
    try {
      if (scenario === 'discard' || scenario === 'save') {
        const importError = await browser.executeAsync((filePath, done) => {
          window.__TAURI_INTERNALS__
            .invoke('plugin:event|emit_to', {
              target: { kind: 'AnyLabel', label: 'main' },
              event: 'tauri://drag-drop',
              payload: { paths: [filePath], position: { x: 10, y: 10 } },
            })
            .then(
              () => done(null),
              (error) => done(String(error))
            );
        }, process.env.TAURI_E2E_PO_PATH);
        assert.equal(importError, null);
        const editor = await visible('textarea[aria-label="译文编辑"]');
        await editor.setValue('退出检查');
        requestClose();
        await visible('.ant-modal-confirm');
        if (scenario === 'discard') {
          requestClose();
          assert.equal(
            (await browser.$$('.ant-modal-confirm')).length,
            1,
            'repeated closes must share one prompt'
          );
          await browser.saveScreenshot(path.join(evidence, 'unsaved-close.png'));
          await chooseUnsaved('取消');
          assert.equal(nativeWindow('probe').running, true);
          assert.equal(await editor.getValue(), '退出检查');
          result.cancelPreservedDraft = true;
          requestClose();
          await chooseUnsaved('放弃修改');
          await waitForExit();
          assert.equal(fs.readFileSync(process.env.TAURI_E2E_PO_PATH, 'utf8'), originalFile);
          result.discardPreservedDisk = true;
        } else {
          fs.chmodSync(process.env.TAURI_E2E_PO_PATH, 0o444);
          await chooseUnsaved('保存');
          await browser.waitUntil(async () =>
            (await (await visible('.ant-message')).getText()).includes('保存失败')
          );
          assert.equal(nativeWindow('probe').running, true, 'failed saves must keep the app open');
          assert.equal(fs.readFileSync(process.env.TAURI_E2E_PO_PATH, 'utf8'), originalFile);
          assert.equal(await editor.getValue(), '退出检查');
          result.saveFailurePreservedWork = true;
          const fileStatus = await browser
            .$('section[aria-label="翻译工作台"] header [role="status"]')
            .getText();
          const editorStatus = await browser
            .$('[role="toolbar"][aria-label="编辑器工具栏"]')
            .getText();
          assert.equal(fileStatus, '文件尚未保存');
          assert.ok(editorStatus.includes(zh.workspace.editor.draftSynchronized));
          assert.ok(!editorStatus.includes('已保存'));
          result.saveFailureLabelsAccurate = true;
          await browser.saveScreenshot(path.join(evidence, 'save-failure.png'));
          fs.chmodSync(process.env.TAURI_E2E_PO_PATH, 0o666);
          requestClose();
          await chooseUnsaved('保存');
          await waitForExit();
          assert.ok(
            fs.readFileSync(process.env.TAURI_E2E_PO_PATH, 'utf8').includes('msgstr "退出检查"')
          );
          result.saveRetryPersistedDraft = true;
        }
      } else if (scenario === 'devtools') {
        await browser.$('[data-testid="menu-devtools-button"]').click();
        await browser.waitUntil(async () => (await browser.getWindowHandles()).length === 2);
        requestClose('开发者工具');
        await browser.waitUntil(async () => (await browser.getWindowHandles()).length === 1);
        assert.equal(
          nativeWindow('probe').running,
          true,
          'closing developer tools must keep main running'
        );
        result.childCloseKeptMain = true;
        await browser.switchToWindow(mainHandle);
        await browser.$('[data-testid="menu-devtools-button"]').click();
        await browser.waitUntil(async () => (await browser.getWindowHandles()).length === 2);
        requestClose();
        await waitForExit();
        result.mainExitClosedChild = true;
      } else {
        assert.equal(scenario, 'clean');
        requestClose();
        await waitForExit();
      }
      result.processExited = !nativeWindow('probe').running;
      assert.equal(result.processExited, true);
      result.forcedCleanupBeforeCheck = false;
      fs.writeFileSync(
        path.join(evidence, 'after-' + scenario + '.json'),
        JSON.stringify(result, null, 2)
      );
    } catch (error) {
      if (nativeWindow('probe').running) {
        result.errors = await browser.execute(() => window.closeProbeErrors);
        await browser.saveScreenshot(path.join(evidence, 'failure-' + scenario + '.png'));
      }
      fs.writeFileSync(
        path.join(evidence, 'failure-' + scenario + '.json'),
        JSON.stringify({ ...result, error: String(error), ...nativeWindow('probe') }, null, 2)
      );
      throw error;
    } finally {
      if (fs.existsSync(process.env.TAURI_E2E_PO_PATH))
        fs.chmodSync(process.env.TAURI_E2E_PO_PATH, 0o666);
    }
  });
});
