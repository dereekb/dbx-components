import { Type, Provider, forwardRef } from "@angular/core";
import { FirestoreItemPageIterationInstance, FirestoreQueryConstraint } from "@dereekb/firebase";
import { PageListLoadingState } from "@dereekb/rxjs";
import { Maybe, ArrayOrValue } from "@dereekb/util";
import { Observable } from "rxjs";

/**
 * Abstract type that loads models from a configured collection.
 */
export abstract class DbxFirebaseModelLoader<T = any> {

  abstract readonly constraints$: Observable<Maybe<ArrayOrValue<FirestoreQueryConstraint>>>;
  abstract readonly firestoreIteration$: Observable<FirestoreItemPageIterationInstance<T>>;
  abstract readonly pageLoadingState$: Observable<PageListLoadingState<T>>;

  /**
   * Maximum number of pages to load from the interation.
   * 
   * Changing this updates the iteration, but does not reset it.
   */
  abstract maxPages: Maybe<number>;

  /**
   * Number of items to load per page. 
   * 
   * Changing this will reset the iteration.
   */
  abstract itemsPerPage: Maybe<number>;

  /**
   * Loads more items.
   */
  abstract next(): void;

  /**
   * Resets the list.
   */
  abstract reset(): void;

  /**
   * Sets the constraints on the model loader.
   * 
   * @param constraints 
   */
  abstract setConstraints(constraints: Maybe<ArrayOrValue<FirestoreQueryConstraint>>): void;

}

export function ProvideDbxFirebaseModelLoader<S extends DbxFirebaseModelLoader>(sourceType: Type<S>): Provider[] {
  return [{
    provide: DbxFirebaseModelLoader,
    useExisting: forwardRef(() => sourceType)
  }];
}
