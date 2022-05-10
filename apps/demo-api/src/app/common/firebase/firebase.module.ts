import { Module } from "@nestjs/common";
import { DemoApiFirestoreModule } from './firestore.module';
import { DemoApiActionModule } from './action.module';

@Module({
  imports: [DemoApiFirestoreModule, DemoApiActionModule]
})
export class DemoApiFirebaseModule { }
