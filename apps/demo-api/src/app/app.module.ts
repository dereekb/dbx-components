import { Module } from '@nestjs/common';
import { DemoApiApiModule } from './api/api.module';
import { DemoApiFirebaseModule } from './common/firebase';
import { DemoApiModelModule } from './common/model/model.module';

@Module({
  imports: [DemoApiFirebaseModule, DemoApiModelModule, DemoApiApiModule],
  exports: [DemoApiModelModule]
})
export class DemoApiAppModule { }
