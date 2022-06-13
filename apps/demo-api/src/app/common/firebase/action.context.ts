import { DemoApiAuthService } from './auth.service';
import { DemoFirestoreCollections } from '@dereekb/demo-firebase';
import { FirebaseServerActionsContext, FirebaseServerAuthServiceRef } from '@dereekb/firebase-server';
import { TransformAndValidateFunctionResultFactory, TransformAndValidateObjectFactory } from '@dereekb/model';

export abstract class DemoFirebaseServerActionsContext extends DemoFirestoreCollections implements DemoFirestoreCollections, FirebaseServerActionsContext, FirebaseServerAuthServiceRef<DemoApiAuthService> {
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
  abstract readonly firebaseServerActionTransformFunctionFactory: TransformAndValidateFunctionResultFactory<any>;
  abstract readonly authService: DemoApiAuthService;
}
