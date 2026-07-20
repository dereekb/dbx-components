import { type INestApplication } from '@nestjs/common';
import { type Maybe } from '@dereekb/util';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';
import { OidcModuleConfig, type OidcCorsConfig } from '../oidc.config';

// MARK: Origin Delegate
/**
 * Signature of the `origin` callback the `cors` package (used by NestJS
 * `enableCors`) invokes per request. Returning a string sets that exact
 * `Access-Control-Allow-Origin`; returning `false` omits the header entirely.
 */
export type OidcCorsOriginDelegate = (requestOrigin: Maybe<string>, callback: (err: Maybe<Error>, origin?: string | boolean) => void) => void;

/**
 * Builds the `cors`-package origin delegate implementing the composed OIDC CORS policy.
 *
 * - An allowlisted origin (`appUrl` or any {@link OidcCorsConfig.allowOrigins} entry) is
 *   reflected exactly, which pre-empts oidc-provider's own CORS handling.
 * - Otherwise, when {@link OidcCorsConfig.clientBased} is enabled, the header is OMITTED so
 *   oidc-provider runs its `clientBasedCORS` check on client routes (`/token`) and its builtin
 *   reflect on client-less routes (discovery/JWKS).
 * - Otherwise (client-based off), `appUrl` is returned unconditionally so oidc-provider stays
 *   pre-empted and there is never a reflect-any.
 *
 * Exported for unit testing without a running Nest application.
 *
 * @param appUrl - The authoritative frontend origin (always allowed).
 * @param cors - The unified CORS configuration.
 * @returns A `cors`-package origin delegate.
 */
export function oidcCorsOriginDelegate(appUrl: string, cors: OidcCorsConfig): OidcCorsOriginDelegate {
  const clientBased = cors.clientBased === true;
  const allowlist = new Set<string>([appUrl, ...(cors.allowOrigins ?? [])]);

  return (requestOrigin, callback) => {
    let resolved: string | boolean;

    if (requestOrigin && allowlist.has(requestOrigin)) {
      resolved = requestOrigin; // reflect the exact allowlisted origin; pre-empts oidc-provider
    } else if (clientBased) {
      resolved = false; // OMIT ACAO → oidc-provider runs clientBasedCORS (token) / builtin reflect (discovery)
    } else {
      resolved = appUrl; // legacy fallback: ACAO=appUrl always; no reflect-any
    }

    callback(null, resolved);
  };
}

// MARK: Express-Level Helper
/**
 * Enables CORS on the NestJS app for OIDC cross-origin requests originating from the frontend
 * and any additional relying-party origins.
 *
 * When the OIDC issuer lives on a different origin than the frontend app (e.g. the frontend is
 * `https://app.example.com` and the OIDC server is at `https://api.example.com`), the frontend's
 * `DbxFirebaseOidcInteractionService` issues cross-origin POSTs to `/interaction/{uid}/login`
 * and `/interaction/{uid}/consent`. Because the POST body is `application/json`, the browser
 * sends a CORS preflight. Without an `Access-Control-Allow-Origin` reply the preflight fails,
 * the POST never reaches the server, and the OAuth flow stalls before `finishInteractionByUid`
 * can run. Browser-based OIDC relying parties (public PKCE clients) likewise need CORS on the
 * discovery GET and the token POST.
 *
 * `appUrl` (from `FirebaseServerEnvService.appUrl`) is always allowed. Additional behavior is
 * driven by the optional {@link OidcModuleConfig.cors} configuration:
 * - {@link OidcCorsConfig.allowOrigins} adds an explicit allowlist of relying-party origins.
 * - {@link OidcCorsConfig.clientBased} defers non-allowlisted origins to oidc-provider's
 *   `clientBasedCORS`, which trusts each requesting client's registered `redirect_uris`.
 *
 * When `cors` is unset, this preserves the legacy single-origin behavior exactly:
 * `Access-Control-Allow-Origin: <appUrl>` on every response, which pre-empts oidc-provider's
 * own CORS handling.
 *
 * Credentials are intentionally NOT enabled (`Access-Control-Allow-Credentials` stays off). The
 * `/interaction/{uid}/*` POSTs and the token exchange carry their bearer material in the request
 * body, not in cookies, so we keep the CORS surface minimal.
 *
 * @param nestApp - The NestJS application to configure.
 *
 * @example
 * ```ts
 * export const APP_NEST_SERVER_CONFIG: NestServerInstanceConfig<AppModule> = {
 *   moduleClass: AppModule,
 *   configureNestServerInstance: (nestApp) => {
 *     applyOidcCorsMiddleware(nestApp);
 *     applyOidcAuthMiddleware(nestApp);
 *   }
 * };
 * ```
 */
export function applyOidcCorsMiddleware(nestApp: INestApplication): void {
  const envService = nestApp.get(FirebaseServerEnvService);
  const appUrl = envService.appUrl;

  if (!appUrl) {
    return;
  }

  // OidcModuleConfig may be absent (module not registered / out of the resolution scope).
  let cors: OidcCorsConfig | undefined;

  try {
    cors = nestApp.get(OidcModuleConfig, { strict: false })?.cors;
  } catch {
    cors = undefined;
  }

  if (cors) {
    nestApp.enableCors({
      origin: oidcCorsOriginDelegate(appUrl, cors),
      methods: ['GET', 'POST', 'OPTIONS']
    });
  } else {
    // No cors config → byte-identical to the legacy behavior: ACAO=appUrl unconditionally.
    nestApp.enableCors({
      origin: appUrl,
      methods: ['GET', 'POST', 'OPTIONS']
    });
  }
}
