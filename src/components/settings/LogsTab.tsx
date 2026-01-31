import { useEffect, useState } from 'react';
import { Card, Form, Select, InputNumber, Button, message } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { configCommands } from '../../services/commands';
import { createModuleLogger } from '../../utils/logger';
import { CSS_COLORS } from '../../hooks/useCssColors';

const log = createModuleLogger('LogsTab');

interface LogsTabProps {}

export function LogsTab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    configCommands
      .get()
      .then((config) => {
        form.setFieldsValue({
          log_level: config.log_level || 'info',
          log_retention_days: config.log_retention_days ?? 7,
          log_max_size: config.log_max_size ?? 128,
          log_max_count: config.log_max_count ?? 8,
        });
        log.debug('日志配置已加载', config);
      })
      .catch((err) => {
        log.error('加载日志配置失败:', err);
        form.setFieldsValue({
          log_level: 'info',
          log_retention_days: 7,
          log_max_size: 128,
          log_max_count: 8,
        });
      });
  }, [form]);

  async function handleSave(values: any) {
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
  }

  return (
    <Card
      title={
        <span>
          <InfoCircleOutlined /> 日志设置
        </span>
      }
      size="small"
    >
      <p style={{ marginBottom: 'var(--space-4)', color: CSS_COLORS.textSecondary, fontSize: 'var(--font-size-base)' }}>
        配置应用日志的输出级别、保留时间、文件大小和数量。建议在开发和调试时使用
        DEBUG级别，生产环境使用 INFO 级别。
      </p>

      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item label="日志级别" name="log_level" tooltip="DEBUG 最详细，ERROR 最简洁">
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
          <Button type="primary" htmlType="submit" loading={loading}>
            保存设置
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

export default LogsTab;
