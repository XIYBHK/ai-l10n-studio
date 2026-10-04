const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const evidence = process.env.TAURI_E2E_EVIDENCE_DIR
  ? path.resolve(process.env.TAURI_E2E_EVIDENCE_DIR)
  : path.resolve(__dirname, '../../docs/audits/2026-10-03/ui-runtime');
let mainHandle;

function luminance(channels) {
  return channels
    .map((value) => value / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

async function assertPlaceholderContrast() {
  const colors = await browser.execute(() => {
    const placeholder = document.querySelector('.ant-select-placeholder');
    return {
      theme: document.documentElement.dataset.theme,
      text: getComputedStyle(placeholder).color,
      background: getComputedStyle(document.querySelector('.ant-modal-container')).backgroundColor,
    };
  });
  const parse = (value) => value.match(/[\d.]+/g).map(Number);
  const background = parse(colors.background);
  const text = parse(colors.text);
  const alpha = text[3] ?? 1;
  const rendered = text
    .slice(0, 3)
    .map((value, index) => value * alpha + background[index] * (1 - alpha));
  const bright = Math.max(luminance(rendered), luminance(background));
  const dark = Math.min(luminance(rendered), luminance(background));
  const contrast = (bright + 0.05) / (dark + 0.05);
  fs.writeFileSync(
    path.join(evidence, `placeholder-contrast-${colors.theme}.json`),
    JSON.stringify({ ...colors, contrast }, null, 2)
  );
  assert.ok(
    contrast >= 3,
    'empty model placeholder must remain readable: ' + JSON.stringify(colors)
  );
}

async function visible(selector) {
  let result;
  await browser.waitUntil(
    async () => {
      for (const element of await browser.$$(selector)) {
        if (await element.isDisplayed()) {
          result = element;
          return true;
        }
      }
      return false;
    },
    { timeoutMsg: 'No visible element: ' + selector }
  );
  return result;
}

async function closeModal() {
  await (await visible('.ant-modal-close')).click();
  await browser.waitUntil(async () => {
    for (const modal of await browser.$$('.ant-modal-wrap')) {
      if (await modal.isDisplayed()) return false;
    }
    return true;
  });
}

async function openSettings() {
  await browser.$('[data-testid="menu-settings-button"]').click();
  await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
  await browser.waitUntil(
    async () =>
      await browser.execute(
        () => !document.querySelector('.ant-zoom-appear-active, .ant-zoom-enter-active')
      )
  );
}

async function assertStyles() {
  const styles = await browser.execute(() =>
    [...document.querySelectorAll('style[data-css-hash]')]
      .filter((node) => node.textContent.trim())
      .map((node) => ({
        nonce: node.nonce,
        enabled: !!node.sheet,
        rules: node.sheet?.cssRules.length,
      }))
  );
  assert.ok(styles.length > 5, 'Ant Design must have registered real component styles');
  assert.ok(
    styles.every((style) => style.nonce && style.enabled && style.rules > 0),
    'production CSP must accept all registered Ant Design styles'
  );
}

async function capture(name) {
  await browser.waitUntil(
    async () =>
      await browser.execute(
        () => !document.querySelector('.ant-zoom-appear-active, .ant-zoom-enter-active')
      )
  );
  await browser.saveScreenshot(path.join(evidence, name + '.png'));
  const state = await browser.execute(() => ({
    url: location.href,
    theme: document.documentElement.dataset.theme,
    viewport: { width: innerWidth, height: innerHeight },
    styles: [...document.querySelectorAll('style[data-css-hash]')].map((node) => ({
      nonce: node.nonce,
      enabled: !!node.sheet,
      rules: node.sheet?.cssRules.length,
    })),
    boxes: [...document.querySelectorAll('.ant-modal, .ant-tabs, textarea')].map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        class: node.className,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }),
  }));
  fs.writeFileSync(path.join(evidence, name + '.json'), JSON.stringify(state, null, 2));
}

