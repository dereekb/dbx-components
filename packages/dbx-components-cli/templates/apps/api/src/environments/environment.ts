import { type FirebaseServerEnvironmentConfig } from '@dereekb/firebase-server';

export const environment: FirebaseServerEnvironmentConfig = {
  production: false,
  developerToolsEnabled: true,
  // Dev appUrl is the Angular dev-server origin (the OIDC issuer is rooted here, and
  // proxy.conf.dev.json forwards /oidc + /.well-known + /interaction to the functions emulator).
  appUrl: 'http://localhost:ANGULAR_APP_PORT'
  // @dbx-addon:oidc:api-env:fields
  // @dbx-addon:mcp:api-env:fields
};
