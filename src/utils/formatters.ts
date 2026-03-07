export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

const USD_TO_CNY = 7.2;

function resolveLocale(locale?: string): string {
  if (locale) {
    return locale;
  }

  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }

  return 'en-US';
}

function isChineseLocale(locale: string): boolean {
  const normalized = locale.toLowerCase();
  return ['zh', 'zh-cn', 'zh-tw', 'zh-hans', 'zh-hant'].some((value) =>
    normalized.startsWith(value)
  );
}

export function formatCost(cost: number, locale?: string): string {
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cost < 1 ? 4 : 2,
    maximumFractionDigits: cost < 1 ? 4 : 2,
  }).format(cost);
}

export function formatCNY(amount: number, locale?: string): string {
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: amount < 1 ? 4 : 2,
    maximumFractionDigits: amount < 1 ? 4 : 2,
  }).format(amount);
}

export function formatCostByLocale(cost: number, locale?: string): string {
  const currentLocale = resolveLocale(locale);

  if (isChineseLocale(currentLocale)) {
    return formatCNY(cost * USD_TO_CNY, currentLocale);
  }

  return formatCost(cost, currentLocale);
}

export function formatTokens(tokens: number, locale?: string): string {
  return new Intl.NumberFormat(resolveLocale(locale)).format(tokens);
}

export function formatPercentage(
  value: number,
  total?: number | null,
  decimals: number = 1,
  locale?: string
): string {
  let percentage: number;

  if (total !== undefined && total !== null && total > 0) {
    percentage = (value / total) * 100;
  } else if (value <= 1) {
    percentage = value * 100;
  } else {
    percentage = value;
  }

  return new Intl.NumberFormat(resolveLocale(locale), {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(percentage / 100);
}

export function formatCount(count: number, unit: string = '', locale?: string): string {
  const formatted = new Intl.NumberFormat(resolveLocale(locale)).format(count);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  if (seconds > 0) {
    return `${seconds}s`;
  }
  return `${ms}ms`;
}

export function formatFileSize(bytes: number, locale?: string): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  const formatted = new Intl.NumberFormat(resolveLocale(locale), {
    minimumFractionDigits: unitIndex === 0 ? 0 : 1,
    maximumFractionDigits: unitIndex === 0 ? 0 : 1,
  }).format(size);

  return `${formatted} ${units[unitIndex]}`;
}

export function formatPrice(
  price: number,
  currency: 'USD' | 'CNY' | 'EUR' = 'USD',
  decimals: number = 2,
  locale?: string
): string {
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

export function formatDateTime(input: string | number | Date, locale?: string): string {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(input));
}

export function formatTime(input: string | number | Date = Date.now(), locale?: string): string {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    timeStyle: 'medium',
  }).format(new Date(input));
}

export const formatStats = {
  cost: formatCost,
  costByLocale: formatCostByLocale,
  tokens: formatTokens,
  percentage: formatPercentage,
  count: formatCount,
  duration: formatDuration,
  fileSize: formatFileSize,
  price: formatPrice,
  dateTime: formatDateTime,
  time: formatTime,
};

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
}, locale?: string) {
  const total = stats.total || 0;
  const tmHits = stats.tm_hits || 0;
  const deduplicated = stats.deduplicated || 0;
  const aiTranslated = stats.ai_translated || 0;
  const tokens = stats.token_stats?.total_tokens || 0;
  const cost = stats.token_stats?.cost || 0;

  return {
    total: formatCount(total, '条', locale),
    tmHits: {
      count: formatCount(tmHits, '', locale),
      percentage: formatPercentage(tmHits, total, 1, locale),
    },
    deduplicated: {
      count: formatCount(deduplicated, '', locale),
      percentage: formatPercentage(deduplicated, total, 1, locale),
    },
    aiTranslated: {
      count: formatCount(aiTranslated, '', locale),
      percentage: formatPercentage(aiTranslated, total, 1, locale),
    },
    tokens: formatTokens(tokens, locale),
    cost: formatCostByLocale(cost, locale),
  };
}
