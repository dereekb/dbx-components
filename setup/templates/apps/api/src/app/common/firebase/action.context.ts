import { APP_CODE_PREFIXFirestoreCollections } from 'FIREBASE_COMPONENTS_NAME';
import { FirebaseServerActionsContext } from "@dereekb/firebase-server";
import { TransformAndValidateFunctionResultFactory, TransformAndValidateObjectFactory } from "@dereekb/model";

export abstract class APP_CODE_PREFIXFirebaseServerActionsContext extends APP_CODE_PREFIXFirestoreCollections implements APP_CODE_PREFIXFirestoreCollections, FirebaseServerActionsContext {
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  abstract readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory<any>;
}
