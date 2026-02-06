import { InjectionToken, type Injector, type StaticProvider } from '@angular/core';
import { type DbxFirebaseModelEntityWithStore } from './model.entities';
import { type DbxFirebaseModelEntitiesWidgetEntry } from './model.entities.widget.service';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

/**
 * Injection token for providing DbxFirebaseModelEntityWithStore context to dynamically loaded widgets.
 */
export const DBX_FIREBASE_MODEL_ENTITY_WITH_STORE_TOKEN = new InjectionToken<DbxFirebaseModelEntityWithStore>('DbxFirebaseModelEntityWithStore');

/**
 * Contains the DbxInjectionComponentConfig for the different injected components a DbxFirebaseModelEntity
 */
export interface DbxFirebaseModelEntitiesWidgetInjectionConfig {
  readonly entry: DbxFirebaseModelEntitiesWidgetEntry;
  readonly entity: DbxFirebaseModelEntityWithStore;
  readonly entityComponentConfig?: Maybe<DbxInjectionComponentConfig<unknown>>;
  readonly commonComponentConfig?: Maybe<DbxInjectionComponentConfig<unknown>>;
  readonly debugComponentConfig?: Maybe<DbxInjectionComponentConfig<unknown>>;
}

/**
 * Factory function used to create a DbxFirebaseModelEntitiesWidgetInjectionConfig given the input.
 */
export type DbxFirebaseModelEntitiesWidgetInjectionConfigFactory = (entry: DbxFirebaseModelEntitiesWidgetEntry, entity: DbxFirebaseModelEntityWithStore) => DbxFirebaseModelEntitiesWidgetInjectionConfig;

/**
 * Creates a DbxFirebaseModelEntitiesWidgetInjectionConfigFactory.
 *
 * @param injector Optional injector to use for the components.
 * @returns
 */
export function dbxFirebaseModelEntityWidgetInjectionConfigFactory(injector?: Maybe<Injector>): DbxFirebaseModelEntitiesWidgetInjectionConfigFactory {
  return (entry: DbxFirebaseModelEntitiesWidgetEntry, entity: DbxFirebaseModelEntityWithStore): DbxFirebaseModelEntitiesWidgetInjectionConfig => {
    const providers: StaticProvider[] = [
      {
        provide: DBX_FIREBASE_MODEL_ENTITY_WITH_STORE_TOKEN,
        useValue: entity
      }
    ];

    let entityComponentConfig: Maybe<DbxInjectionComponentConfig<unknown>> = undefined;
    let commonComponentConfig: Maybe<DbxInjectionComponentConfig<unknown>> = undefined;
    let debugComponentConfig: Maybe<DbxInjectionComponentConfig<unknown>> = undefined;

    if (entry.entityComponentClass) {
      entityComponentConfig = {
        componentClass: entry.entityComponentClass,
        injector,
        providers
      };
    }

    if (entry.commonComponentClass) {
      commonComponentConfig = {
        componentClass: entry.commonComponentClass,
        providers
      };
    }

    if (entry.debugComponentClass) {
      debugComponentConfig = {
        componentClass: entry.debugComponentClass,
        providers
      };
    }

    return {
      entry,
      entity,
      entityComponentConfig,
      commonComponentConfig,
      debugComponentConfig
    };
  };
}
