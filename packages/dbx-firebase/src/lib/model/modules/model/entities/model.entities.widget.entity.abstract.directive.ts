import { Directive, inject } from '@angular/core';
import { DBX_FIREBASE_MODEL_ENTITY_WITH_STORE_TOKEN } from './model.entities.widget';
import { DbxFirebaseModelEntityWithStore } from './model.entities';

/**
 * An abstract DbxFirebase widget component that injects the entity data and provides some common accessors.
 */
@Directive({})
export abstract class AbstractDbxFirebaseModelEntitiesWidgetDirective {
  readonly entityData: DbxFirebaseModelEntityWithStore = inject(DBX_FIREBASE_MODEL_ENTITY_WITH_STORE_TOKEN);

  readonly store = this.entityData.store;
  readonly data$ = this.store.data$;
}
