import { DemoFirestoreCollections } from "@dereekb/demo-firebase";
import { FirebaseServerActionsContext } from "@dereekb/firebase-server";
import { TransformAndValidateObjectFactory } from "@dereekb/model";

export abstract class DemoFirebaseServerActionsContext extends DemoFirestoreCollections implements DemoFirestoreCollections, FirebaseServerActionsContext {
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
}
