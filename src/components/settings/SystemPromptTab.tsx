import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Space, message } from 'antd';
import { FileTextOutlined, UndoOutlined } from '@ant-design/icons';
import { systemPromptCommands } from '../../services/commands';
import { useSystemPrompt } from '../../hooks/useConfig';
import { useAsync } from '../../hooks/useAsync';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('SystemPromptTab');

interface SystemPromptTabProps {}

export const SystemPromptTab: React.FC<SystemPromptTabProps> = () => {
  const [form] = Form.useForm();
  const { prompt, mutate } = useSystemPrompt();
  const { execute: savePrompt, loading: saving } = useAsync(systemPromptCommands.set);
  const { execute: resetPrompt, loading: resetting } = useAsync(systemPromptCommands.reset);

  const [promptText, setPromptText] = useState<string>('');
  const [isModified, setIsModified] = useState(false);

  // 同步SWR数据到本地表单状态
  useEffect(() => {
    setPromptText(prompt || '');
    setIsModified(false);
  }, [prompt]);

  const handleSave = async (values: { prompt: string }) => {
    try {
      await savePrompt(values.prompt);
      message.success('系统提示词已保存');
      mutate();
      setIsModified(false);
      log.info('系统提示词已保存', { length: values.prompt.length });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '保存失败';
      message.error(errorMsg);
      log.error('保存系统提示词失败', { error });
    }
  };

  const handleReset = async () => {
    try {
      await resetPrompt();
      message.success('系统提示词已重置为默认值');
      mutate();
      setIsModified(false);
      log.info('系统提示词已重置');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '重置失败';
      message.error(errorMsg);
      log.error('重置系统提示词失败', { error });
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setPromptText(value);
    setIsModified(value !== (prompt || ''));
  };

  return (
    <Card
      title={
        <span>
          <FileTextOutlined /> 系统提示词
        </span>
      }
      size="small"
    >
      <p style={{ marginBottom: 16, color: '#666', fontSize: '13px' }}>
        定义 AI 翻译时的系统行为和风格要求。这些提示词将作为翻译任务的前置上下文，影响所有翻译结果。
      </p>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item
          name="prompt"
          rules={[{ required: true, message: '请输入系统提示词' }]}
        >
          <Input.TextArea
            value={promptText}
            onChange={handlePromptChange}
            placeholder="请输入系统提示词..."
            rows={12}
            style={{ fontFamily: 'monospace', fontSize: '13px' }}
          />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              disabled={!isModified}
            >
              保存
            </Button>
            <Button
              icon={<UndoOutlined />}
              onClick={handleReset}
              loading={resetting}
            >
              重置为默认值
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default SystemPromptTab;
