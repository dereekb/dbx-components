import { type OnCallModelConfig } from '@dereekb/firebase-server';
import { oidcCallModelScopePreAssert } from '@dereekb/firebase-server/oidc';

/**
 * Config for the `callModel` dispatch function (see `crud.functions.ts`).
 *
 * Written by the `oidc` add-on: wires `oidcCallModelScopePreAssert()` so callers
 * authenticated via an OIDC bearer token must hold the matching `model.<call>`
 * scope before the dispatch runs.
 */
export const APP_CODE_PREFIX_CAMELCallModelConfig: OnCallModelConfig = {
  preAssert: oidcCallModelScopePreAssert()
};
