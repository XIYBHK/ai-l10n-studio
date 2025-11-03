import React, { useState, useEffect } from 'react';
import { Card, Form, Select, InputNumber, Button, message } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { configCommands } from '../../services/commands';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('LogsTab');

interface LogsTabProps {}

export const LogsTab: React.FC<LogsTabProps> = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (true) {
      configCommands
        .get()
        .then((config) => {
          if (config.log_level) {
            form.setFieldValue('log_level', config.log_level);
          }
          if (config.log_retention_days !== undefined) {
            form.setFieldValue('log_retention_days', config.log_retention_days);
          }
          if (config.log_max_size !== undefined) {
            form.setFieldValue('log_max_size', config.log_max_size);
          }
          if (config.log_max_count !== undefined) {
            form.setFieldValue('log_max_count', config.log_max_count);
          }
        })
        .catch((err) => {
          log.error('加载日志配置失败:', err);
        });
    }
  }, []);

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      await configCommands.update({
        log_level: values.log_level,
        log_retention_days: values.log_retention_days,
        log_max_size: values.log_max_size,
        log_max_count: values.log_max_count,
      });
      message.success('日志设置已保存');
      log.info('日志设置已保存', values);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '保存失败';
      message.error(errorMsg);
      log.error('保存日志设置失败', { error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title={
        <span>
          <InfoCircleOutlined /> 日志设置
        </span>
      }
      size="small"
    >
      <p style={{ marginBottom: 16, color: '#666', fontSize: '13px' }}>
        配置应用日志的输出级别、保留时间、文件大小和数量。建议在开发和调试时使用 DEBUG级别，生产环境使用 INFO 级别。
      </p>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item
          label="日志级别"
          name="log_level"
          tooltip="DEBUG 最详细，ERROR 最简洁"
        >
          <Select>
            <Select.Option value="debug">DEBUG - 调试信息</Select.Option>
            <Select.Option value="info">INFO - 一般信息</Select.Option>
            <Select.Option value="warn">WARN - 警告信息</Select.Option>
            <Select.Option value="error">ERROR - 错误信息</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="日志保留天数"
          name="log_retention_days"
          tooltip="日志文件保留的天数，超期自动删除"
        >
          <InputNumber min={1} max={365} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="单个日志文件最大大小 (KB)"
          name="log_max_size"
          tooltip="单个日志文件的最大大小，超过后自动创建新文件"
        >
          <InputNumber min={64} max={1024} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="日志文件最大数量"
          name="log_max_count"
          tooltip="最多保留的日志文件数量，超期自动删除最旧的文件"
        >
          <InputNumber min={1} max={50} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
          >
            保存设置
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default LogsTab;
