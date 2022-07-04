import { Module } from '@nestjs/common';
import { DemoApiFirestoreModule } from './firestore.module';
import { DemoApiActionModule } from './action.module';
import { DemoApiAuthModule } from './auth.module';
import { DemoApiStorageModule } from './storage.module';

@Module({
  imports: [DemoApiFirestoreModule, DemoApiActionModule, DemoApiAuthModule, DemoApiStorageModule]
})
export class DemoApiFirebaseModule {}
