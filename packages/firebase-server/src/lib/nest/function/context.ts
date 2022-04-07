import { TransformAndValidateObjectFactory } from "@dereekb/model";
import { firebaseServerActionsTransformContext, FirebaseServerActionsTransformContext } from "./transform";

/**
 * Context used for building FirebaseServerActions. It contains references to reusable factories.
 */
export interface FirebaseServerActionsContext extends FirebaseServerActionsTransformContext { }

export abstract class AbstractFirebaseServerActionsContext implements FirebaseServerActionsContext {
  abstract readonly firebaseServerActionTransformFactory: TransformAndValidateObjectFactory;
}

export function firebaseServerActionsContext(): FirebaseServerActionsContext {
  return {
    ...firebaseServerActionsTransformContext()
  };
}
