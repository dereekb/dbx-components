import { DemoFirestoreCollections, makeDemoFirestoreCollections } from "@dereekb/demo-firebase";
import { Module } from "@nestjs/common";

import * as admin from 'firebase-admin';

const demoFirestoreCollectionsFactory = () => makeDemoFirestoreCollections(admin.firestore());

@Module({
  imports: [],
  controllers: [],
  providers: [{
    provide: DemoFirestoreCollections,
    useFactory: () => {

    }
  }],
})
export class AppFirestoreModule { }
