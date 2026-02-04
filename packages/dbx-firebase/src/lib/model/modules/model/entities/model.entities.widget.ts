import { InjectionToken, Injector, Provider, StaticProvider } from '@angular/core';
import { DbxFirebaseModelEntity } from './model.entities';
import { DbxFirebaseModelEntitiesWidgetEntry } from './model.entities.widget.service';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

/**
 * Injection token for providing DbxFirebaseModelEntity context to dynamically loaded widgets.
 */
export const DBX_FIREBASE_MODEL_ENTITY_DATA = new InjectionToken<DbxFirebaseModelEntity>('DbxFirebaseModelEntityData');

/**
 * Contains the DbxInjectionComponentConfig for the different injected components a DbxFirebaseModelEntity
 */
export interface DbxFirebaseModelEntitiesWidgetInjectionConfig {
  readonly entry: DbxFirebaseModelEntitiesWidgetEntry;
  readonly entity: DbxFirebaseModelEntity;
  readonly entityComponentConfig?: Maybe<DbxInjectionComponentConfig<unknown>>;
  readonly commonComponentConfig?: Maybe<DbxInjectionComponentConfig<unknown>>;
  readonly debugComponentConfig?: Maybe<DbxInjectionComponentConfig<unknown>>;
}

/**
 * Factory function used to create a DbxFirebaseModelEntitiesWidgetInjectionConfig given the input.
 */
export type DbxFirebaseModelEntitiesWidgetInjectionConfigFactory = (entry: DbxFirebaseModelEntitiesWidgetEntry, entity: DbxFirebaseModelEntity) => DbxFirebaseModelEntitiesWidgetInjectionConfig;

/**
 * Creates a DbxFirebaseModelEntitiesWidgetInjectionConfigFactory.
 *
 * @param injector Optional injector to use for the components.
 * @returns
 */
export function dbxFirebaseModelEntityWidgetInjectionConfigFactory(injector?: Maybe<Injector>): DbxFirebaseModelEntitiesWidgetInjectionConfigFactory {
  return (entry: DbxFirebaseModelEntitiesWidgetEntry, entity: DbxFirebaseModelEntity): DbxFirebaseModelEntitiesWidgetInjectionConfig => {
    const providers: StaticProvider[] = [
      {
        provide: DBX_FIREBASE_MODEL_ENTITY_DATA,
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
