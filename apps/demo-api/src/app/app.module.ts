import { Module } from '@nestjs/common';
import {  DemoApiFirebaseModule } from './common/firebase';
import { AppModelModule } from './common/model/model.module';

@Module({
  imports: [DemoApiFirebaseModule, AppModelModule],
  exports: [AppModelModule]
})
export class DemoApiAppModule { }
