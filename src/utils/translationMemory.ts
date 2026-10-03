export function canonicalTargetLanguage(language: string): string {
  const normalized = language.trim().replace(/_/g, '-').toLowerCase();
  if (['zh-cn', 'zh-sg', 'zh-hans'].includes(normalized)) return 'zh-Hans';
  if (['zh-tw', 'zh-hk', 'zh-mo', 'zh-hant'].includes(normalized)) return 'zh-Hant';
  return normalized;
}

export function buildMemoryKey(source: string, context: string | null, language: string): string {
  const target = canonicalTargetLanguage(language);
  if (!target) throw new Error('Target language is required');
  return JSON.stringify([source, context, target]);
}

export function parseMemoryKey(key: string) {
  const value: unknown = JSON.parse(key);
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    typeof value[0] !== 'string' ||
    (value[1] !== null && typeof value[1] !== 'string') ||
    typeof value[2] !== 'string' ||
    !value[2] ||
    buildMemoryKey(value[0], value[1], value[2]) !== key
  ) {
    throw new Error('Invalid translation memory key');
  }
  return { source: value[0], context: value[1] as string | null, language: value[2] };
}
