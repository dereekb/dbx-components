import * as rruleModule from 'rrule';

/**
 * `rrule` publishes no `exports` map, so Node resolves the bare `rrule` specifier through
 * `main` to its CommonJS es5 build. That build's UMD wrapper defeats `cjs-module-lexer`'s
 * named-export detection — the namespace Node synthesizes is only
 * `{ default, module.exports, rrule }` — so a named `import { RRule } from 'rrule'` fails to
 * bind and throws `SyntaxError: Named export 'RRule' not found` in any Node consumer of this
 * package's ESM build.
 *
 * Bundlers resolve the `module` field instead, whose ESM build exports `RRule` by name and
 * declares NO default export. So neither a named import nor a default import works in both
 * worlds; unwrapping `default` only when it is present does:
 *
 * - Node (CommonJS): `default` holds the real `module.exports`, which carries `RRule`.
 * - Bundlers (ESM): there is no `default`, so this falls through to the namespace itself.
 *
 * The cast is required because rrule's typings declare no `default` member.
 */
const rrule: typeof rruleModule = (rruleModule as { readonly default?: typeof rruleModule }).default ?? rruleModule;

export const { RRule } = rrule;

/**
 * Instance type of {@link RRule}, re-declared because the value above is a `const` rather than
 * a directly imported class binding.
 */
export type RRule = rruleModule.RRule;

export type { Options } from 'rrule';
