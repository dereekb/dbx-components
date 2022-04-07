import { Module } from "@nestjs/common";
import { AppFirestoreModule } from './firestore.module';
import { AppActionModule } from './action.module';

@Module({
  imports: [AppFirestoreModule, AppActionModule]
})
export class AppFirebaseModule { }
