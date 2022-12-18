import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { map, shareReplay } from 'rxjs/operators';
import { capitalCase } from 'change-case';
import { Observable } from 'rxjs';
import { Building, ModelTypeString } from '@dereekb/util';
import { DbxModelFullState, fromDbxModel } from './state';
import { DbxModelModuleStateTypeConfiguration } from './state/config';

export interface DbxModelTypeInfo extends DbxModelModuleStateTypeConfiguration {
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
export class DbxModelTypesService<I extends DbxModelTypeInfo> {
  static readonly DEFAULT_ICON = 'help_outline';

  constructor(readonly store: Store<DbxModelFullState>) {}

  readonly typesMap$ = this.store.select(fromDbxModel.selectDbxModelFeatureObjectModuleTypesConfig).pipe(
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
