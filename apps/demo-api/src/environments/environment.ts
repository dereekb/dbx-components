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
  // Point directly at the Firebase Functions emulator origin (bypassing the Angular dev-server
  // proxy on :9010) — webpack-dev-server's http-proxy-middleware doesn't reliably stream the
  // MCP SDK's `text/event-stream` responses, turning the upstream 200 SSE into a 400 at the
  // client. This URL flows into the protected-resource `resource`, the RFC 8707 resourceServers
  // key, the audience claim on tokens, and the RFC 9728 resource_metadata WWW-Authenticate URL,
  // so changing it here keeps every wire-level identifier consistent.
  appMcpUrl: 'http://localhost:9902/dereekb-components/us-central1/api/mcp'
};
