import { Button, Modal, Space } from 'antd';
import i18n from '../i18n/config';

export function askUnsavedDocument(
  dialog: Pick<typeof Modal, 'confirm'> = Modal
): Promise<'save' | 'discard' | 'cancel'> {
  return new Promise((resolve) => {
    const modal = dialog.confirm({
      title: i18n.t('document.unsavedTitle'),
      content: i18n.t('document.unsavedDescription'),
      closable: false,
      maskClosable: false,
      onCancel: () => resolve('cancel'),
      footer: () => (
        <Space>
          <Button onClick={() => finish('cancel')}>{i18n.t('common.cancel')}</Button>
          <Button danger onClick={() => finish('discard')}>
            {i18n.t('document.discard')}
          </Button>
          <Button type="primary" onClick={() => finish('save')}>
            {i18n.t('menu.save')}
          </Button>
        </Space>
      ),
    });
    function finish(choice: 'save' | 'discard' | 'cancel') {
      modal.destroy();
      resolve(choice);
    }
  });
}

export function askTargetDocument(dialog: Pick<typeof Modal, 'confirm'> = Modal): Promise<boolean> {
  return new Promise((resolve) =>
    dialog.confirm({
      title: i18n.t('document.newLanguageTitle'),
      content: i18n.t('document.newLanguageDescription'),
      okText: i18n.t('document.createTarget'),
      cancelText: i18n.t('common.cancel'),
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    })
  );
}
