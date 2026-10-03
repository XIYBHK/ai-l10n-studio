import i18n from '../i18n/config';

describe('bundled application translations', () => {
  it('initializes before rendering and can switch between bundled languages', async () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.t('workspace.title')).toBe('翻译工作台');
    await i18n.changeLanguage('en-US');
    expect(i18n.t('workspace.sourceLabel')).toBe('SOURCE');
    await i18n.changeLanguage('zh-CN');
    expect(i18n.t('workspace.sourceLabel')).toBe('原文');
  });
});
