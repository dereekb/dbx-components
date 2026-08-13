import { type FirebaseServerEnvironmentConfig } from '@dereekb/firebase-server';

/**
 * Local-development server environment configuration.
 *
 * @dbxAllowConstantName Angular environment files conventionally export camelCase singletons.
 */
export const environment: FirebaseServerEnvironmentConfig = {
  production: false,
  developerToolsEnabled: true,
  appUrl: 'http://localhost:9010',
  appApiUrl: 'http://localhost:9010/api',
  // The external-connection `/oauth/**` routes are excluded from the global API prefix and reached
  // through the hosting rewrite, which the emulator serves on 9901 — not through the Angular dev
  // server on 9010. The redirect URI registered with each provider is derived from this origin, and
  // providers require a byte-identical match. In production the two origins coincide, so
  // environment.prod.ts omits it and the framework falls back to appUrl.
  appOAuthUrl: 'http://localhost:9901',
  // Served through the hosting emulator (same reason as `appOAuthUrl` above) rather than the
  // Functions emulator origin. RFC 9728 discovery probes `/.well-known/oauth-protected-resource`
  // at the *origin root*, and the Functions emulator only routes `/<project>/<region>/<function>/…`
  // — the Nest app sits under that prefix and can't answer at the root, so a client that hasn't
  // yet seen a 401 (the `/mcp` → Authenticate flow) fails discovery and falls back to treating
  // the origin itself as the authorization server. Hosting serves the app at the root, so both
  // discovery probes resolve. The `:9010` Angular dev-server proxy is also root-origin but was
  // ruled out: webpack-dev-server's http-proxy-middleware doesn't reliably stream responses.
  // This URL flows into the protected-resource `resource`, the RFC 8707 resourceServers key, the
  // audience claim on tokens, and the RFC 9728 resource_metadata WWW-Authenticate URL, so
  // changing it here keeps every wire-level identifier consistent.
  appMcpUrl: 'http://localhost:9901/mcp'
};
