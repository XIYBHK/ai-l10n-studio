// ========== Phase 1: AI 供应商配置类型 ==========

/**
 * AI 供应商类型
 */
export enum ProviderType {
  Moonshot = 'Moonshot',
  OpenAI = 'OpenAI',
  SparkDesk = 'SparkDesk',   // 讯飞星火
  Wenxin = 'Wenxin',         // 百度文心一言
  Qianwen = 'Qianwen',       // 阿里通义千问
  GLM = 'GLM',               // 智谱AI
  Claude = 'Claude',         // Anthropic
  Gemini = 'Gemini',         // Google
}

/**
 * 供应商显示信息
 */
export interface ProviderInfo {
  type: ProviderType;
  displayName: string;
  defaultUrl: string;
  defaultModel: string;
  icon?: string;
}

/**
 * 代理配置
 */
export interface ProxyConfig {
  host: string;
  port: number;
  enabled: boolean;
}

/**
 * AI 配置
 */
export interface AIConfig {
  provider: ProviderType;
  apiKey: string;
  baseUrl?: string;    // 可选的自定义URL
  model?: string;      // 可选的自定义模型
  proxy?: ProxyConfig;
}

/**
 * 供应商信息映射
 */
export const PROVIDER_INFO_MAP: Record<ProviderType, Omit<ProviderInfo, 'type'>> = {
  [ProviderType.Moonshot]: {
    displayName: 'Moonshot AI',
    defaultUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-auto',
  },
  [ProviderType.OpenAI]: {
    displayName: 'OpenAI',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-3.5-turbo',
  },
  [ProviderType.SparkDesk]: {
    displayName: '讯飞星火',
    defaultUrl: 'https://spark-api.xf-yun.com/v1',
    defaultModel: 'generalv3.5',
  },
  [ProviderType.Wenxin]: {
    displayName: '百度文心一言',
    defaultUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
    defaultModel: 'ernie-bot-turbo',
  },
  [ProviderType.Qianwen]: {
    displayName: '阿里通义千问',
    defaultUrl: 'https://dashscope.aliyuncs.com/api/v1',
    defaultModel: 'qwen-turbo',
  },
  [ProviderType.GLM]: {
    displayName: '智谱AI (GLM)',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4',
  },
  [ProviderType.Claude]: {
    displayName: 'Claude (Anthropic)',
    defaultUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-haiku-20240307',
  },
  [ProviderType.Gemini]: {
    displayName: 'Google Gemini',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1',
    defaultModel: 'gemini-pro',
  },
};

/**
 * 获取供应商信息
 */
export function getProviderInfo(type: ProviderType): ProviderInfo {
  return {
    type,
    ...PROVIDER_INFO_MAP[type],
  };
}

/**
 * 获取所有供应商
 */
export function getAllProviders(): ProviderInfo[] {
  return Object.values(ProviderType).map(type => getProviderInfo(type));
}

/**
 * AI 连接测试结果
 */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  response_time_ms?: number;
}

