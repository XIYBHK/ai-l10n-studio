const assert = require('node:assert/strict');

describe('Desktop smoke', () => {
  it('starts a Tauri WebDriver session and discovers a desktop webview handle', async () => {
    await browser.pause(5000);

    const handles = await browser.getWindowHandles();
    const currentUrl = await browser.getUrl();

    assert.ok(handles.length >= 1, 'expected at least one desktop webview handle');
    assert.equal(typeof currentUrl, 'string');
  });
});
