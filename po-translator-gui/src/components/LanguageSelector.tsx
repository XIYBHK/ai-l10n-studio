// ========== Phase 5: 语言选择器组件 ==========

import React, { useState, useEffect } from 'react';
import { Select } from 'antd';
import { languageApi, type LanguageInfo } from '../services/api';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('LanguageSelector');

export interface LanguageSelectorProps {
  value?: string;  // 语言代码
  onChange?: (langCode: string, langInfo: LanguageInfo | undefined) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  value,
  onChange,
  placeholder = '选择语言',
  style,
  disabled = false,
}) => {
  const [languages, setLanguages] = useState<LanguageInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLanguages();
  }, []);

  const loadLanguages = async () => {
    try {
      setLoading(true);
      const langs = await languageApi.getSupportedLanguages();
      setLanguages(langs);
      log.info('加载支持的语言列表', { count: langs.length });
    } catch (error) {
      log.logError(error, '加载语言列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (langCode: string) => {
    const langInfo = languages.find(lang => lang.code === langCode);
    onChange?.(langCode, langInfo);
    log.info('选择语言', { code: langCode, name: langInfo?.display_name });
  };

  return (
    <Select
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      style={{ minWidth: 150, ...style }}
      loading={loading}
      disabled={disabled}
      showSearch
      optionFilterProp="children"
      filterOption={(input, option) =>
        (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
      }
    >
      {languages.map(lang => (
        <Select.Option key={lang.code} value={lang.code}>
          {lang.display_name} ({lang.english_name})
        </Select.Option>
      ))}
    </Select>
  );
};

