import { Module } from '@nestjs/common';
import { APP_CODE_PREFIXApiFirebaseModule, APP_CODE_PREFIXApiModelModule } from './common';
import { GlobalNotificationModule } from '@dereekb/firebase-server/model';

@Module({
  imports: [GlobalNotificationModule],
  exports: [GlobalNotificationModule]
})
export class APP_CODE_PREFIXApiAppGlobalModule { }

@Module({
  imports: [APP_CODE_PREFIXApiFirebaseModule, APP_CODE_PREFIXApiModelModule, APP_CODE_PREFIXApiAppGlobalModule],
  exports: [APP_CODE_PREFIXApiModelModule]
})
export class APP_CODE_PREFIXApiAppModule { }
