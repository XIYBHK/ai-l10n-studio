import { Card, Form, Select, Row, Col } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';
import { useLanguage, useSetLanguageAction } from '../../store';
import type { Language } from '../../store/useAppStore';
import { ThemeModeSwitch } from '../ThemeModeSwitch';
import { useTranslation } from 'react-i18next';

const languageOptions: Array<{ value: Language; label: string }> = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
];

export function AppearanceTab() {
  const { t } = useTranslation();
  const language = useLanguage();
  const setLanguage = useSetLanguageAction();
  const [form] = Form.useForm();

  const handleLanguageChange = (value: Language) => {
    setLanguage(value);
  };

  return (
    <Card
      title={
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
          }}
        >
          <BgColorsOutlined /> {t('settings.appearance.title')}
        </span>
      }
      size="small"
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label={t('settings.appearance.language')} style={{ marginBottom: 0 }}>
              <Select value={language} onChange={handleLanguageChange} style={{ minWidth: 0 }}>
                {languageOptions.map((option) => (
                  <Select.Option key={option.value} value={option.value}>
                    {option.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label={t('settings.appearance.theme')} style={{ marginBottom: 0 }}>
              <div
                style={{
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                }}
              >
                <ThemeModeSwitch />
              </div>
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
}

export default AppearanceTab;
