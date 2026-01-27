/**
 * 文件格式相关类型
 */

/**
 * 文件格式枚举
 */
export enum FileFormat {
  PO = 'PO',
  JSON = 'JSON',
  XLIFF = 'XLIFF',
  YAML = 'YAML',
}

/**
 * 文件元数据
 */
export interface FileMetadata {
  format: FileFormat;
  sourceLanguage?: string;
  targetLanguage?: string;
  totalEntries: number;
  filePath?: string;
}

/**
 * 翻译条目（通用格式）
 */
export interface TranslationEntry {
  id: string;
  source: string;
  target: string;
  context?: string;
  location?: string;
  flags?: string[];
}

/**
 * 解析后的文件
 */
export interface ParsedFile {
  metadata: FileMetadata;
  entries: TranslationEntry[];
}

/**
 * 文件格式信息
 */
export interface FileFormatInfo {
  format: FileFormat;
  displayName: string;
  extensions: string[];
  description: string;
}

/**
 * 文件格式信息映射
 */
export const FILE_FORMAT_INFO: Record<FileFormat, Omit<FileFormatInfo, 'format'>> = {
  [FileFormat.PO]: {
    displayName: 'PO (gettext)',
    extensions: ['.po'],
    description: 'gettext 翻译文件',
  },
  [FileFormat.JSON]: {
    displayName: 'JSON',
    extensions: ['.json'],
    description: 'JSON 国际化文件',
  },
  [FileFormat.XLIFF]: {
    displayName: 'XLIFF',
    extensions: ['.xliff', '.xlf'],
    description: 'XML 本地化交换文件格式',
  },
  [FileFormat.YAML]: {
    displayName: 'YAML',
    extensions: ['.yaml', '.yml'],
    description: 'YAML 国际化文件',
  },
};

/**
 * 获取文件格式信息
 */
export function getFileFormatInfo(format: FileFormat): FileFormatInfo {
  return {
    format,
    ...FILE_FORMAT_INFO[format],
  };
}

/**
 * 根据文件扩展名推测格式
 */
export function guessFormatFromExtension(filename: string): FileFormat {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));

  for (const [format, info] of Object.entries(FILE_FORMAT_INFO)) {
    if (info.extensions.includes(ext)) {
      return format as FileFormat;
    }
  }

  return FileFormat.PO;
}
