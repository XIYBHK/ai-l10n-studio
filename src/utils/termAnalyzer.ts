import { TermDifference } from '../types/termLibrary';

/**
 * 分析AI译文和用户译文的差异
 */
export function analyzeTranslationDifference(
  original: string,
  aiTranslation: string,
  userTranslation: string
): TermDifference {
  // 完全相同，无需处理
  if (aiTranslation === userTranslation) {
    return {
      type: 'unknown',
      confidence: 0,
    };
  }

  // 1. 检查是否为完全不同的翻译（精确匹配场景）
  const similarity = calculateSimilarity(aiTranslation, userTranslation);
  if (similarity < 0.3) {
    return {
      type: 'exact_match',
      confidence: 1.0,
    };
  }

  // 2. 尝试提取术语级别的差异
  const termDiff = extractTermDifference(aiTranslation, userTranslation);
  if (termDiff) {
    return {
      type: 'term_replacement',
      source_term: original, // 使用原文作为source_term
      ai_term: termDiff.ai,
      user_term: termDiff.user,
      confidence: 0.8,
    };
  }

  // 3. 风格调整
  if (similarity > 0.6) {
    return {
      type: 'style_refinement',
      confidence: 0.6,
    };
  }

  return {
    type: 'unknown',
    confidence: 0.3,
  };
}

/**
 * 计算两个字符串的相似度（简单版）
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * 计算编辑距离
 */
function getEditDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * 提取术语差异（简单分词对比）
 */
function extractTermDifference(
  aiTranslation: string,
  userTranslation: string
): { ai: string; user: string } | null {
  // 简单的空格分词（后续可优化为更智能的中文分词）
  const aiWords = tokenize(aiTranslation);
  const userWords = tokenize(userTranslation);

  // 如果分词数量差异太大，直接返回完整译文对比
  if (
    Math.abs(aiWords.length - userWords.length) > 1 ||
    aiWords.length <= 1 ||
    userWords.length <= 1
  ) {
    // 返回完整译文作为对比
    return {
      ai: aiTranslation,
      user: userTranslation,
    };
  }

  // 找出第一个不同的词
  for (let i = 0; i < Math.max(aiWords.length, userWords.length); i++) {
    if (aiWords[i] !== userWords[i]) {
      return {
        ai: aiWords[i] || '',
        user: userWords[i] || '',
      };
    }
  }

  return null;
}

/**
 * 简单分词（支持中英文）
 */
function tokenize(text: string): string[] {
  // 移除标点符号，按空格和中文字符分割
  return text
    .replace(/[，。！？；：""''（）【】《》]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * 判断是否值得加入术语库
 */
export function isWorthAdding(difference: TermDifference, originalLength: number): boolean {
  // 1. 原文太长（>100字符），不适合精确匹配
  if (originalLength > 100) {
    return false;
  }

  // 2. 类型为精确匹配或术语替换
  if (difference.type === 'exact_match' || difference.type === 'term_replacement') {
    return difference.confidence > 0.5;
  }

  return false;
}
