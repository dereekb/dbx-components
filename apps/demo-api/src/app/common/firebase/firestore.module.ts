import { DemoFirestoreCollections, makeDemoFirestoreCollections } from "@dereekb/demo-firebase";
import { appFirestoreModuleMetadata } from "@dereekb/firebase-server";
import { Module } from "@nestjs/common";

@Module(appFirestoreModuleMetadata({
  provide: DemoFirestoreCollections,
  useFactory: makeDemoFirestoreCollections
}))
export class DemoApiFirestoreModule { }
