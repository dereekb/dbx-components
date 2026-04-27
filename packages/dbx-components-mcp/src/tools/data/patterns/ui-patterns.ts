/**
 * Curated dbx-web UI compositions used by the `dbx_ui_examples` tool.
 *
 * Each entry shows how to compose multiple dbx-web building blocks into a
 * complete, copy-paste-ready snippet. The per-component registry already
 * covers single-component docs via `dbx_ui_lookup` — UI_PATTERNS is
 * deliberately about MULTI-component compositions that answer "how do I lay
 * out a ___ with dbx-web?"
 *
 * Individual pattern definitions live in `./ui/*.pattern.ts` — this file
 * aggregates them into the registry array and provides the lookup function.
 */

import { UI_PATTERN_CARD_WITH_ACTION } from './ui/ui.card-with-action.pattern.js';
import { UI_PATTERN_LIST_PAGE } from './ui/ui.list-page.pattern.js';
import { UI_PATTERN_LOADING_WITH_EMPTY } from './ui/ui.loading-with-empty.pattern.js';
import { UI_PATTERN_SETTINGS_SECTION } from './ui/ui.settings-section.pattern.js';
import { UI_PATTERN_SIDENAV_APP_SHELL } from './ui/ui.sidenav-app-shell.pattern.js';
import { UI_PATTERN_TWO_COLUMN_DETAIL } from './ui/ui.two-column-detail.pattern.js';

export type UiExampleDepth = 'minimal' | 'brief' | 'full';

export interface UiExamplePattern {
  /**
   * Slug used as the pattern key and in `dbx_ui_examples pattern="..."` calls.
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
   * UI registry slugs this pattern composes from. Useful for cross-linking.
   */
  readonly usesUiSlugs: readonly string[];
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

export const UI_PATTERNS: readonly UiExamplePattern[] = [UI_PATTERN_SETTINGS_SECTION, UI_PATTERN_LIST_PAGE, UI_PATTERN_TWO_COLUMN_DETAIL, UI_PATTERN_CARD_WITH_ACTION, UI_PATTERN_LOADING_WITH_EMPTY, UI_PATTERN_SIDENAV_APP_SHELL];

/**
 * Looks up a UI example pattern by its slug.
 *
 * @param slug - the pattern slug to resolve, case-insensitive and trimmed
 * @returns the matching pattern, or `undefined` when no slug matches
 */
export function getUiExamplePattern(slug: string): UiExamplePattern | undefined {
  const lowered = slug.trim().toLowerCase();
  return UI_PATTERNS.find((p) => p.slug === lowered);
}