describe('Production desktop UI', () => {
  before(async () => {
    fs.mkdirSync(evidence, { recursive: true });
    await browser.waitUntil(
      async () => {
        for (const handle of await browser.getWindowHandles()) {
          await browser.switchToWindow(handle);
          if (await browser.$('[data-testid="menu-settings-button"]').isExisting()) {
            mainHandle = handle;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000, timeoutMsg: 'actual desktop UI did not load' }
    );
    await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
    await browser.waitUntil(
      async () =>
        await browser.execute(
          () => !document.querySelector('.ant-zoom-appear-active, .ant-zoom-enter-active')
        )
    );
  });

  afterEach(async function () {
    if (this.currentTest.state === 'failed') {
      await browser.saveScreenshot(path.join(evidence, 'failure.png'));
      const html = await browser.execute(() => document.body.innerHTML);
      fs.writeFileSync(path.join(evidence, 'failure.html'), html);
    }
  });

  it('loads component styles under the production CSP and displays settings in the viewport', async () => {
    assert.equal(await browser.getUrl(), 'http://tauri.localhost/');
    const preferencesPath = await browser.executeAsync((done) => {
      window.__TAURI_INTERNALS__.invoke('get_app_settings_path').then(done);
    });
    assert.equal(
      path.resolve(preferencesPath),
      path.join(
        path.dirname(process.env.TAURI_APP_PATH),
        '.config',
        'com.potranslator.gui',
        'app-settings.json'
      )
    );
    await assertStyles();
    await assertPlaceholderContrast();
    const geometry = await browser.execute(() => {
      const modal = document.querySelector('.ant-modal').getBoundingClientRect();
      return {
        width: modal.width,
        x: modal.x,
        y: modal.y,
        fixed: getComputedStyle(document.querySelector('.ant-modal-wrap')).position,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
      };
    });
    assert.equal(geometry.fixed, 'fixed');
    assert.ok(geometry.width >= 700 && geometry.x >= 0 && geometry.y >= 0);
    assert.ok(
      geometry.y < geometry.viewportHeight && geometry.x + geometry.width <= geometry.viewportWidth
    );
    const csp = await browser.executeAsync((done) => {
      fetch(location.href).then((response) =>
        done(response.headers.get('content-security-policy'))
      );
    });
    assert.ok(csp.includes("script-src 'self'"), 'script CSP must remain enabled');
    assert.ok(csp.includes('nonce-'), 'Tauri must still enforce style nonces');
    fs.writeFileSync(path.join(evidence, 'production-csp.txt'), csp);
    await capture('after-settings');
  });

  it('opens every settings tab and styled dropdown without losing the dialog', async () => {
    const content = await browser.$('[data-testid="settings-modal-content"]');
    const tabs = await content.$$('.ant-tabs-tab-btn');
    assert.equal(tabs.length, 5);
    for (const tab of tabs) {
      await tab.click();
      assert.ok(await content.isDisplayed());
      assert.ok((await (await content.$('.ant-tabs-tabpane-active')).getText()).length > 0);
      await assertStyles();
    }
    await tabs[2].click();
    await content.$('.ant-tabs-tabpane-active .ant-select').click();
    const dropdown = await visible('.ant-select-dropdown');
    assert.ok((await dropdown.getSize('width')) > 100);
    await browser.keys('Escape');
    await closeModal();
    await openSettings();
    await closeModal();
  });

  it('changes text and background together on every painted frame in both themes', async () => {
    for (let turn = 0; turn < 4; turn++) {
      const samples = await browser.executeAsync((done) => {
        const previous = document.documentElement.dataset.theme;
        const target = previous === 'dark' ? 'light' : 'dark';
        document.querySelector('[data-testid="menu-theme-toggle"]').click();
        const frames = [];
        const sample = () => {
          const css = getComputedStyle(document.querySelector('[data-testid="app-shell"]'));
          frames.push({
            theme: document.documentElement.dataset.theme,
            bodyTheme: document.body.dataset.theme,
            color: css.color,
            background: css.backgroundColor,
            textColors: [
              '[data-testid="menu-settings-button"]',
              'h1',
              '[data-testid="menu-theme-toggle"]',
            ].map((selector) => getComputedStyle(document.querySelector(selector)).color),
          });
          if (frames.length < 20) requestAnimationFrame(sample);
          else done({ target, frames });
        };
        requestAnimationFrame(sample);
      });
      assert.ok(
        samples.frames.every(
          (frame) => frame.theme === samples.target && frame.bodyTheme === samples.target
        )
      );
      assert.equal(
        new Set(samples.frames.map((frame) => frame.color)).size,
        1,
        'text color must not animate through intermediate values'
      );
      assert.equal(
        new Set(samples.frames.map((frame) => frame.background)).size,
        1,
        'background must not lag behind text'
      );
      assert.equal(
        new Set(samples.frames.map((frame) => JSON.stringify(frame.textColors))).size,
        1,
        'heading and toolbar text must not flicker through intermediate colors'
      );
      fs.writeFileSync(
        path.join(evidence, `theme-frames-${turn}.json`),
        JSON.stringify(samples, null, 2)
      );
      await openSettings();
      await assertPlaceholderContrast();
      await closeModal();
    }
    await capture('after-main');
  });

  it('renders the file dropdown and both library dialogs with valid portal styles', async () => {
    await browser.$('button[aria-label="文件操作"]').click();
    await browser.executeAsync((filePath, done) => {
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
    await browser.$('[data-testid="open-memory-manager"]').waitForExist();
    const assistant = await browser.$('button[aria-controls="workspace-assistant"]');
    if (await assistant.isDisplayed()) await assistant.click();
    await browser.$('[data-testid="open-memory-manager"]').waitForDisplayed();
    const menu = await visible('.ant-dropdown');
    assert.ok((await menu.getSize('width')) > 100);
    await browser.$('button[aria-label="文件操作"]').click();
    for (const entry of ['open-memory-manager', 'open-term-manager']) {
      await browser.$(`[data-testid="${entry}"]`).click();
      await browser.waitUntil(async () => {
        for (const table of await browser.$$('.ant-modal .ant-table-wrapper'))
          if (await table.isDisplayed()) return true;
        return false;
      });
      await assertStyles();
      const modal = await visible('.ant-modal');
      assert.ok((await modal.getSize('width')) >= 700);
      await capture('after-' + entry);
      await closeModal();
    }
    if ((await assistant.getAttribute('aria-expanded')) === 'true') {
      await browser.keys('Escape');
      await browser.$('.ant-drawer-section').waitForDisplayed({ reverse: true });
    }
  });

  it('renders contextual feedback and saves a focused editor draft through native IPC', async () => {
    const editor = await browser.$('textarea[aria-label="译文编辑"]');
    await editor.setValue('取消测试');
    await browser.$('button[aria-label="取消修改 (Esc)"]').click();
    await (await visible('.ant-message')).getText();
    await assertStyles();
    assert.equal(await editor.getValue(), '');
    await editor.setValue('本地检查');
    await browser.performActions([
      {
        type: 'key',
        id: 'save-shortcut',
        actions: [
          { type: 'keyDown', value: '\uE009' },
          { type: 'keyDown', value: 's' },
          { type: 'keyUp', value: 's' },
          { type: 'keyUp', value: '\uE009' },
        ],
      },
    ]);
    await browser.releaseActions();
    await browser.waitUntil(async () =>
      fs.readFileSync(process.env.TAURI_E2E_PO_PATH, 'utf8').includes('msgstr "本地检查"')
    );
    await assertStyles();
    await capture('after-editor');
  });

  it('loads saved language and theme in developer tools and keeps both windows synchronized', async () => {
    await openSettings();
    const content = await browser.$('[data-testid="settings-modal-content"]');
    await (await content.$$('.ant-tabs-tab-btn'))[2].click();
    await content.$('.ant-tabs-tabpane-active .ant-select').click();
    await browser.$('.ant-select-item-option[title="English"]').click();
    await browser.waitUntil(
      async () =>
        (await browser.$('[data-testid="menu-settings-button"]').getAttribute('aria-label')) ===
        'Settings'
    );
    await closeModal();
    const mainTheme = await browser.execute(() => document.documentElement.dataset.theme);
    await browser.$('[data-testid="menu-devtools-button"]').click();
    let devtoolsHandle;
    await browser.waitUntil(async () => {
      for (const handle of await browser.getWindowHandles()) {
        if (handle === mainHandle) continue;
        await browser.switchToWindow(handle);
        if (
          (await browser.getUrl()).includes('devtools.html') &&
          (await browser.$('textarea').isExisting())
        ) {
          devtoolsHandle = handle;
          return true;
        }
      }
      return false;
    });
    assert.equal(await browser.execute(() => document.documentElement.dataset.theme), mainTheme);
    assert.ok((await browser.$('.ant-tabs').getText()).includes('Backend Logs'));
    await assertStyles();
    const textArea = await browser.$('textarea');
    assert.ok((await textArea.getSize('width')) > 650, 'logs must fill the window');
    await capture('after-devtools');
    const tabs = await browser.$$('.ant-tabs-tab-btn');
    await browser.$('button=Pause').click();
    await tabs[1].click();
    assert.ok(
      (await browser.$('.ant-tabs-tabpane-active').getText()).includes('(updates every 2s)'),
      'prompt monitoring must be independent'
    );
    await browser.switchToWindow(mainHandle);
    await browser.$('[data-testid="menu-theme-toggle"]').click();
    const nextTheme = await browser.execute(() => document.documentElement.dataset.theme);
    await browser.switchToWindow(devtoolsHandle);
    await browser.waitUntil(
      async () =>
        (await browser.execute(() => document.documentElement.dataset.theme)) === nextTheme
    );
    await browser.switchToWindow(mainHandle);
    await browser.$('[data-testid="menu-devtools-button"]').click();
    assert.equal(
      (await browser.getWindowHandles()).length,
      2,
      'reopening must focus the existing window'
    );
  });
});
