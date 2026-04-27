/**
 * Curated dbx-core action wirings used by the `dbx_action_examples` tool.
 *
 * Each entry shows how to compose multiple action directives (root + value
 * provider + trigger + handler + optional feedback) into a complete, working
 * snippet. The per-directive registry already surfaces single-directive docs
 * via `dbx_action_lookup` — patterns deliberately answer "how do I assemble
 * the directive stack to do X?"
 *
 * Individual pattern definitions live in `./actions/*.pattern.ts` — this file
 * aggregates them into the registry array and provides the lookup function.
 */

import { ACTION_PATTERN_AUTO_TRIGGER_ON_MODIFY } from './actions/action.auto-trigger-on-modify.pattern.js';
import { ACTION_PATTERN_BUTTON_CONFIRM_DELETE } from './actions/action.button-confirm-delete.pattern.js';
import { ACTION_PATTERN_DISABLED_BY_KEY } from './actions/action.disabled-by-key.pattern.js';
import { ACTION_PATTERN_FORM_SUBMIT } from './actions/action.form-submit.pattern.js';
import { ACTION_PATTERN_PROVIDE_CONTEXT_UP } from './actions/action.provide-context-up.pattern.js';
import { ACTION_PATTERN_VALUE_GETTER_ON_TRIGGER } from './actions/action.value-getter-on-trigger.pattern.js';

export type ActionExampleDepth = 'minimal' | 'brief' | 'full';

export interface ActionExamplePattern {
  /**
   * Slug used as the pattern key and in `dbx_action_examples pattern="..."` calls.
   */
  readonly slug: string;
  /**
   * Short display name.
   */
  readonly name: string;
  /**
   * One-sentence description of what the pattern wires.
   */
  readonly summary: string;
  /**
   * Action registry slugs the pattern composes from.
   */
  readonly usesActionSlugs: readonly string[];
  /**
   * Code snippets at increasing levels of detail.
   */
  readonly snippets: {
    readonly minimal: string;
    readonly brief: string;
    readonly full: string;
  };
  /**
   * Optional supplementary notes appended at full depth.
   */
  readonly notes?: string;
}

export const ACTION_EXAMPLE_PATTERNS: readonly ActionExamplePattern[] = [ACTION_PATTERN_BUTTON_CONFIRM_DELETE, ACTION_PATTERN_FORM_SUBMIT, ACTION_PATTERN_AUTO_TRIGGER_ON_MODIFY, ACTION_PATTERN_DISABLED_BY_KEY, ACTION_PATTERN_VALUE_GETTER_ON_TRIGGER, ACTION_PATTERN_PROVIDE_CONTEXT_UP];

/**
 * Looks up an action example pattern by its slug.
 *
 * @param slug - the pattern slug to resolve, case-insensitive and trimmed
 * @returns the matching pattern, or `undefined` when no slug matches
 */
export function getActionExamplePattern(slug: string): ActionExamplePattern | undefined {
  const lowered = slug.trim().toLowerCase();
  return ACTION_EXAMPLE_PATTERNS.find((p) => p.slug === lowered);
}
