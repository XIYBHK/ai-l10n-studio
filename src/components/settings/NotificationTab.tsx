import { useState, useEffect } from 'react';
import { Alert, App, Card, Form, Switch, Button } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { notificationManager } from '../../utils/notificationManager';
import { createModuleLogger } from '../../utils/logger';
import { CSS_COLORS } from '../../hooks/useCssColors';

const log = createModuleLogger('NotificationTab');

export function NotificationTab() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [notificationEnabled, setNotificationEnabled] = useState(notificationManager.isEnabled());
  const [form] = Form.useForm();
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setReady(false);
    setLoadError(false);
    void notificationManager
      .init()
      .then(() => {
        if (active) {
          setNotificationEnabled(notificationManager.isEnabled());
          setReady(true);
        }
      })
      .catch((error) => {
        log.logError(error, 'Load notification preferences failed');
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  async function handleNotificationToggle(checked: boolean) {
    try {
      await notificationManager.setEnabled(checked);
      message.success(
        t('messages.notificationToggled', {
          status: checked ? t('messages.notificationEnabled') : t('messages.notificationDisabled'),
        })
      );
      setNotificationEnabled(checked);
      log.info('通知设置已更改', { enabled: checked });
    } catch (error) {
      log.error('设置通知失败', { error });
      message.error(t('settings.saveFailed'));
    }
  }

  async function handleRequestPermission() {
    try {
      const granted = await notificationManager.requestPermission();
      if (granted) {
        message.success(t('messages.notificationPermissionGranted'));
        log.info('通知权限已授予');
      } else {
        message.warning(t('messages.notificationPermissionDenied'));
        log.info('通知权限被拒绝');
      }
    } catch (error) {
      log.error('请求通知权限失败', { error });
      message.error(t('notifications.permissionFailed'));
    }
  }

  return (
    <Card
      title={
        <span>
          <BellOutlined /> {t('notifications.title')}
        </span>
      }
      size="small"
    >
      <p
        style={{
          marginBottom: 'var(--space-4)',
          color: CSS_COLORS.textSecondary,
          fontSize: 'var(--font-size-base)',
        }}
      >
        {t('notifications.description')}
      </p>

      {loadError && (
        <Alert
          type="error"
          title={t('notifications.loadFailed')}
          showIcon
          action={
            <Button onClick={() => setAttempt((value) => value + 1)}>{t('common.retry')}</Button>
          }
        />
      )}
      <Form form={form} layout="vertical">
        <Form.Item label={t('notifications.enabled')}>
          <Switch
            checked={notificationEnabled}
            onChange={handleNotificationToggle}
            disabled={!ready}
          />
        </Form.Item>

        <Form.Item>
          <Button onClick={handleRequestPermission}>{t('notifications.permission')}</Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

export default NotificationTab;
