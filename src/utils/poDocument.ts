import type { POEntry, PODocument, TranslationStats } from '../types/tauri';
import type { TranslationInput } from '../types/generated/TranslationInput';
import i18n from '../i18n/config';
import { canonicalTargetLanguage } from './translationMemory';

// GNU gettext plural formulas: https://www.gnu.org/software/gettext/manual/html_node/Plural-forms.html
export function pluralRuleForLanguage(language: string): string {
  const code = canonicalTargetLanguage(language);
  if (/^(zh|ja|ko|th|vi)(-|$)/i.test(code)) return 'nplurals=1; plural=0;';
  if (code === 'fr' || code === 'pt-br') return 'nplurals=2; plural=n>1;';
  if (code === 'ru')
    return 'nplurals=3; plural=n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2;';
  if (code === 'ar')
    return 'nplurals=6; plural=n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5;';
  if (/^(en|de|es|pt|it)(-|$)/.test(code)) return 'nplurals=2; plural=n!=1;';
  throw new Error(i18n.t('document.unsupportedPlural', { language }));
}

export function createTargetDocument(
  document: PODocument,
  entries: POEntry[],
  language: string
): PODocument {
  const rule = pluralRuleForLanguage(language);
  const count = Number(/nplurals=(\d+)/.exec(rule)?.[1]);
  return {
    ...document,
    metadata: {
      ...document.metadata,
      Language: canonicalTargetLanguage(language),
      'Plural-Forms': rule,
    },
    metadata_is_fuzzy: false,
    entries: entries.map(
      ({ needsReview: _review, translationSource: _source, justUpdated: _updated, ...entry }) => ({
        ...entry,
        msgstr: '',
        msgstr_plural: entry.msgid_plural ? Array<string>(count).fill('') : [],
        flags: entry.flags.filter((flag) => flag !== 'fuzzy'),
      })
    ),
  };
}

export function pluralCount(entry: POEntry, metadata: PODocument['metadata']): number {
  if (!entry.msgid_plural) return 1;
  const match = /nplurals\s*=\s*(\d+)/.exec(metadata['Plural-Forms'] ?? '');
  const declared = Number(match?.[1] ?? 0);
  return Math.max(1, entry.msgstr_plural.length, declared >= 1 && declared <= 20 ? declared : 0);
}

export function isEntryTranslated(entry: POEntry, metadata: PODocument['metadata']): boolean {
  if (!entry.msgid_plural) return !!entry.msgstr;
  return Array.from(
    { length: pluralCount(entry, metadata) },
    (_, i) => entry.msgstr_plural[i]
  ).every(Boolean);
}

export interface TranslationSlot {
  entryIndex: number;
  pluralIndex: number | null;
  input: TranslationInput;
}

export function translationSlots(
  entries: POEntry[],
  indices: number[],
  metadata: PODocument['metadata'],
  onlyEmpty = true
): TranslationSlot[] {
  return indices.flatMap((entryIndex) => {
    const entry = entries[entryIndex];
    if (!entry || entry.obsolete || !entry.msgid) return [];
    const rule = metadata['Plural-Forms'] ?? '';
    let slotCount = 1;
    if (entry.msgid_plural) {
      slotCount = Number(/(?:^|;)\s*nplurals\s*=\s*(\d+)\s*(?:;|$)/.exec(rule)?.[1] ?? 0);
      const expression = /(?:^|;)\s*plural\s*=\s*([^;]+)/.exec(rule)?.[1]?.trim();
      if (slotCount < 1 || slotCount > 20 || !expression) {
        throw new Error(i18n.t('errors.invalidPluralForms'));
      }
    }
    return Array.from({ length: slotCount }, (_, index) => {
      const pluralIndex = entry.msgid_plural ? index : null;
      const current = pluralIndex === null ? entry.msgstr : entry.msgstr_plural[index];
      if (onlyEmpty && current) return null;
      const context =
        pluralIndex !== null
          ? JSON.stringify([
              entry.msgctxt,
              entry.comments,
              entry.msgid,
              entry.msgid_plural,
              index,
              rule,
            ])
          : entry.comments.length
            ? JSON.stringify([entry.msgctxt, entry.comments])
            : entry.msgctxt || null;
      return {
        entryIndex,
        pluralIndex,
        input: { text: entry.msgid_plural ?? entry.msgid, context },
      };
    }).filter((slot): slot is TranslationSlot => slot !== null);
  });
}

export function statsDelta(
  next: TranslationStats,
  previous: TranslationStats | null
): TranslationStats {
  return {
    total: next.total - (previous?.total ?? 0),
    tm_hits: next.tm_hits - (previous?.tm_hits ?? 0),
    deduplicated: next.deduplicated - (previous?.deduplicated ?? 0),
    ai_translated: next.ai_translated - (previous?.ai_translated ?? 0),
    tm_learned: next.tm_learned - (previous?.tm_learned ?? 0),
    token_stats: {
      input_tokens: next.token_stats.input_tokens - (previous?.token_stats.input_tokens ?? 0),
      output_tokens: next.token_stats.output_tokens - (previous?.token_stats.output_tokens ?? 0),
      total_tokens: next.token_stats.total_tokens - (previous?.token_stats.total_tokens ?? 0),
      cost: next.token_stats.cost - (previous?.token_stats.cost ?? 0),
      unpriced_requests:
        next.token_stats.unpriced_requests - (previous?.token_stats.unpriced_requests ?? 0),
    },
  };
}
