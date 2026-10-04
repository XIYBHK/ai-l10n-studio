const fs = require('node:fs');
const zh = require('../../../../src/i18n/locales/zh-CN.json');
const evidence = __dirname;
describe('UI UX production feedback audit', () => {
  it('saves a dummy local provider and inspects the success feedback style', async () => {
    await browser.$('[data-testid="settings-modal-content"]').waitForDisplayed();
    const modal = await browser.$('.ant-modal');
    await modal.$('button=' + zh.modelSettings.addCustom).click();
    await modal.$('input[placeholder="my-provider"]').setValue('ui-audit-local');
    await modal.$('input[id="displayName"]').setValue('UI Audit Local');
    await modal
      .$('input[placeholder="https://api.example.com/v1"]')
      .setValue('http://127.0.0.1:11434/v1');
    await modal
      .$('input[aria-label="' + zh.modelSettings.modelId + '"]')
      .setValue('ui-audit-model');
    await modal.$('button=' + zh.modelSettings.save).click();
    await modal.$('input[placeholder="my-provider"]').waitForExist({ reverse: true });
    const state = await browser.execute(() => ({
      theme: document.documentElement.dataset.theme,
      message: document.querySelector('.ant-message')?.textContent,
      messageHtml: document.querySelector('.ant-message')?.outerHTML,
      bodyText: document.body.innerText,
      formInputs: [...document.querySelectorAll('.ant-modal input')]
        .filter((n) => n.type !== 'password')
        .map((n) => ({ id: n.id, label: n.getAttribute('aria-label'), value: n.value })),
      box: (() => {
        const b = document.querySelector('.ant-message')?.getBoundingClientRect();
        return b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null;
      })(),
      styles: [...document.querySelectorAll('style[data-css-hash]')]
        .filter((n) => n.textContent.trim())
        .map((n) => ({
          hash: n.getAttribute('data-css-hash'),
          nonce: !!n.nonce,
          enabled: !!n.sheet,
        })),
      feedbackStyle: document.querySelector('.ant-message')
        ? {
            color: getComputedStyle(document.querySelector('.ant-message')).color,
            background: getComputedStyle(document.querySelector('.ant-message')).backgroundColor,
          }
        : null,
    }));
    fs.writeFileSync(path.join(evidence, 'provider-feedback.json'), JSON.stringify(state, null, 2));
    await browser.saveScreenshot(path.join(evidence, 'provider-feedback.png'));
  });
});
