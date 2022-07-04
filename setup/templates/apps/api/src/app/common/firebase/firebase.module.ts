import { Module } from "@nestjs/common";
import { APP_CODE_PREFIXApiFirestoreModule } from './firestore.module';
import { APP_CODE_PREFIXApiActionModule } from './action.module';
import { APP_CODE_PREFIXApiAuthModule } from "./auth.module";
import { APP_CODE_PREFIXApiStorageModule } from './storage.module';

@Module({
  imports: [APP_CODE_PREFIXApiFirestoreModule, APP_CODE_PREFIXApiActionModule, APP_CODE_PREFIXApiAuthModule, APP_CODE_PREFIXApiStorageModule]
})
export class APP_CODE_PREFIXApiFirebaseModule { }
