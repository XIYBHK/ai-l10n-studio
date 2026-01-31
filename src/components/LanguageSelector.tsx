import { Select } from 'antd';
import type { CSSProperties } from 'react';
import type { LanguageInfo } from '../types/generated/LanguageInfo';
import { createModuleLogger } from '../utils/logger';
import { useSupportedLanguages } from '../hooks/useLanguage';

const log = createModuleLogger('LanguageSelector');

export interface LanguageSelectorProps {
  value?: string;
  onChange?: (langCode: string, langInfo: LanguageInfo | undefined) => void;
  placeholder?: string;
  style?: CSSProperties;
  disabled?: boolean;
}

export function LanguageSelector({
  value,
  onChange,
  placeholder = '选择语言',
  style,
  disabled = false,
}: LanguageSelectorProps) {
  const { languages, isLoading } = useSupportedLanguages();

  function handleChange(langCode: string): void {
    const langInfo = languages.find((lang) => lang.code === langCode);
    onChange?.(langCode, langInfo);
    log.info('选择语言', { code: langCode, name: langInfo?.display_name });
  }

  return (
    <Select
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      style={{ minWidth: 150, ...style }}
      loading={isLoading}
      disabled={disabled}
      showSearch
      optionFilterProp="children"
      filterOption={(input, option) =>
        (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
      }
    >
      {languages.map((lang) => (
        <Select.Option key={lang.code} value={lang.code}>
          {lang.display_name} ({lang.english_name})
        </Select.Option>
      ))}
    </Select>
  );
}
