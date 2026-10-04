const fs = require('node:fs');
const path = require('node:path');
const evidence = __dirname;
const sample = path.resolve(__dirname, '../../../../examples/test.en-zh_CN.po');
async function settle() {
  await browser.waitUntil(async () =>
    browser.execute(() => !document.querySelector('.ant-zoom-appear-active,.ant-zoom-enter-active'))
  );
}
async function capture(name) {
  await settle();
  await browser.saveScreenshot(path.join(evidence, name + '.png'));
  const state = await browser.execute(() => {
    const visible = (n) => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
    const rect = (n) => {
      const b = n.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    return {
      theme: document.documentElement.dataset.theme,
      viewport: { width: innerWidth, height: innerHeight },
      controls: [
        ...document.querySelectorAll(
          'button,input,textarea,[role="separator"],[role="listitem"],.ant-segmented-item'
        ),
      ]
        .filter(visible)
        .map((n) => ({
          tag: n.tagName,
          role: n.getAttribute('role'),
          text: n.textContent.trim().slice(0, 100),
          label: n.getAttribute('aria-label'),
          title: n.getAttribute('title'),
          disabled: n.disabled,
          tabIndex: n.tabIndex,
          box: rect(n),
        })),
      overflowing: [
        ...document.querySelectorAll(
          'h1,h2,h3,button,[class*="toolbar"],[class*="statusBar"],.ant-segmented,[class*="sourceContent"],[class*="contextValue"]'
        ),
      ]
        .filter(visible)
        .filter((n) => n.scrollWidth > n.clientWidth + 2)
        .map((n) => ({
          tag: n.tagName,
          text: n.textContent.trim().slice(0, 140),
          class: n.className,
          box: rect(n),
          client: n.clientWidth,
          scroll: n.scrollWidth,
          overflow: getComputedStyle(n).overflowX,
        })),
      tokens: Object.fromEntries(
        [
          'bgPrimary',
          'bgSecondary',
          'textPrimary',
          'textSecondary',
          'textTertiary',
          'brandPrimary',
          'brandSecondary',
          'warning',
          'error',
          'statusUntranslated',
          'statusNeedsReview',
          'statusTranslated',
          'sourceTmBg',
          'sourceTmColor',
          'sourceDedupBg',
          'sourceDedupColor',
          'sourceAiBg',
          'sourceAiColor',
        ].map((k) => [
          k,
          getComputedStyle(document.documentElement)
            .getPropertyValue('--color-' + k)
            .trim(),
        ])
      ),
      styles: [...document.querySelectorAll('style[data-css-hash]')]
        .filter((n) => n.textContent.trim())
        .map((n) => ({ enabled: !!n.sheet, nonce: !!n.nonce })),
      textSamples: [
        ...document.querySelectorAll(
          '[class*="translationStatus"],[class*="indexLabel"],[class*="savedIndicator"],[class*="unsavedIndicator"],[class*="sourceTag"],[class*="sourceBadge"],.ant-alert-description,.ant-alert-message'
        ),
      ]
        .filter(visible)
        .map((n) => ({
          text: n.textContent.trim(),
          class: n.className,
          color: getComputedStyle(n).color,
          background: getComputedStyle(n).backgroundColor,
          fontSize: getComputedStyle(n).fontSize,
          opacity: getComputedStyle(n).opacity,
          box: rect(n),
        })),
    };
  });
  fs.writeFileSync(path.join(evidence, name + '.json'), JSON.stringify(state, null, 2));
}
async function closeModal() {
  for (const b of await browser.$$('.ant-modal-close'))
    if (await b.isDisplayed()) {
      await b.click();
      break;
    }
  await browser.waitUntil(async () => {
    for (const m of await browser.$$('.ant-modal-wrap')) if (await m.isDisplayed()) return false;
    return true;
  });
}
describe('UI UX design audit', () => {
  it('captures actual release layouts and interaction states', async () => {
    fs.mkdirSync(evidence, { recursive: true });
    await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
    await capture('settings-initial');
    await closeModal();
    await capture('welcome-dark');
    await browser.$('[data-testid="menu-theme-toggle"]').click();
    await capture('welcome-light');
    const result = await browser.executeAsync(
      (filePath, done) =>
        window.__TAURI_INTERNALS__
          .invoke('plugin:event|emit_to', {
            target: { kind: 'AnyLabel', label: 'main' },
            event: 'tauri://drag-drop',
            payload: { paths: [filePath], position: { x: 10, y: 10 } },
          })
          .then(
            () => done(null),
            (e) => done(String(e))
          ),
      sample
    );
    if (result) throw new Error(result);
    await browser.$('textarea[aria-label="译文编辑"]').waitForDisplayed();
    await browser.$('[data-testid="open-memory-manager"]').waitForDisplayed();
    await capture('editor-light');
    await browser.$('[data-testid="menu-theme-toggle"]').click();
    await capture('editor-dark');
    const resize = {};
    try {
      await browser.setWindowSize(1000, 700);
      resize.ok = true;
    } catch (e) {
      resize.error = e.message;
    }
    fs.writeFileSync(path.join(evidence, 'resize.json'), JSON.stringify(resize, null, 2));
    await capture('editor-narrow-dark');
    const assistant = await browser.$('button[aria-controls="workspace-assistant"]');
    if (await assistant.isDisplayed()) {
      await assistant.click();
      await capture('assistant-narrow-dark');
      await assistant.click();
    }
    await browser.$('[data-testid="menu-settings-button"]').click();
    await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
    await capture('settings-narrow-dark');
    const tabs = await browser.$$('.ant-tabs-tab-btn');
    await tabs[2].click();
    const select = await browser.$('.ant-tabs-tabpane-active .ant-select');
    await select.click();
    await browser.$('.ant-select-item-option[title="English"]').click();
    await closeModal();
    await capture('editor-narrow-en-dark');
    await browser.$('[data-testid="menu-theme-toggle"]').click();
    await capture('editor-narrow-en-light');
    await browser.$('[data-testid="menu-settings-button"]').click();
    await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
    await (await browser.$$('.ant-tabs-tab-btn'))[0].click();
    await capture('settings-narrow-en-light');
    await closeModal();
  });
});
