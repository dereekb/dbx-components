import { APP_CODE_PREFIXFirestoreCollections, makeAPP_CODE_PREFIXFirestoreCollections } from 'FIREBASE_COMPONENTS_NAME';
import { appFirestoreModuleMetadata } from "@dereekb/firebase-server";
import { Module } from "@nestjs/common";

@Module(appFirestoreModuleMetadata({
  provide: APP_CODE_PREFIXFirestoreCollections,
  useFactory: makeAPP_CODE_PREFIXFirestoreCollections
}))
export class APP_CODE_PREFIXApiFirestoreModule { }
