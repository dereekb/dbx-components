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
  appMcpUrl: 'http://localhost:9010/mcp'
};
