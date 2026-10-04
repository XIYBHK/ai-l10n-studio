const fs = require('node:fs');
const path = require('node:path');
const evidence = __dirname;
const sample = path.resolve(__dirname, '../../../../examples/test.en-zh_CN.po');
const results = {};
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
async function openAssistant() {
  const b = await browser.$('button[aria-controls="workspace-assistant"]');
  if ((await b.isDisplayed()) && (await b.getAttribute('aria-expanded')) !== 'true')
    await b.click();
  await browser.$('[data-testid="open-memory-manager"]').waitForDisplayed();
}
async function screenshot(name) {
  await browser.waitUntil(async () =>
    browser.execute(() => !document.querySelector('.ant-zoom-appear-active,.ant-zoom-enter-active'))
  );
  await browser.saveScreenshot(path.join(evidence, name + '.png'));
}
describe('UI UX interaction audit', () => {
  it('probes library dirty close, overlay focus and compact filters', async () => {
    await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
    await closeModal();
    await browser.executeAsync(
      (p, done) =>
        window.__TAURI_INTERNALS__
          .invoke('plugin:event|emit_to', {
            target: { kind: 'AnyLabel', label: 'main' },
            event: 'tauri://drag-drop',
            payload: { paths: [p], position: { x: 10, y: 10 } },
          })
          .then(
            () => done(null),
            (e) => done(String(e))
          ),
      sample
    );
    await browser.$('textarea[aria-label="译文编辑"]').waitForDisplayed();
    await browser.$('[data-testid="open-memory-manager"]').waitForExist();
    await browser.setWindowSize(1000, 700);
    await openAssistant();
    await screenshot('assistant-ready');
    await browser.execute(() => document.querySelector('[role="separator"]').focus());
    await browser.keys(['Tab', 'Tab']);
    results.overlayFocus = await browser.execute(() => {
      const n = document.activeElement,
        b = n.getBoundingClientRect(),
        hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return {
        focusedLabel: n.getAttribute('aria-label'),
        focusedBox: { x: b.x, y: b.y, w: b.width, h: b.height },
        hitTag: hit?.tagName,
        hitText: hit?.textContent.slice(0, 70),
        obscured: !!hit && !n.contains(hit),
        assistantOpen: document
          .querySelector('[aria-controls="workspace-assistant"]')
          .getAttribute('aria-expanded'),
      };
    });
    await screenshot('overlay-focused-copy');
    await browser.$('[data-testid="open-memory-manager"]').click();
    await browser.$('.ant-modal .ant-table-wrapper').waitForDisplayed();
    const inputs = await browser.$$('.ant-modal input.ant-input');
    results.memoryFields = [];
    for (const input of inputs) {
      let name;
      try {
        name = await input.getComputedLabel();
      } catch (e) {
        name = 'unavailable: ' + e.message;
      }
      results.memoryFields.push({
        placeholder: await input.getAttribute('placeholder'),
        ariaLabel: await input.getAttribute('aria-label'),
        computedLabel: name,
      });
    }
    await inputs[1].setValue('UI audit unsaved source');
    await inputs[2].setValue('审查未保存内容');
    await (await browser.$('.ant-modal')).$('button=添加').click();
    await browser.$('.ant-table-tbody input').waitForDisplayed();
    await browser
      .$('.ant-table-tbody tr.ant-table-row input')
      .setValue('UI audit unsaved edited source');
    await screenshot('memory-unsaved');
    const rowsBefore = await browser.$$('.ant-table-tbody tr.ant-table-row');
    results.memoryBeforeClose = {
      rows: rowsBefore.length,
      source: await rowsBefore[0].$('input').getValue(),
    };
    await closeModal();
    results.memoryClosedWithoutPrompt = !(await browser.$('.ant-modal-wrap').isDisplayed());
    await browser.$('[data-testid="open-memory-manager"]').click();
    await browser.$('.ant-modal .ant-table-wrapper').waitForDisplayed();
    await browser.waitUntil(async () =>
      browser.execute(() => !document.querySelector('.ant-modal .ant-spin-spinning'))
    );
    results.memoryAfterReopen = {
      rows: (await browser.$$('.ant-table-tbody tr.ant-table-row')).length,
      source: await browser.$('.ant-table-tbody tr.ant-table-row input').getValue(),
    };
    await screenshot('memory-reopened');
    await closeModal();
    await browser.$('button[aria-controls="workspace-assistant"]').click();
    await browser.$('[data-testid="menu-settings-button"]').click();
    await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
    await (await browser.$$('.ant-tabs-tab-btn'))[2].click();
    await browser.$('.ant-tabs-tabpane-active .ant-select').click();
    await browser.$('.ant-select-item-option[title="English"]').click();
    await closeModal();
    const separator = await browser.$('[role="separator"]');
    await separator.click();
    await browser.keys(['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']);
    await screenshot('editor-min-list-en');
    results.compactFilter = await browser.execute(() =>
      [...document.querySelectorAll('.ant-segmented-item-label')].map((n) => ({
        text: n.textContent,
        client: n.clientWidth,
        scroll: n.scrollWidth,
        boxWidth: n.getBoundingClientRect().width,
      }))
    );
    results.englishNavigation = (await browser.$$('button[title*="Ctrl"]')).length;
    fs.writeFileSync(
      path.join(evidence, 'interaction-results.json'),
      JSON.stringify(results, null, 2)
    );
  });
});
