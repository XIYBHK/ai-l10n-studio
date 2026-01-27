import { useState } from 'react';
import { Card, Form, Switch, Button, message } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { notificationManager } from '../../utils/notificationManager';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('NotificationTab');

interface NotificationTabProps {}

export function NotificationTab() {
  const [notificationEnabled, setNotificationEnabled] = useState(notificationManager.isEnabled());
  const [form] = Form.useForm();

  function handleNotificationToggle(checked: boolean) {
    try {
      notificationManager.setEnabled(checked);
      message.success(`通知已${checked ? '启用' : '禁用'}`);
      setNotificationEnabled(checked);
      log.info('通知设置已更改', { enabled: checked });
    } catch (error) {
      log.error('设置通知失败', { error });
    }
  }

  async function handleRequestPermission() {
    try {
      const granted = await notificationManager.requestPermission();
      if (granted) {
        message.success('通知权限已授予');
        log.info('通知权限已授予');
      } else {
        message.warning('通知权限被拒绝');
        log.info('通知权限被拒绝');
      }
    } catch (error) {
      log.error('请求通知权限失败', { error });
    }
  }

  return (
    <Card
      title={
        <span>
          <BellOutlined /> 通知设置
        </span>
      }
      size="small"
    >
      <p style={{ marginBottom: 16, color: '#666', fontSize: '13px' }}>
        配置翻译完成、系统更新等事件的通知提醒。
      </p>

      <Form form={form} layout="vertical">
        <Form.Item label="启用通知">
          <Switch checked={notificationEnabled} onChange={handleNotificationToggle} />
        </Form.Item>

        <Form.Item>
          <Button onClick={handleRequestPermission}>请求通知权限</Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

export default NotificationTab;
