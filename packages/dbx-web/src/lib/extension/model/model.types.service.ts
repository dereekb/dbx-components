import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { map, shareReplay } from 'rxjs/operators';
import { capitalCase } from 'change-case';
import { Observable, BehaviorSubject } from 'rxjs';
import { ArrayOrValue, Building, ModelTypeString, useIterableOrValue } from '@dereekb/util';
import { DbxModelFullState, fromDbxModel } from './state';
import { DbxModelTypeConfiguration, DbxModelTypeConfigurationMap } from './model.types';

export interface DbxModelTypeInfo extends DbxModelTypeConfiguration {
  /**
   * Whether or not a response is expected for segues
   * to a view for objects of this type.
   */
  canSegueToView: boolean;
}

export interface DbxModelTypesMap<I extends DbxModelTypeInfo> {
  readonly [type: string]: I;
}

export interface DbxModelIconsMap {
  readonly [type: string]: string;
}

@Injectable({
  providedIn: 'root'
})
export class DbxModelTypesService<I extends DbxModelTypeInfo = DbxModelTypeInfo> {
  private _configs = new BehaviorSubject<DbxModelTypeConfigurationMap>({});

  static readonly DEFAULT_ICON = 'help_outline';

  constructor(readonly store: Store<DbxModelFullState>) {}

  // MARK: Configuration
  addTypeConfigs(configs: ArrayOrValue<DbxModelTypeConfiguration>) {
    const types = {
      ...this._configs.value
    };

    useIterableOrValue(configs, (config) => {
      types[config.modelType] = config;
    });

    this._configs.next(types);
  }

  addTypeConfigsMap(configs: DbxModelTypeConfigurationMap) {
    const newConfig: DbxModelTypeConfigurationMap = {
      ...this._configs.value,
      ...configs
    };

    this._configs.next(newConfig);
  }

  // MARK: Accessors
  readonly typesMap$ = this._configs.pipe(
    map((types) => {
      const typesMap: Building<DbxModelTypesMap<I>> = {};

      Object.keys(types).forEach((type) => {
        const config = types[type];

        const label = config.label || capitalCase(type);
        const analyticsName = config.analyticsName || label;

        typesMap[type] = {
          ...config,
          label,
          analyticsName,
          icon: config.icon ?? DbxModelTypesService.DEFAULT_ICON,
          canSegueToView: Boolean(config.sref)
        } as I;
      });

      return typesMap as DbxModelTypesMap<I>;
    }),
    shareReplay(1)
  );

  readonly iconMap$: Observable<DbxModelIconsMap> = this.typesMap$.pipe(
    map((types) => {
      const iconsMap: Building<DbxModelIconsMap> = {};

      Object.keys(types).forEach((type) => {
        iconsMap[type] = types[type].icon;
      });

      return iconsMap as DbxModelIconsMap;
    }),
    shareReplay(1)
  );

  iconForType(type: ModelTypeString): Observable<string> {
    return this.iconMap$.pipe(map((x) => x[type]));
  }
}

function addModelTypeConfigsToTypes(currentTypes: DbxModelTypeConfigurationMap, configs: ArrayOrValue<DbxModelTypeConfiguration>) {
  const types = {
    ...currentTypes
  };

  useIterableOrValue(configs, (config) => {
    types[config.modelType] = config;
  });

  return types;
}
