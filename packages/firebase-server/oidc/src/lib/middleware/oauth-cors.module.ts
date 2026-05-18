import { type INestApplication } from '@nestjs/common';
import { FirebaseServerEnvService } from '@dereekb/firebase-server';

// MARK: Express-Level Helper
/**
 * Enables CORS on the NestJS app for OIDC cross-origin requests originating from the frontend.
 *
 * When the OIDC issuer lives on a different origin than the frontend app (e.g. the frontend is
 * `https://app.example.com` and the OIDC server is at `https://api.example.com`), the frontend's
 * `DbxFirebaseOidcInteractionService` issues cross-origin POSTs to `/interaction/{uid}/login`
 * and `/interaction/{uid}/consent`. Because the POST body is `application/json`, the browser
 * sends a CORS preflight. Without an `Access-Control-Allow-Origin` reply the preflight fails,
 * the POST never reaches the server, and the OAuth flow stalls before `finishInteractionByUid`
 * can run.
 *
 * Origin is sourced from `FirebaseServerEnvService.appUrl`, which is the authoritative frontend
 * origin per environment. Single-origin deployments (e.g. local dev where the frontend and the
 * OIDC server share `http://localhost:9010`) still benefit: their cross-origin requests are
 * actually same-origin and CORS is a no-op.
 *
 * Credentials are intentionally NOT enabled (`Access-Control-Allow-Credentials` stays off). The
 * `/interaction/{uid}/*` POSTs carry the Firebase ID token in the JSON body, not in cookies, so
 * we keep the CORS surface minimal.
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
  const origin = envService.appUrl;

  if (!origin) {
    return;
  }

  nestApp.enableCors({
    origin,
    methods: ['GET', 'POST', 'OPTIONS']
  });
}
