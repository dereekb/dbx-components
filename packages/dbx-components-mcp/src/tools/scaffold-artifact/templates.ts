/**
 * Token derivation + body templates for `dbx_scaffold_artifact`.
 *
 * Templates are inline TypeScript template-literal strings with
 * `<<token>>` slots that {@link applyTokens} substitutes once per
 * invocation. Slot-token names parallel the `dbx_file_convention`
 * placeholder set ({@link NameTokens}) so callers can think in the
 * same vocabulary across both tools.
 */

import type { NameTokens } from './types.js';

/**
 * Splits a free-form name (kebab, snake, camel, pascal) into lowercase
 * word tokens.
 */
function splitWords(input: string): readonly string[] {
  const broken = input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s\-_]+/)
    .filter((p) => p.length > 0);
  return broken;
}

export function deriveNameTokens(name: string): NameTokens {
  const parts = splitWords(name);
  if (parts.length === 0) {
    throw new Error(`Cannot derive tokens from empty name "${name}".`);
  }
  const lower = parts.map((p) => p.toLowerCase());
  const camel = lower.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');
  const pascal = lower.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  const screaming = lower.map((p) => p.toUpperCase()).join('_');
  const kebab = lower.join('-');
  const result: NameTokens = { camel, pascal, screaming, kebab };
  return result;
}

/**
 * Token substitution. Slot syntax: `<<camel>>`, `<<Pascal>>`,
 * `<<SCREAMING>>`, `<<kebab>>`, `<<componentDir>>`, `<<apiDir>>`.
 */
export interface TemplateContext {
  readonly tokens: NameTokens;
  readonly componentDir: string;
  readonly apiDir: string;
}

export function applyTokens(template: string, ctx: TemplateContext): string {
  let result = template;
  result = result.split('<<componentDir>>').join(ctx.componentDir);
  result = result.split('<<apiDir>>').join(ctx.apiDir);
  result = result.split('<<camel>>').join(ctx.tokens.camel);
  result = result.split('<<Pascal>>').join(ctx.tokens.pascal);
  result = result.split('<<SCREAMING>>').join(ctx.tokens.screaming);
  result = result.split('<<kebab>>').join(ctx.tokens.kebab);
  return result;
}
