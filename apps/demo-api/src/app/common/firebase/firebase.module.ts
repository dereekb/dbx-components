import { Module } from "@nestjs/common";
import { DemoApiFirestoreModule } from './firestore.module';
import { DemoApiActionModule } from './action.module';
import { DemoApiAuthModule } from "./auth.module";

@Module({
  imports: [DemoApiFirestoreModule, DemoApiActionModule, DemoApiAuthModule]
})
export class DemoApiFirebaseModule { }
