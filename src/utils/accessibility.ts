/**
 * 无障碍支持工具函数
 * 提供屏幕阅读器通知、焦点管理等辅助功能
 */

/**
 * 向屏幕阅读器发送通知（使用 aria-live 区域）
 * @param message 要播报的消息
 * @param priority 优先级：'polite' 等待当前朗读完成，'assertive' 立即打断
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  // 查找或创建 aria-live 区域
  let liveRegion = document.getElementById(`a11y-live-region-${priority}`);
  
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = `a11y-live-region-${priority}`;
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    document.body.appendChild(liveRegion);
  }

  // 清空后设置新内容，触发屏幕阅读器播报
  liveRegion.textContent = '';
  
  // 使用 setTimeout 确保 DOM 更新
  setTimeout(() => {
    liveRegion!.textContent = message;
  }, 100);
}

/**
 * 获取批量操作的 aria-label
 * @param action 操作类型
 * @param count 选中条目数
 * @returns 格式化的 aria-label
 */
export function getBatchActionAriaLabel(action: 'translate' | 'confirm' | 'refine', count: number): string {
  const actionLabels = {
    translate: '翻译',
    confirm: '确认',
    refine: '精翻',
  };
  return `${actionLabels[action]}选中条目 (${count}项)`;
}

/**
 * 获取导航按钮的 aria-label
 * @param direction 导航方向
 * @param hasMore 是否还有更多
 * @returns 格式化的 aria-label
 */
export function getNavButtonAriaLabel(direction: 'prev' | 'next', hasMore: boolean): string {
  const directionLabels = {
    prev: '上一项',
    next: '下一项',
  };
  return hasMore ? directionLabels[direction] : `没有${directionLabels[direction]}了`;
}

/**
 * 获取列表项的状态描述
 * @param status 条目状态
 * @param index 索引
 * @param isSelected 是否选中
 * @returns 状态描述文本
 */
export function getEntryStatusDescription(
  status: 'untranslated' | 'needs-review' | 'translated' | 'empty',
  index: number,
  isSelected: boolean
): string {
  const statusLabels = {
    untranslated: '未翻译',
    'needs-review': '待确认',
    translated: '已翻译',
    empty: '空条目',
  };
  
  const parts = [`第 ${index + 1} 条`, statusLabels[status]];
  if (isSelected) {
    parts.push('已选中');
  }
  
  return parts.join('，');
}

/**
 * 创建跳转到主要内容链接
 * @param targetId 目标元素ID
 * @returns 配置对象
 */
export function createSkipToContentLink(targetId: string) {
  return {
    id: 'skip-to-content',
    href: `#${targetId}`,
    text: '跳转到主要内容',
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      const target = document.getElementById(targetId);
      if (target) {
        target.focus();
        target.setAttribute('tabIndex', '-1');
      }
    },
  };
}

/**
 * 管理焦点锁定的工具（用于模态框）
 */
export class FocusTrap {
  private container: HTMLElement | null = null;
  private previouslyFocused: Element | null = null;
  private focusableSelectors = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]',
  ].join(', ');

  /**
   * 激活焦点锁定
   * @param container 焦点锁定的容器元素
   */
  activate(container: HTMLElement) {
    this.container = container;
    this.previouslyFocused = document.activeElement;
    
    // 将焦点设置到容器内的第一个可聚焦元素
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    }

    // 监听键盘事件以捕获 Tab 键
    container.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * 停用焦点锁定
   */
  deactivate() {
    if (this.container) {
      this.container.removeEventListener('keydown', this.handleKeyDown);
    }
    
    // 恢复之前的焦点
    if (this.previouslyFocused && this.previouslyFocused instanceof HTMLElement) {
      this.previouslyFocused.focus();
    }
    
    this.container = null;
    this.previouslyFocused = null;
  }

  /**
   * 获取容器内所有可聚焦元素
   */
  private getFocusableElements(): HTMLElement[] {
    if (!this.container) return [];
    return Array.from(this.container.querySelectorAll(this.focusableSelectors));
  }

  /**
   * 处理键盘事件
   */
  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
}

/**
 * 通用的 ARIA 属性类型
 */
export interface A11yProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-controls'?: string;
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  'aria-pressed'?: boolean | 'mixed';
  'aria-selected'?: boolean;
  'aria-hidden'?: boolean | 'true' | 'false';
  'aria-live'?: 'off' | 'assertive' | 'polite';
  'aria-atomic'?: boolean | 'true' | 'false';
  'aria-relevant'?: 'additions' | 'removals' | 'text' | 'all';
  'aria-busy'?: boolean | 'true' | 'false';
  role?: React.AriaRole;
  tabIndex?: number;
}
