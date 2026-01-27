import { TermDifference } from '../types/termLibrary';

export function analyzeTranslationDifference(
  original: string,
  aiTranslation: string,
  userTranslation: string
): TermDifference {
  if (aiTranslation === userTranslation) {
    return {
      type: 'unknown',
      confidence: 0,
    };
  }

  const similarity = calculateSimilarity(aiTranslation, userTranslation);
  if (similarity < 0.3) {
    return {
      type: 'exact_match',
      confidence: 1.0,
    };
  }

  const termDiff = extractTermDifference(aiTranslation, userTranslation);
  if (termDiff) {
    return {
      type: 'term_replacement',
      source_term: original,
      ai_term: termDiff.ai,
      user_term: termDiff.user,
      confidence: 0.8,
    };
  }

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

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

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

function extractTermDifference(
  aiTranslation: string,
  userTranslation: string
): { ai: string; user: string } | null {
  const aiWords = tokenize(aiTranslation);
  const userWords = tokenize(userTranslation);

  if (
    Math.abs(aiWords.length - userWords.length) > 1 ||
    aiWords.length <= 1 ||
    userWords.length <= 1
  ) {
    return {
      ai: aiTranslation,
      user: userTranslation,
    };
  }

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

function tokenize(text: string): string[] {
  return text
    .replace(/[，。！？；：""''（）【】《》]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

export function isWorthAdding(difference: TermDifference, originalLength: number): boolean {
  if (originalLength > 100) {
    return false;
  }

  if (difference.type === 'exact_match' || difference.type === 'term_replacement') {
    return difference.confidence > 0.5;
  }

  return false;
}
