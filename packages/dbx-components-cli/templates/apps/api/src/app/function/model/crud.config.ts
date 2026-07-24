import { type OnCallModelConfig } from '@dereekb/firebase-server';

/**
 * Config for the `callModel` dispatch function (see `crud.functions.ts`).
 *
 * Empty by default — an extension point for `onCallModel` options (e.g. a
 * `preAssert`). OIDC scope enforcement for OIDC-bearer callers is NOT wired here:
 * it lives at the model-api layer (`ModelApiDispatchConfig`, wired by the `mcp`
 * add-on's `server/model/model.module.ts`), which gates every OIDC call path —
 * dispatch, `/get` direct reads, and MCP — uniformly.
 */
export const APP_CODE_PREFIX_CAMELCallModelConfig: OnCallModelConfig = {};
