/**
 * 参数转换工具
 * 
 * 统一处理前端 camelCase 和后端 snake_case 之间的转换
 * 
 * 使用场景：
 * - AI 配置保存：api_key 字段传递
 * - 语言检测：sourceLangCode → source_lang_code
 * - 所有需要跨越前后端边界的参数
 */

/**
 * 将 camelCase 转换为 snake_case
 * 
 * @example
 * toSnakeCase('sourceLangCode') // 'source_lang_code'
 * toSnakeCase('apiKey') // 'api_key'
 */
export function toSnakeCase(camelCase: string): string {
  return camelCase.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * 将 snake_case 转换为 camelCase
 * 
 * @example
 * toCamelCase('source_lang_code') // 'sourceLangCode'
 * toCamelCase('api_key') // 'apiKey'
 * toCamelCase('some__value') // 'someValue' (处理多个下划线)
 */
export function toCamelCase(snakeCase: string): string {
  // 先清理多余的下划线，然后转换
  return snakeCase
    .replace(/_+/g, '_') // 将多个下划线替换为单个下划线
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * 转换对象的键从 camelCase 到 snake_case
 * 
 * @param obj - 要转换的对象
 * @returns 键为 snake_case 的新对象
 * 
 * @example
 * convertKeysToSnakeCase({ apiKey: 'test', sourceLangCode: 'en' })
 * // { api_key: 'test', source_lang_code: 'en' }
 */
export function convertKeysToSnakeCase<T extends Record<string, any>>(
  obj: T
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      // 🔄 递归转换嵌套对象的键
      if (value && typeof value === 'object' && !Array.isArray(value) && value.constructor === Object) {
        result[toSnakeCase(key)] = convertKeysToSnakeCase(value);
      } else {
        result[toSnakeCase(key)] = value;
      }
    }
  }
  return result;
}

/**
 * 转换对象的键从 snake_case 到 camelCase
 * 
 * @param obj - 要转换的对象
 * @returns 键为 camelCase 的新对象
 * 
 * @example
 * convertKeysToCamelCase({ api_key: 'test', source_lang_code: 'en' })
 * // { apiKey: 'test', sourceLangCode: 'en' }
 */
export function convertKeysToCamelCase<T extends Record<string, any>>(
  obj: T
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      // 🔄 递归转换嵌套对象的键
      if (value && typeof value === 'object' && !Array.isArray(value) && value.constructor === Object) {
        result[toCamelCase(key)] = convertKeysToCamelCase(value);
      } else {
        result[toCamelCase(key)] = value;
      }
    }
  }
  return result;
}

