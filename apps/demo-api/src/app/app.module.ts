import { Module } from '@nestjs/common';
import {  DemoApiFirebaseModule } from './common/firebase';
import { DemoApiModelModule } from './common/model/model.module';

@Module({
  imports: [DemoApiFirebaseModule, DemoApiModelModule],
  exports: [DemoApiModelModule]
})
export class DemoApiAppModule { }
