import { Module } from '@nestjs/common';
import { DemoApiApiModule } from './api/api.module';
import { DemoApiFirebaseModule, DemoApiModelModule } from './common';

@Module({
  imports: [DemoApiFirebaseModule, DemoApiModelModule, DemoApiApiModule],
  exports: [DemoApiModelModule]
})
export class DemoApiAppModule {}
