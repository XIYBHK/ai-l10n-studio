/**
 * 统一格式化工具
 *
 * 所有数据展示格式化逻辑集中在此，确保全局一致性
 */

/**
 * 汇率配置（USD to CNY）
 * TODO: 后续可以从配置文件或 API 获取实时汇率
 */
const USD_TO_CNY = 7.2; // 1 USD = 7.2 CNY（示例汇率，建议定期更新）

/**
 * 格式化成本显示（USD）
 *
 * @param cost - 成本（美元）
 * @returns 格式化后的字符串
 *
 * 显示规则：
 * - < $1: 美元 + 4位小数（如 $0.0023, $0.0142）
 * - >= $1: 美元 + 2位小数（如 $12.35）
 *
 * @example
 * formatCost(0.0023)  // "$0.0023"
 * formatCost(0.0142)  // "$0.0142"
 * formatCost(1.2345)  // "$1.23"
 */
export function formatCost(cost: number): string {
  if (cost < 1) {
    // 小于 1 美元，显示 4 位小数
    return `$${cost.toFixed(4)}`;
  } else {
    // 大于等于 1 美元，显示 2 位小数
    return `$${cost.toFixed(2)}`;
  }
}

/**
 * 根据语言设置格式化成本显示（多货币支持）
 *
 * @param cost - 成本（美元）
 * @param locale - 语言/地区代码（如 'zh-CN', 'en-US'），可选，后续从应用配置自动获取
 * @returns 格式化后的字符串（根据语言显示对应货币）
 *
 * 显示规则：
 * - 中文（zh-CN, zh-TW, zh-Hans, zh-Hant）→ 人民币（¥）+ 汇率转换
 * - 其他语言 → 美元（$）
 *
 * @example
 * formatCostByLocale(0.0023, 'en-US')  // "$0.0023"
 * formatCostByLocale(0.0023, 'zh-CN')  // "¥0.0166" (0.0023 * 7.2)
 * formatCostByLocale(1.5, 'zh-CN')     // "¥10.80" (1.5 * 7.2)
 */
export function formatCostByLocale(
  cost: number,
  locale?: string // 占位参数，后续从应用配置中自动获取
): string {
  // TODO: 如果未提供 locale，从应用全局配置中获取当前语言设置
  // const currentLocale = locale || getAppLocale();
  const currentLocale = locale || 'en-US'; // 默认英文

  // 判断是否为中文
  const chineseLocales = ['zh', 'zh-CN', 'zh-TW', 'zh-Hans', 'zh-Hant'];
  const isChinese = chineseLocales.some((l) =>
    currentLocale.toLowerCase().startsWith(l.toLowerCase())
  );

  if (isChinese) {
    // 中文 → 人民币（自动汇率转换）
    const cnyAmount = cost * USD_TO_CNY;
    return formatCNY(cnyAmount);
  } else {
    // 其他语言 → 美元
    return formatCost(cost);
  }
}

/**
 * 格式化人民币显示
 *
 * @param amount - 金额（人民币）
 * @returns 格式化后的字符串
 *
 * 显示规则：
 * - < ¥1: 人民币 + 4位小数（如 ¥0.0166）
 * - >= ¥1: 人民币 + 2位小数（如 ¥10.80）
 *
 * @example
 * formatCNY(0.0166)  // "¥0.0166"
 * formatCNY(10.80)   // "¥10.80"
 */
export function formatCNY(amount: number): string {
  if (amount < 1) {
    return `¥${amount.toFixed(4)}`;
  } else {
    return `¥${amount.toFixed(2)}`;
  }
}

/**
 * 格式化 Token 数量
 *
 * @param tokens - Token 数量
 * @returns 格式化后的字符串（带千位分隔符）
 *
 * @example
 * formatTokens(1234567)  // "1,234,567"
 */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * 格式化百分比
 *
 * @param value - 数值（0-1 或 0-100）
 * @param total - 总数（可选，用于计算百分比）
 * @param decimals - 小数位数（默认 1）
 * @returns 格式化后的百分比字符串
 *
 * @example
 * formatPercentage(0.856)        // "85.6%"
 * formatPercentage(42, 100)      // "42.0%"
 * formatPercentage(0.333, null, 2)  // "33.30%"
 */
