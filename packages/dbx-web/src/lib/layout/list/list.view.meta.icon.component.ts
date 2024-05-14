import { Component, Inject, InjectionToken, Optional } from '@angular/core';
import { DBX_VALUE_LIST_VIEW_ITEM, DbxValueListItem } from './list.view.value';
import { Maybe } from '@dereekb/util';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';

export const DBX_LIST_VIEW_DEFAULT_META_ICON = new InjectionToken<string>('DBX_LIST_VIEW_DEFAULT_META_ICON');

export interface DbxListViewMetaIconConfig {
  readonly icon?: Maybe<string>;
}

@Component({
  selector: 'dbx-list-view-meta-icon',
  template: `
    <mat-icon class="dbx-list-view-meta-icon">{{ icon }}</mat-icon>
  `
})
export class DbxListViewMetaIconComponent {
  readonly icon: Maybe<string>;

  constructor(@Optional() @Inject(DBX_VALUE_LIST_VIEW_ITEM) item: DbxValueListItem<unknown, DbxListViewMetaIconConfig>, @Optional() @Inject(DBX_LIST_VIEW_DEFAULT_META_ICON) defaultIcon: Maybe<string>) {
    this.icon = item.meta?.icon ?? defaultIcon;
  }

  static metaConfig(defaultIcon?: Maybe<string>): DbxInjectionComponentConfig<DbxListViewMetaIconConfig> {
    return {
      componentClass: DbxListViewMetaIconComponent,
      providers: [
        {
          provide: DBX_LIST_VIEW_DEFAULT_META_ICON,
          useValue: defaultIcon
        }
      ]
    };
  }
}
