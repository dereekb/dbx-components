/**
 * Curated dbx-form compositions used by the `dbx_form_examples` tool.
 *
 * Each entry shows how to compose multiple form entries into a complete,
 * copy-paste-ready `FormConfig`. The per-field registry already surfaces
 * minimal single-field examples via `dbx_form_lookup` — EXAMPLE_PATTERNS is
 * deliberately about MULTI-field compositions that answer "how do I build a
 * ___ form?"
 *
 * Individual pattern definitions live in `./forms/*.pattern.ts` — this file
 * aggregates them into the registry array and provides the lookup function.
 */

import { FORM_PATTERN_ADDRESS_FORM } from './forms/form.address-form.pattern.js';
import { FORM_PATTERN_CONTACT_FORM } from './forms/form.contact-form.pattern.js';
import { FORM_PATTERN_DATE_RANGE_FILTER } from './forms/form.date-range-filter.pattern.js';
import { FORM_PATTERN_EXPANDABLE_ADVANCED } from './forms/form.expandable-advanced.pattern.js';
import { FORM_PATTERN_LOGIN_FORM } from './forms/form.login-form.pattern.js';
import { FORM_PATTERN_SIGN_UP_FORM } from './forms/form.sign-up-form.pattern.js';
import { FORM_PATTERN_TAG_PICKER } from './forms/form.tag-picker.pattern.js';

export type ExampleDepth = 'minimal' | 'brief' | 'full';

export interface ExamplePattern {
  /**
   * Slug used as the pattern key and in `dbx_form_examples pattern="..."` calls.
   */
  readonly slug: string;
  /**
   * Short display name.
   */
  readonly name: string;
  /**
   * One-sentence description of what the pattern builds.
   */
  readonly summary: string;
  /**
   * Form slugs that this pattern composes from. Useful for cross-linking.
   */
  readonly usesFormSlugs: readonly string[];
  /**
   * Code snippets at increasing levels of detail.
   */
  readonly snippets: {
    readonly minimal: string;
    readonly brief: string;
    readonly full: string;
  };
  /**
   * Optional supplementary notes appended to `full` depth.
   */
  readonly notes?: string;
}

export const EXAMPLE_PATTERNS: readonly ExamplePattern[] = [FORM_PATTERN_CONTACT_FORM, FORM_PATTERN_SIGN_UP_FORM, FORM_PATTERN_LOGIN_FORM, FORM_PATTERN_ADDRESS_FORM, FORM_PATTERN_DATE_RANGE_FILTER, FORM_PATTERN_TAG_PICKER, FORM_PATTERN_EXPANDABLE_ADVANCED];

/**
 * Looks up an example pattern by its slug.
 *
 * @param slug - the pattern slug to resolve, case-insensitive and trimmed
 * @returns the matching pattern, or `undefined` when no slug matches
 */
export function getExamplePattern(slug: string): ExamplePattern | undefined {
  const lowered = slug.trim().toLowerCase();
  return EXAMPLE_PATTERNS.find((p) => p.slug === lowered);
}
