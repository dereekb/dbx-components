import { Directive, inject } from '@angular/core';
import { DBX_FIREBASE_MODEL_ENTITY_WITH_STORE_TOKEN } from './model.entities.widget';
import { DbxFirebaseModelEntityWithStore } from './model.entities';
import { type FirestoreDocument } from '@dereekb/firebase';

/**
 * An abstract DbxFirebase widget component that injects the entity data and provides some common accessors.
 */
@Directive({})
export abstract class AbstractDbxFirebaseModelEntityWidgetDirective<T = any, D extends FirestoreDocument<T> = FirestoreDocument<T>> {
  readonly entityData: DbxFirebaseModelEntityWithStore<T, D> = inject(DBX_FIREBASE_MODEL_ENTITY_WITH_STORE_TOKEN);

  readonly store = this.entityData.store;
  readonly data$ = this.store.data$;
}
