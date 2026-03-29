'use strict';

/**
 * MidScene AI 视觉冒烟测试
 *
 * 运行前提：
 *   1. 设置 MIDSCENE_MODEL_API_KEY 环境变量
 *   2. 已构建 debug 二进制（npm run test:e2e:build）
 *   3. 通过 npm run test:e2e 启动（会自动拉起 tauri-driver）
 *
 * 这些测试不断言 DOM，只通过 AI 视觉理解页面状态。
 */

const assert = require('node:assert/strict');
const { createMidsceneAgent } = require('../midscene-wdio.cjs');

// 等待应用完全渲染的时间（Tauri 冷启动较慢）
const APP_BOOT_WAIT = 5000;

// 每个用例开始前给 AI agent 留的截图稳定时间
const RENDER_SETTLE = 800;

describe('AI 视觉冒烟测试', () => {
  let agent;

  before(async () => {
    // 等待应用启动完毕
    await browser.pause(APP_BOOT_WAIT);
  });

  afterEach(async () => {
    // 每个用例结束后销毁 agent，避免资源泄漏
    if (agent) {
      await agent.destroy();
      agent = null;
    }
  });

  // ─── 用例 1：主界面可见性 ────────────────────────────────────────────
  it('主界面加载完成且显示核心 UI 区域', async () => {
    await browser.pause(RENDER_SETTLE);
    agent = createMidsceneAgent(browser, { generateReport: true });

    // 断言：顶部工具栏或菜单栏存在
    await agent.aiAssert('页面顶部有工具栏或菜单栏');

    // 查询：获取界面摘要，用于调试输出
    const summary = await agent.aiQuery('用一句话描述当前页面显示的主要内容');
    console.log('[AI] 界面摘要:', summary);

    // 确保摘要不为空（说明 AI 能理解页面）
    assert.ok(summary && String(summary).length > 0, 'AI 应能描述页面内容');
  });

  // ─── 用例 2：设置按钮可访问性 ────────────────────────────────────────
  it('设置入口可见且可点击', async () => {
    await browser.pause(RENDER_SETTLE);
    agent = createMidsceneAgent(browser);

    // 断言：页面上有可识别的设置相关元素
    const hasSettings = await agent.aiBoolean(
      '页面上是否有"设置"、"Settings"按钮或齿轮图标？',
    );
    assert.ok(hasSettings, '应存在设置入口');
  });

  // ─── 用例 3：空状态 UI 引导 ──────────────────────────────────────────
  it('未打开文件时显示引导提示或空状态', async () => {
    await browser.pause(RENDER_SETTLE);
    agent = createMidsceneAgent(browser);

    // 断言：没有错误弹窗或崩溃提示
    const hasErrorDialog = await agent.aiBoolean(
      '页面是否出现了错误提示、崩溃信息或异常弹窗？',
    );
    assert.equal(hasErrorDialog, false, '启动后不应出现错误弹窗');

    // 查询：确认空状态或欢迎内容
    const isEmptyOrWelcome = await agent.aiBoolean(
      '页面是否处于空白状态、欢迎页或等待打开文件的状态？',
    );
    assert.ok(isEmptyOrWelcome, '未打开文件时应显示空状态或欢迎引导');
  });

  // ─── 用例 4：菜单栏操作 ──────────────────────────────────────────────
  it('点击设置按钮后弹出设置面板', async () => {
    await browser.pause(RENDER_SETTLE);
    agent = createMidsceneAgent(browser, { generateReport: true });

    // 先确认有设置入口
    const hasEntry = await agent.aiBoolean('页面上有设置按钮或设置图标');
    if (!hasEntry) {
      console.warn('[AI] 未找到设置入口，跳过该用例');
      return;
    }

    // 点击设置
    await agent.aiTap('设置按钮或设置图标');
    await browser.pause(1000);

    // 断言：设置面板已打开
    await agent.aiAssert('页面出现了设置面板、设置弹窗或设置抽屉');

    // 关闭面板（按 Escape）
    await browser.keys(['Escape']);
    await browser.pause(500);
  });
});
