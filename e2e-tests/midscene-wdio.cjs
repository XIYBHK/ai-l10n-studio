/**
 * MidScene × Tauri WebdriverIO 适配器
 *
 * 通过实现 MidScene 的 AbstractInterface，将 WebdriverIO browser 对象
 * 桥接到 MidScene AI 引擎，支持视觉断言、查询和操作。
 *
 * 使用前需配置模型环境变量：
 *   MIDSCENE_MODEL_API_KEY   - API 密钥（OpenAI / DeepSeek / 其他）
 *   MIDSCENE_MODEL_NAME      - 模型名称，默认 gpt-4o
 *   MIDSCENE_MODEL_BASE_URL  - 自定义端点（可选，兼容 OpenAI API 格式）
 *   MIDSCENE_MODEL_FAMILY    - 模型族：openai / anthropic / gemini（可选）
 */

'use strict';

const { Agent } = require('@midscene/core/agent');
const {
  defineActionTap,
  defineActionDoubleClick,
  defineActionInput,
  defineActionKeyboardPress,
  defineActionScroll,
} = require('@midscene/core/device');

/**
 * Tauri WebdriverIO 接口实现
 * 将 WebdriverIO browser 对象适配为 MidScene AbstractInterface
 */
class TauriWdioInterface {
  constructor(browser) {
    this.interfaceType = 'tauri-wdio';
    this._browser = browser;
  }

  /**
   * 截图并返回 base64（MidScene 视觉分析入口）
   */
  async screenshotBase64() {
    const b64 = await this._browser.takeScreenshot();
    return `data:image/png;base64,${b64}`;
  }

  /**
   * 返回窗口尺寸
   */
  async size() {
    const { width, height } = await this._browser.getWindowSize();
    return { width, height, dpr: 1 };
  }

  /**
   * 动作空间：AI 可调用的操作集合
   */
  actionSpace() {
    const browser = this._browser;

    return [
      // 单击
      defineActionTap(async (param) => {
        const [x, y] = param.locate.center;
        await browser
          .action('pointer')
          .move({ x: Math.round(x), y: Math.round(y), duration: 0 })
          .down({ button: 0 })
          .pause(30)
          .up({ button: 0 })
          .perform();
      }),

      // 双击
      defineActionDoubleClick(async (param) => {
        const [x, y] = param.locate.center;
        await browser
          .action('pointer')
          .move({ x: Math.round(x), y: Math.round(y), duration: 0 })
          .down({ button: 0 })
          .pause(30)
          .up({ button: 0 })
          .pause(80)
          .down({ button: 0 })
          .pause(30)
          .up({ button: 0 })
          .perform();
      }),

      // 文字输入（先点击聚焦，再键入）
      defineActionInput(async (param) => {
        const [x, y] = param.locate.center;
        await browser
          .action('pointer')
          .move({ x: Math.round(x), y: Math.round(y), duration: 0 })
          .down({ button: 0 })
          .pause(30)
          .up({ button: 0 })
          .perform();
        await browser.pause(100);
        // 全选清空再输入
        await browser.keys(['Control', 'a']);
        await browser.pause(50);
        await browser.keys(param.value.split(''));
      }),

      // 键盘按键
      defineActionKeyboardPress(async (param) => {
        await browser.keys([param.key]);
      }),

      // 滚动
      defineActionScroll(async (param) => {
        const [x, y] = param.locate.center;
        const deltaY = (param.scrollType === 'down' ? 1 : -1) * (param.distance ?? 300);
        await browser
          .action('wheel')
          .scroll({ x: Math.round(x), y: Math.round(y), deltaX: 0, deltaY })
          .perform();
      }),
    ];
  }

  describe() {
    return 'Tauri Desktop App (WebdriverIO)';
  }

  async destroy() {
    // WebdriverIO session 由外部管理，此处无需关闭
  }
}

/**
 * 创建绑定到当前 WebdriverIO session 的 MidScene Agent
 *
 * @param {object} browser - WebdriverIO browser 全局对象
 * @param {object} [opts]
 * @param {boolean} [opts.generateReport=false] - 是否生成 HTML 可视化报告
 * @param {string}  [opts.reportFileName]       - 报告文件名前缀
 * @returns {import('@midscene/core/agent').Agent}
 */
function createMidsceneAgent(browser, opts = {}) {
  const device = new TauriWdioInterface(browser);
  return new Agent(device, {
    generateReport: opts.generateReport ?? false,
    reportFileName: opts.reportFileName,
    actionContext: '这是一个桌面 PO 文件 AI 翻译工具（Tauri 应用）。',
  });
}

module.exports = { TauriWdioInterface, createMidsceneAgent };
