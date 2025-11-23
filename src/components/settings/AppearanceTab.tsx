import React from 'react';
import { Card, Form, Select, Row, Col } from 'antd';
import { BgColorsOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';
import { ThemeModeSwitch } from '../ThemeModeSwitch';

interface AppearanceTabProps {}

export const AppearanceTab: React.FC<AppearanceTabProps> = () => {
  const { language, setLanguage } = useAppStore();
  const [form] = Form.useForm();

  const handleLanguageChange = (value: string) => {
    setLanguage(value as any);
  };

  return (
    <Card
      title={
        <span>
          <BgColorsOutlined /> 外观设置
        </span>
      }
      size="small"
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="应用语言" tooltip="更改界面语言后需要重启应用">
              <Select value={language} onChange={handleLanguageChange}>
                <Select.Option value="zh-CN">简体中文</Select.Option>
                <Select.Option value="en-US">English</Select.Option>
                <Select.Option value="zh-TW">繁體中文</Select.Option>
                <Select.Option value="ja-JP">日本語</Select.Option>
                <Select.Option value="ko-KR">한국어</Select.Option>
              </Select>
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item label="主题模式">
              <ThemeModeSwitch />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

export default AppearanceTab;
