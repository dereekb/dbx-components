import { Module } from '@nestjs/common';
import { APP_CODE_PREFIXApiOidcModule } from '../api/oidc/oidc.module';
// @dbx-addon:mcp:server-module:imports

/**
 * Imports all server-only modules.
 *
 * These modules may build on top of the shared firebase functions modules.
 */
@Module({
  imports: [
    APP_CODE_PREFIXApiOidcModule
    // @dbx-addon:mcp:server-module:modules
  ]
})
export class APP_CODE_PREFIXApiServerModule {}
