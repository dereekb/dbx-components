import { Injectable, Injector, inject } from '@angular/core';
import { capitalCase } from 'change-case-all';
import { map, shareReplay, type Observable, BehaviorSubject } from 'rxjs';
import { type ArrayOrValue, type Building, type ModelTypeString, useIterableOrValue } from '@dereekb/util';
import { type DbxModelTypeConfiguration, type DbxModelTypeConfigurationMap } from './model.types';

/**
 * Resolved model type information, extending configuration with computed properties like navigation capability.
 */
export interface DbxModelTypeInfo extends Omit<DbxModelTypeConfiguration, 'srefFactory'> {
  /**
   * Whether or not a response is expected for segues
   * to a view for objects of this type.
   */
  readonly canSegueToView: boolean;
}

/**
 * Map of model type strings to their resolved {@link DbxModelTypeInfo} entries.
 */
export interface DbxModelTypesMap<I extends DbxModelTypeInfo> {
  readonly [type: string]: I;
}

/**
 * Map of model type strings to their Material icon names.
 */
export interface DbxModelIconsMap {
  readonly [type: string]: string;
}

/**
 * Registry service for model type configurations. Provides reactive access to model type information, icons, and navigation capability. Resolves labels, analytics names, and segue refs from registered configurations.
 *
 * @example
 * ```typescript
 * modelTypesService.addTypeConfigs({ modelType: 'user', label: 'User', icon: 'person' });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class DbxModelTypesService<I extends DbxModelTypeInfo = DbxModelTypeInfo> {
  static readonly DEFAULT_ICON = 'help_outline';

  readonly injector = inject(Injector);

  private readonly _configs = new BehaviorSubject<DbxModelTypeConfigurationMap>({});

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
        const sref = config.srefBuilder ? config.srefBuilder(this.injector) : config.sref;

        typesMap[type] = {
          ...config,
          sref,
          label,
          analyticsName,
          icon: config.icon ?? DbxModelTypesService.DEFAULT_ICON,
          canSegueToView: Boolean(sref)
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
