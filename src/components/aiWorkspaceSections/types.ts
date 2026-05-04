import type { ReactNode } from 'react';
import type { TranslationStats } from '../../types/tauri';
import type { ModelInfo } from '../../types/generated/ModelInfo';

export interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  icon?: ReactNode;
  color?: string;
  size?: 'normal' | 'large';
}

export interface SessionStatsSectionProps {
  sessionStats: TranslationStats;
  modelInfo: ModelInfo | null;
  language: string;
}

export interface CumulativeStatsSectionProps {
  cumulativeStats: TranslationStats;
  language: string;
  onReset: () => void;
}

export interface TermLibrarySectionProps {
  onManageClick: () => void;
  language: string;
}

export interface CostBreakdownProps {
  cost: number;
  language: string;
}
