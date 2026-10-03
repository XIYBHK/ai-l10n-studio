export type { TermEntry } from './generated/TermEntry';
export type { StyleSummary } from './generated/StyleSummary';
export type { TermLibrary } from './generated/TermLibrary';
export type { TermLibraryMetadata } from './generated/TermLibraryMetadata';

export interface TermDifference {
  type: 'exact_match' | 'term_replacement' | 'style_refinement' | 'unknown';
  source_term?: string;
  ai_term?: string;
  user_term?: string;
  confidence: number;
}
