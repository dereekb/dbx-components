import { type FirebaseServerEnvironmentConfig } from '@dereekb/firebase-server';
import { environment as prod } from './environment.prod';

/**
 * Staging environment for the API app, selected by the `staging` configuration of
 * `<api-app>:build-base` via `esbuild.staging.config.js`.
 *
 * Spreads production rather than the dev base so that a field added to
 * `environment.prod.ts` — including the `appApiUrl` / `appMcpUrl` the `oidc` and `mcp`
 * add-ons inject — is inherited here instead of silently falling back to the dev value.
 * `production: true` is inherited with it, which keeps the `dev` callable's handler
 * stubbed out (the endpoint is still deployed; `firebaseServerDevFunctions` swaps the
 * handler for one that throws `unavailableError`).
 *
 * Override below only what genuinely differs from production — the origins.
 */
export const environment: FirebaseServerEnvironmentConfig = {
  ...prod,
  appUrl: 'https://staging.example.com'
  // @dbx-addon:oidc:api-env:fields
  // @dbx-addon:mcp:api-env:fields
};
