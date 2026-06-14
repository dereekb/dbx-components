import { Module } from '@nestjs/common';
import { APP_CODE_PREFIXApiFirebaseModule, APP_CODE_PREFIXApiModelModule } from './common';
import { GlobalNotificationModule } from '@dereekb/firebase-server/model';
// @dbx-addon:oidc:api-app-module:imports
// @dbx-addon:mcp:api-app-module:imports

// @dbx-addon:mcp:api-app-module:global-class

@Module({
  imports: [
    GlobalNotificationModule
    // @dbx-addon:mcp:api-app-module:global-imports
  ],
  exports: [
    GlobalNotificationModule
    // @dbx-addon:mcp:api-app-module:global-exports
  ]
})
export class APP_CODE_PREFIXApiAppGlobalModule {}

@Module({
  imports: [
    APP_CODE_PREFIXApiFirebaseModule,
    APP_CODE_PREFIXApiModelModule,
    APP_CODE_PREFIXApiAppGlobalModule
    // @dbx-addon:oidc:api-app-module:app-imports
  ],
  exports: [APP_CODE_PREFIXApiModelModule]
})
export class APP_CODE_PREFIXApiAppModule {}
