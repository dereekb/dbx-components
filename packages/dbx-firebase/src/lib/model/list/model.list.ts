import { FirestoreItemPageIterationInstance, FirestoreQueryConstraint } from "@dereekb/firebase";
import { Maybe, ArrayOrValue } from "@dereekb/util";
import { Observable } from "rxjs";

export abstract class DbxFirebaseModelList<T> {

  abstract readonly constraints$: Observable<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>;
  abstract readonly firestoreIteration$: Observable<FirestoreItemPageIterationInstance<T>>;

  /**
   * Loads more items.
   */
  abstract next(): void;

  /**
   * Resets the list.
   */
  abstract reset(): void;

}
