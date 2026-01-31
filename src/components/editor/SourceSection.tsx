import React, { CSSProperties } from 'react';
import { GlobalOutlined } from '@ant-design/icons';
import { CSS_COLORS } from '../hooks/useCssColors';
import { SectionHeader } from './ui/SectionHeader';
import { POEntry } from '../types/tauri';

interface SourceSectionProps {
  entry: POEntry;
  onCopyOriginal: () => void;
}

/**
 * 源码展示区域组件
 */
export const SourceSection: React.FC<SourceSectionProps> = ({
  entry,
  onCopyOriginal,
}) => {
  const hasContext = entry.msgctxt || (entry.comments && entry.comments.length > 0);

  const containerStyles: CSSProperties = {
    flex: '0 0 40%',
    borderBottom: `2px solid ${CSS_COLORS.borderPrimary}`,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: CSS_COLORS.bgPrimary,
  };

  const contentStyles: CSSProperties = {
    flex: 1,
    padding: 'var(--space-4)',
    overflowY: 'auto',
    backgroundColor: CSS_COLORS.bgSecondary,
    borderRadius: 'var(--radius-md)',
    margin: 'var(--space-4)',
    marginTop: 0,
    boxShadow: 'var(--shadow-sm)',
  };

  const sourceTextStyles: CSSProperties = {
    fontSize: 'var(--font-size-md)',
    lineHeight: 1.6,
    color: CSS_COLORS.textPrimary,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'var(--mono-font)',
  };

  const emptyTextStyles: CSSProperties = {
    color: CSS_COLORS.textDisabled,
    fontStyle: 'italic',
  };

  return (
    <div style={containerStyles} role="region" aria-label="原文区域">
      <SectionHeader
        title="原文 (Source)"
        icon={<GlobalOutlined aria-hidden="true" />}
        bordered={false}
        style={{
          padding: 'var(--space-3) var(--space-4)',
          marginBottom: 0,
          backgroundColor: CSS_COLORS.bgTertiary,
          borderBottom: `1px solid ${CSS_COLORS.borderSecondary}`,
        }}
      />
      <div style={contentStyles}>
        <div 
          style={sourceTextStyles} 
          role="textbox" 
          aria-label="原文内容" 
          aria-readonly="true"
          tabIndex={0}
        >
          {entry.msgid ? (
            entry.msgid
          ) : (
            <span style={emptyTextStyles}>(空)</span>
          )}
        </div>

        {/* 上下文和注释 */}
        {hasContext && (
          <ContextInfo msgctxt={entry.msgctxt} comments={entry.comments} />
        )}
      </div>
    </div>
  );
};

interface ContextInfoProps {
  msgctxt?: string;
  comments?: string[];
}

/**
 * 上下文信息展示组件
 */
export const ContextInfo: React.FC<ContextInfoProps> = ({ msgctxt, comments }) => {
  const containerStyles: CSSProperties = {
    marginTop: 'var(--space-5)',
    padding: 'var(--space-3)',
    backgroundColor: CSS_COLORS.bgTertiary,
    borderRadius: 'var(--radius-base)',
    border: `1px solid ${CSS_COLORS.borderSecondary}`,
  };

  const itemStyles: CSSProperties = {
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
    fontFamily: 'var(--body-font)',
  };

  const labelStyles: CSSProperties = {
    fontWeight: 'var(--font-weight-semibold)',
    marginBottom: 'var(--space-1)',
    color: CSS_COLORS.textPrimary,
    fontSize: 'var(--font-size-xs)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const valueStyles: CSSProperties = {
    fontFamily: 'var(--mono-font)',
    backgroundColor: CSS_COLORS.bgPrimary,
    padding: 'var(--space-1) var(--space-2)',
    borderRadius: 'var(--radius-sm)',
    display: 'inline-block',
    fontSize: 'var(--font-size-sm)',
    color: CSS_COLORS.textSecondary,
    border: `1px solid ${CSS_COLORS.borderSecondary}`,
  };

  const commentStyles: CSSProperties = {
    color: CSS_COLORS.textTertiary,
    fontSize: 'var(--font-size-xs)',
    marginTop: 'var(--space-1)',
    paddingLeft: 'var(--space-2)',
    borderLeft: `2px solid ${CSS_COLORS.borderSecondary}`,
  };

  return (
    <div style={containerStyles} role="complementary" aria-label="上下文和注释">
      {msgctxt && (
        <div style={{ ...itemStyles, marginBottom: comments?.length ? 'var(--space-3)' : 0 }}>
          <div style={labelStyles} id="context-label">上下文 (Context)</div>
          <div style={valueStyles} aria-labelledby="context-label">{msgctxt}</div>
        </div>
      )}
      {comments && comments.length > 0 && (
        <div style={itemStyles}>
          <div style={labelStyles} id="comments-label">注释 (Comments)</div>
          <div role="list" aria-labelledby="comments-label">
            {comments.map((comment, index) => (
              <div key={index} style={commentStyles} role="listitem">
                {comment}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
