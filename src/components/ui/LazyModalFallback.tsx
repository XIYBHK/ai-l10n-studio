import { Modal, Spin } from 'antd';
import { useTranslation } from 'react-i18next';

export function LazyModalFallback({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal open title={t('common.loading')} footer={null} onCancel={onClose}>
      <div role="status" style={{ textAlign: 'center', padding: 'var(--space-5)' }}>
        <Spin />
      </div>
    </Modal>
  );
}
