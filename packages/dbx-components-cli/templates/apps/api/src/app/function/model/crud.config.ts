import { type OnCallModelConfig } from '@dereekb/firebase-server';

/**
 * Config for the `callModel` dispatch function (see `crud.functions.ts`).
 *
 * Empty by default. The `oidc` add-on (`dbx-components-cli setup addon oidc`)
 * overwrites this file to wire `oidcCallModelScopePreAssert()`, so callers
 * authenticated via an OIDC bearer token must hold the matching `model.<call>`
 * scope. Kept in its own file so the add-on can replace it deterministically
 * without editing the app-specific `crud.functions.ts`.
 */
export const APP_CODE_PREFIX_CAMELCallModelConfig: OnCallModelConfig = {};
