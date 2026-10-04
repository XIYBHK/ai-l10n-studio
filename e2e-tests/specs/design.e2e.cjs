const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zh = require('../../src/i18n/locales/zh-CN.json');
const en = require('../../src/i18n/locales/en-US.json');
const evidence = path.resolve(__dirname, '../../docs/audits/2026-10-04/ui-redesign');
const results = {};
let sequenceFailed = false;

async function settle() {
  await browser.waitUntil(() =>
    browser.execute(
      () =>
        !document.querySelector(
          '.ant-zoom-appear-active,.ant-zoom-enter-active,[class*="ant-drawer-panel-motion-"][class*="-active"],.ant-drawer-mask-motion-enter-active,.ant-drawer-mask-motion-leave-active,.ant-message-move-up-appear-active,.ant-message-move-up-enter-active'
        )
    )
  );
}
async function capture(name) {
  await settle();
  // Keep keyboard focus intact when capturing an overlay interaction.
  if (!(await browser.execute(() => !!document.querySelector('[role="dialog"]')))) {
    await browser.performActions([
      {
        type: 'pointer',
        id: 'capture-pointer',
        parameters: { pointerType: 'mouse' },
        actions: [{ type: 'pointerMove', duration: 0, origin: 'viewport', x: 160, y: 140 }],
      },
    ]);
    await browser.releaseActions();
  }
  await browser.waitUntil(() =>
    browser.execute(() =>
      [...document.querySelectorAll('.ant-tooltip')].every(
        (n) => !n.getClientRects().length || getComputedStyle(n).visibility === 'hidden'
      )
    )
  );
  await browser.saveScreenshot(path.join(evidence, name + '.png'));
  const state = await browser.execute(() => {
    const visible = (n) => n.getClientRects().length && getComputedStyle(n).visibility !== 'hidden';
    return {
      theme: document.documentElement.dataset.theme,
      viewport: { width: innerWidth, height: innerHeight },
      focus: {
        tag: document.activeElement.tagName,
        label: document.activeElement.getAttribute('aria-label'),
        inDrawer: !!document.activeElement.closest('.ant-drawer-section'),
      },
      tokens: Object.fromEntries(
        [
          'bgPrimary',
          'bgSecondary',
          'textPrimary',
          'textSecondary',
          'textTertiary',
          'brandPrimary',
          'sourceTmBg',
          'sourceTmColor',
          'sourceAiBg',
          'sourceAiColor',
        ].map((k) => [
          k,
          getComputedStyle(document.documentElement)
            .getPropertyValue('--color-' + k)
            .trim(),
        ])
      ),
      overflowing: [
        ...document.querySelectorAll(
          'h2,h3,nav,button,[class*="toolbar"],[class*="statusBar"],.ant-segmented-item-label'
        ),
      ]
        .filter(visible)
        .filter((n) => n.scrollWidth > n.clientWidth + 2)
        .map((n) => ({
          text: n.textContent.trim(),
          client: n.clientWidth,
          scroll: n.scrollWidth,
          class: n.className,
        })),
      primaryButtons: [...document.querySelectorAll('.ant-btn-primary')]
        .filter(visible)
        .map((n) => ({
          text: n.textContent.trim(),
          color: getComputedStyle(n).color,
          background: getComputedStyle(n).backgroundColor,
        })),
    };
  });
  fs.writeFileSync(path.join(evidence, name + '.json'), JSON.stringify(state, null, 2));
  return state;
}
async function assertStyles() {
  const styles = await browser.execute(() =>
    [...document.querySelectorAll('style[data-css-hash]')]
      .filter((n) => n.textContent.trim())
      .map((n) => ({ nonce: !!n.nonce, enabled: !!n.sheet }))
  );
  assert.ok(
    styles.length > 5 && styles.every((n) => n.nonce && n.enabled),
    'CSP must accept all component styles'
  );
}
async function closeModal() {
  for (const button of await browser.$$('.ant-modal-close')) {
    if (await button.isDisplayed()) {
      await button.click();
      break;
    }
  }
  await browser.waitUntil(async () => {
    for (const modal of await browser.$$('.ant-modal-wrap'))
      if (await modal.isDisplayed()) return false;
    return true;
  });
  await browser.$('.ant-modal-wrap').waitForExist({ reverse: true });
  await browser.executeAsync((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}
async function setTheme(theme) {
  if ((await browser.execute(() => document.documentElement.dataset.theme)) !== theme)
    await browser.$('[data-testid="menu-theme-toggle"]').click();
  await browser.waitUntil(
    async () => (await browser.execute(() => document.documentElement.dataset.theme)) === theme
  );
}
async function openAssistant() {
  const button = await browser.$('button[aria-controls="workspace-assistant"]');
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  await browser.$('.ant-drawer-section').waitForDisplayed();
  await settle();
  await browser.waitUntil(() =>
    browser.execute(() => {
      const wrapper = document.querySelector('.ant-drawer-content-wrapper');
      const b = wrapper.getBoundingClientRect();
      return (
        b.right <= innerWidth + 1 &&
        b.left >= 0 &&
        wrapper.getAnimations({ subtree: true }).every((a) => a.playState === 'finished')
      );
    })
  );
}

describe('Frontend design release regressions', () => {
  before(async () => {
    fs.mkdirSync(evidence, { recursive: true });
    await browser.execute(() => {
      window.designInputTrace = [];
      window.designCompositionEnd = 0;
      window.addEventListener('compositionend', () => {
        window.designCompositionEnd = performance.now();
      });
      window.addEventListener('keydown', (event) => {
        if (!['Escape', 'Tab'].includes(event.key)) return;
        window.designInputTrace.push({
          key: event.key,
          composing: event.isComposing,
          sinceComposition: performance.now() - window.designCompositionEnd,
          target: event.target.tagName,
          label: event.target.getAttribute('aria-label'),
          defaultPrevented: event.defaultPrevented,
          stopped: event.cancelBubble,
        });
      });
    });
  });
  beforeEach(function () {
    if (sequenceFailed) this.skip();
  });
  after(async () => {
    results.inputTrace = await browser.execute(() => window.designInputTrace);
    fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify(results, null, 2));
  });
  afterEach(async function () {
    if (this.currentTest.state === 'failed') {
      sequenceFailed = true;
      await capture('failure');
    }
  });

  it('keeps provider feedback visible under CSP and captures the two welcome themes', async () => {
    await browser.setWindowSize(1400, 850);
    await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
    await capture('settings-dark');
    const modal = await browser.$('.ant-modal');
    await modal.$('button=' + zh.modelSettings.addCustom).click();
    await modal.$('input[placeholder="my-provider"]').setValue('design-test-local');
    await modal.$('#displayName').setValue('Design Test Local');
    await modal.$('#baseUrl').setValue('http://127.0.0.1:11434/v1');
    await modal
      .$('input[aria-label="' + zh.modelSettings.modelId + '"]')
      .setValue('design-test-model');
    await modal.$('button=' + zh.modelSettings.save).click();
    await modal.$('input[placeholder="my-provider"]').waitForExist({ reverse: true });
    await browser.$('.ant-message-notice-content').waitForDisplayed();
    await settle();
    results.feedback = await browser.execute(() => {
      const n = document.querySelector('.ant-message-notice-content');
      const b = n.getBoundingClientRect();
      return {
        text: n.textContent,
        box: { x: b.x, y: b.y, width: b.width, height: b.height },
        inViewport: b.x >= 0 && b.y >= 0 && b.right <= innerWidth && b.bottom <= innerHeight,
      };
    });
    fs.writeFileSync(
      path.join(evidence, 'feedback.json'),
      JSON.stringify(results.feedback, null, 2)
    );
    assert.ok(results.feedback.inViewport);
    assert.ok(results.feedback.text.includes(zh.modelSettings.saved));
    await assertStyles();
    await capture('provider-feedback');
    await closeModal();
    await browser.$('.ant-message-notice-content').waitForExist({ reverse: true });
    await setTheme('dark');
    await capture('welcome-dark');
    await setTheme('light');
    await capture('welcome-light');
  });

  it('lays out the editor in both themes, including English at the minimum list width', async () => {
    fs.copyFileSync(
      path.resolve(__dirname, '../../examples/test.en-zh_CN.po'),
      process.env.TAURI_E2E_PO_PATH
    );
    const error = await browser.executeAsync(
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
      process.env.TAURI_E2E_PO_PATH
    );
    assert.equal(error, null);
    await browser.$('textarea[aria-label="译文编辑"]').waitForDisplayed();
    await browser.$('[data-testid="open-memory-manager"]').waitForDisplayed();
    await capture('editor-light');
    await setTheme('dark');
    await capture('editor-dark');
    await browser.setWindowSize(1000, 700);
    await capture('editor-narrow-dark');
    await browser.$('[data-testid="menu-settings-button"]').click();
    await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
    await (await browser.$$('.ant-tabs-tab-btn'))[2].click();
    await browser.$('.ant-tabs-tabpane-active .ant-select').click();
    await browser.$('.ant-select-item-option[title="English"]').click();
    await closeModal();
    const separator = await browser.$('[role="separator"]');
    await separator.click();
    await browser.keys(['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']);
    assert.equal(await separator.getAttribute('aria-valuenow'), '260');
    results.filters = await browser.execute(() =>
      [...document.querySelectorAll('.ant-segmented-item-label')].map((n) => ({
        text: n.textContent,
        client: n.clientWidth,
        scroll: n.scrollWidth,
      }))
    );
    assert.ok(
      results.filters.every((n) => n.client >= n.scroll),
      'English filters must fit without clipping'
    );
    assert.ok(
      (
        await browser.$('button[title="' + en.workspace.editor.next + '"]').getComputedLabel()
      ).includes('Next entry')
    );
    results.entryLabel = await browser.$('[role="listitem"]').getComputedLabel();
    assert.ok(
      results.entryLabel.includes('Untranslated') && !/[\u4e00-\u9fff]/.test(results.entryLabel)
    );
    await capture('editor-narrow-en-dark');
    await setTheme('light');
    await capture('editor-narrow-en-light');
    await browser.$('[data-testid="menu-settings-button"]').click();
    await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
    await capture('settings-narrow-en-light');
    await closeModal();
  });

  it('contains drawer focus, preserves editor drafts, and guards unsaved library changes', async () => {
    const editor = await browser.$('textarea');
    await editor.setValue('Draft retained after closing the assistant');
    const draft = await editor.getValue();
    await openAssistant();
    results.drawerFocus = [];
    for (let i = 0; i < 16; i++) {
      await browser.keys(i < 8 ? 'Tab' : ['Shift', 'Tab']);
      await browser.waitUntil(
        () => browser.execute(() => !!document.activeElement.closest('.ant-drawer-section')),
        { timeout: 1000, interval: 50, timeoutMsg: 'Drawer must restore focus after Tab' }
      );
      const focus = await browser.execute(() => {
        const n = document.activeElement,
          b = n.getBoundingClientRect();
        const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return {
          label: n.getAttribute('aria-label') || n.textContent.trim(),
          inDrawer: !!n.closest('.ant-drawer'),
          unobscured: b.width <= 2 || (!!hit && n.contains(hit)),
        };
      });
      results.drawerFocus.push(focus);
      assert.ok(
        focus.inDrawer && focus.unobscured,
        'Tab must stay in the visible assistant drawer'
      );
    }
    await capture('assistant-narrow-en-light');
    await browser.keys('Escape');
    await browser.$('.ant-drawer-section').waitForDisplayed({ reverse: true });
    assert.equal(
      await editor.getValue(),
      draft,
      'Closing the drawer must not cancel the editor draft'
    );
    await openAssistant();
    await browser.$('[data-testid="open-memory-manager"]').click();
    const row = await browser.$('.ant-table-tbody tr.ant-table-row input');
    await row.waitForDisplayed();
    const original = await row.getValue();
    await row.setValue('Unsaved design test source');
    const changed = await row.getValue();
    assert.notEqual(changed, original);
    results.memoryFieldLabels = [];
    for (const n of await browser.$$('.ant-table-tbody input'))
      results.memoryFieldLabels.push(await n.getComputedLabel());
    assert.ok(
      results.memoryFieldLabels.every(Boolean),
      'Every memory input must have an accessible name'
    );
    await browser.keys('Escape');
    await browser.$('.ant-modal-confirm').waitForDisplayed();
    assert.ok(
      (await browser.$('.ant-modal-confirm').getText()).includes(en.libraryDraft.discardTitle)
    );
    await capture('memory-discard-prompt');
    await (await browser.$('.ant-modal-confirm')).$('button=' + en.common.cancel).click();
    await browser.$('.ant-modal-confirm').waitForDisplayed({ reverse: true });
    assert.equal(await row.getValue(), changed);
    await browser.$('.ant-modal-close').click();
    await browser.$('.ant-modal-confirm').waitForDisplayed();
    await (await browser.$('.ant-modal-confirm')).$('button=' + en.document.discard).click();
    await browser.$('.ant-modal .ant-table-wrapper').waitForDisplayed({ reverse: true });
    await browser.$('.ant-modal-wrap').waitForExist({ reverse: true });
    await browser.$('[data-testid="open-memory-manager"]').click();
    await browser.$('.ant-table-tbody tr.ant-table-row input').waitForDisplayed();
    assert.equal(await browser.$('.ant-table-tbody tr.ant-table-row input').getValue(), original);
    results.libraryDraftGuard = true;
    await capture('memory-en-light');
    await closeModal();
    await browser.waitUntil(() =>
      browser.execute(() => !!document.activeElement.closest('.ant-drawer-section'))
    );
    results.focusRestoredAfterLibrary = true;
    await browser.keys('Escape');
    await browser.$('.ant-drawer-section').waitForDisplayed({ reverse: true });
    assert.equal(await editor.getValue(), draft, 'Library dismissal must preserve the PO draft');
    await browser.$('button[aria-label="' + en.workspace.editor.cancelEdit + '"]').click();
    await browser.setWindowSize(1400, 850);
    await browser.$('[data-testid="open-memory-manager"]').waitForDisplayed();
    await capture('editor-en-light');
    await setTheme('dark');
    await capture('editor-en-dark');
    await assertStyles();
  });
});
