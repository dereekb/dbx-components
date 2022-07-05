import { APP_CODE_PREFIXFirestoreCollections } from 'FIREBASE_COMPONENTS_NAME';
import { FirebaseServerActionsContext, FirebaseServerStorageService, FirebaseServerStorageServiceRef, FirebaseServerAuthServiceRef } from "@dereekb/firebase-server";
import { TransformAndValidateFunctionResultFactory, TransformAndValidateObjectFactory } from "@dereekb/model";
import { APP_CODE_PREFIXApiAuthService } from './auth.service';

export abstract class APP_CODE_PREFIXFirebaseServerActionsContext extends APP_CODE_PREFIXFirestoreCollections implements APP_CODE_PREFIXFirestoreCollections, FirebaseServerActionsContext, FirebaseServerAuthServiceRef<APP_CODE_PREFIXApiAuthService>, FirebaseServerStorageServiceRef {
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  abstract readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory<any>;
  abstract readonly authService: APP_CODE_PREFIXApiAuthService;
  abstract readonly storageService: FirebaseServerStorageService;
}
