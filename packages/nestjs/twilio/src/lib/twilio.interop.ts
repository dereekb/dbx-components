import * as twilioModule from 'twilio';

/**
 * `twilio` is published as pure CommonJS — no `exports` map, no `module` field, just
 * `main: "./lib"`. Node therefore synthesizes its ESM namespace with `cjs-module-lexer`, which
 * finds no named exports on that entry, so the namespace is only `{ default, module.exports }`
 * and a named `import { Twilio } from 'twilio'` cannot bind. Any plain-Node consumer of this
 * package's ESM build dies at load time with
 * `SyntaxError: Named export 'Twilio' not found`.
 *
 * Unlike `rrule`, there is no separate ESM build here, so bundlers resolve the same CommonJS
 * entry and their own interop supplies the identical `default`. Unwrapping `default` when
 * present is correct in both worlds.
 *
 * Guarded by `tools/scripts/check-esm-named-imports.mjs`.
 *
 * The `unknown` hops are required under TypeScript 6, which rejects a namespace import in a
 * callable position: twilio's entry is a callable factory, so `typeof twilioModule` carries
 * call/construct signatures and the bare cast trips `A namespace-style import cannot be called
 * or constructed`. Widening through `unknown` keeps the runtime unwrap byte-for-byte identical.
 */
type TwilioModule = typeof twilioModule;

const twilio: TwilioModule = (twilioModule as unknown as { readonly default?: TwilioModule }).default ?? (twilioModule as unknown as TwilioModule);

export const { Twilio, validateRequest } = twilio;

/**
 * Instance type of {@link Twilio}, re-declared because the value above is a `const` rather than
 * a directly imported class binding.
 */
export type Twilio = twilioModule.Twilio;
