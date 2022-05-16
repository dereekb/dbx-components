import { Module } from "@nestjs/common";
import { APP_CODE_PREFIXApiFirestoreModule } from './firestore.module';
import { APP_CODE_PREFIXApiActionModule } from './action.module';
import { APP_CODE_PREFIXApiAuthModule } from "./auth.module";

@Module({
  imports: [APP_CODE_PREFIXApiFirestoreModule, APP_CODE_PREFIXApiActionModule, APP_CODE_PREFIXApiAuthModule]
})
export class APP_CODE_PREFIXApiFirebaseModule { }
