import { DemoApiAuthService } from './auth.service';
import { DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { FirebaseServerActionsContext, FirebaseServerAuthServiceRef, FirebaseServerStorageService, FirebaseServerStorageServiceRef } from '@dereekb/firebase-server';
import { TransformAndValidateFunctionResultFactory, TransformAndValidateObjectFactory } from '@dereekb/model';

export abstract class DemoFirebaseServerActionsContext extends DemoFirestoreCollections implements DemoFirestoreCollections, FirebaseServerActionsContext, FirebaseServerAuthServiceRef<DemoApiAuthService>, FirebaseServerStorageServiceRef {
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  abstract readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory<any>;
  abstract readonly authService: DemoApiAuthService;
  abstract readonly storageService: FirebaseServerStorageService;
}
