import { Module } from '@nestjs/common';
import { APP_CODE_PREFIXApiFirebaseModule, APP_CODE_PREFIXApiModelModule } from './common';

@Module({
  imports: [APP_CODE_PREFIXApiFirebaseModule, APP_CODE_PREFIXApiModelModule],
  exports: [APP_CODE_PREFIXApiModelModule]
})
export class APP_CODE_PREFIXApiAppModule { }