export function formatPercentage(
  value: number,
  total?: number | null,
  decimals: number = 1
): string {
  let percentage: number;

  if (total !== undefined && total !== null && total > 0) {
    // 如果提供了总数，计算百分比
    percentage = (value / total) * 100;
  } else if (value <= 1) {
    // 如果值在 0-1 之间，认为是比例
    percentage = value * 100;
  } else {
    // 否则认为已经是百分比
    percentage = value;
  }

  return `${percentage.toFixed(decimals)}%`;
}

/**
 * 格式化数量（带单位）
 *
 * @param count - 数量
 * @param unit - 单位（如 "条", "个"）
 * @returns 格式化后的字符串
 *
 * @example
 * formatCount(42, "条")  // "42 条"
 */
export function formatCount(count: number, unit: string = ''): string {
  const formatted = count.toLocaleString();
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * 格式化时间（毫秒 → 可读格式）
 *
 * @param ms - 毫秒数
 * @returns 格式化后的时间字符串
 *
 * @example
 * formatDuration(1234)      // "1.2s"
 * formatDuration(65000)     // "1m 5s"
 * formatDuration(3661000)   // "1h 1m"
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else if (seconds > 0) {
    return `${seconds}s`;
  } else {
    return `${ms}ms`;
  }
}

/**
 * 格式化文件大小
 *
 * @param bytes - 字节数
 * @returns 格式化后的文件大小
 *
 * @example
 * formatFileSize(1024)       // "1.0 KB"
 * formatFileSize(1536000)    // "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * 格式化价格（带货币符号）
 *
 * @param price - 价格
 * @param currency - 货币代码（默认 USD）
 * @param decimals - 小数位数（默认 2）
 * @returns 格式化后的价格字符串
 *
 * @example
 * formatPrice(0.15, 'USD')  // "$0.15"
 * formatPrice(12.50, 'CNY')  // "¥12.50"
 */
export function formatPrice(
  price: number,
  currency: 'USD' | 'CNY' | 'EUR' = 'USD',
  decimals: number = 2
): string {
  const symbols = {
    USD: '$',
    CNY: '¥',
    EUR: '€',
  };

  return `${symbols[currency]}${price.toFixed(decimals)}`;
}

/**
 * 格式化统计数据（综合）
 *
 * 用于统一格式化统计面板中的各种数据
 */
export const formatStats = {
  cost: formatCost,
  costByLocale: formatCostByLocale, // 🆕 多语言货币支持
  tokens: formatTokens,
  percentage: formatPercentage,
  count: formatCount,
  duration: formatDuration,
  fileSize: formatFileSize,
  price: formatPrice,
};

/**
 * 格式化翻译统计摘要
 *
 * @param stats - 翻译统计数据
 * @returns 格式化的摘要对象
 */
export function formatTranslationStatsSummary(stats: {
  total: number;
  tm_hits: number;
  deduplicated: number;
  ai_translated: number;
  token_stats?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost: number;
  };
}) {
  const total = stats.total || 0;
  const tmHits = stats.tm_hits || 0;
  const deduplicated = stats.deduplicated || 0;
  const aiTranslated = stats.ai_translated || 0;
  const tokens = stats.token_stats?.total_tokens || 0;
  const cost = stats.token_stats?.cost || 0;

  return {
    total: formatCount(total, '条'),
    tmHits: {
      count: formatCount(tmHits),
      percentage: formatPercentage(tmHits, total),
    },
    deduplicated: {
      count: formatCount(deduplicated),
      percentage: formatPercentage(deduplicated, total),
    },
    aiTranslated: {
      count: formatCount(aiTranslated),
      percentage: formatPercentage(aiTranslated, total),
    },
    tokens: formatTokens(tokens),
    cost: formatCost(cost),
  };
}
