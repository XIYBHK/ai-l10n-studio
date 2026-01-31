import { useEffect } from 'react';
import { Modal, Button, Alert, Space, Typography } from 'antd';
import { BookOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { TermDifference } from '../types/termLibrary';
import { createModuleLogger } from '../utils/logger';

const { Text, Paragraph } = Typography;
const log = createModuleLogger('TermConfirmModal');

interface TermConfirmModalProps {
  visible: boolean;
  original: string;
  aiTranslation: string;
  userTranslation: string;
  difference: TermDifference;
  onConfirm: (addToLibrary: boolean) => void;
  onCancel: () => void;
}

export function TermConfirmModal({
  visible,
  original,
  aiTranslation,
  userTranslation,
  difference,
  onConfirm,
  onCancel,
}: TermConfirmModalProps) {
  useEffect(() => {
    log.debug('TermConfirmModal 渲染', {
      visible,
      hasOriginal: !!original,
      hasAiTranslation: !!aiTranslation,
      hasUserTranslation: !!userTranslation,
      hasDifference: !!difference,
      differenceType: difference?.type,
      differenceConfidence: difference?.confidence,
    });
  }, [visible, original, aiTranslation, userTranslation, difference]);

  if (!difference) {
    log.error('TermConfirmModal: difference 为空');
    return null;
  }

  function getDifferenceDescription() {
    switch (difference.type) {
      case 'exact_match':
        return {
          title: '检测到翻译修改',
          description: '您的译文与AI翻译差异较大，可以作为精确匹配加入术语库。',
          color: 'info' as const,
        };
      case 'term_replacement':
        return {
          title: '发现术语偏好',
          description: `检测到术语偏好：${difference.ai_term} → ${difference.user_term}`,
          color: 'success' as const,
        };
      case 'style_refinement':
        return {
          title: '检测到风格调整',
          description: '这似乎是一个风格上的微调，建议累积更多示例后再加入术语库。',
          color: 'warning' as const,
        };
      default:
        return {
          title: '检测到修改',
          description: '您修改了翻译，是否要记住这个偏好？',
          color: 'info' as const,
        };
    }
  }

  const diffInfo = getDifferenceDescription();
  const shouldRecommendAdding = difference.confidence > 0.6;

  return (
    <Modal
      title={
        <Space>
          <BookOutlined />
          <span>{diffInfo.title}</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      destroyOnClose
      mask={false}
      footer={[
        <Button key="cancel" onClick={() => onConfirm(false)}>
          仅此一次
        </Button>,
        <Button
          key="add"
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => onConfirm(true)}
        >
          加入术语库
        </Button>,
      ]}
      width={500}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert message={diffInfo.description} type={diffInfo.color} showIcon />

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            原文：
          </Text>
          <Paragraph
            style={{
              marginTop: 4,
              marginBottom: 8,
              padding: '8px 12px',
              background: '#e6f4ff',
              border: '1px solid #91caff',
              borderRadius: 4,
              color: '#000',
            }}
          >
            {original}
          </Paragraph>

          <Text type="secondary" style={{ fontSize: 12 }}>
            AI译文：
          </Text>
          <Paragraph
            delete
            style={{
              marginTop: 4,
              marginBottom: 8,
              padding: '8px 12px',
              background: '#fff1f0',
              borderRadius: 4,
              color: '#cf1322',
            }}
          >
            {aiTranslation}
          </Paragraph>

          <Text type="secondary" style={{ fontSize: 12 }}>
            您的译文：
          </Text>
          <Paragraph
            style={{
              marginTop: 4,
              marginBottom: 8,
              padding: '8px 12px',
              background: '#f6ffed',
              borderRadius: 4,
              color: '#52c41a',
              fontWeight: 500,
            }}
          >
            {userTranslation}
          </Paragraph>
        </div>

        {difference.type === 'term_replacement' && difference.ai_term && difference.user_term && (
          <Alert
            message="术语对比"
            description={
              <div style={{ fontSize: 13 }}>
                <div>
                  AI译法：<Text code>{difference.ai_term}</Text>
                </div>
                <div>
                  您的译法：
                  <Text code type="success">
                    {difference.user_term}
                  </Text>
                </div>
              </div>
            }
            type="info"
            showIcon
          />
        )}

        {!shouldRecommendAdding && (
          <Alert
            message="提示"
            description="此修改的置信度较低，可能不适合加入术语库。您可以选择仅应用此次修改。"
            type="warning"
            showIcon
            closable
          />
        )}

        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 8 }}>
          加入术语库后，相同原文将优先使用您的译法
        </div>
      </Space>
    </Modal>
  );
}
