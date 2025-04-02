import { ChangeDetectionStrategy, Component, InjectionToken, inject } from '@angular/core';
import { DBX_VALUE_LIST_VIEW_ITEM, DbxValueListItem } from './list.view.value';
import { type Maybe } from '@dereekb/util';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { MatIconModule } from '@angular/material/icon';

export const DBX_LIST_VIEW_DEFAULT_META_ICON = new InjectionToken<string>('DBX_LIST_VIEW_DEFAULT_META_ICON');

export interface DbxListViewMetaIconConfig {
  readonly icon?: Maybe<string>;
}

@Component({
  selector: 'dbx-list-view-meta-icon',
  template: `
    <mat-icon class="dbx-list-view-meta-icon">{{ icon }}</mat-icon>
  `,
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxListViewMetaIconComponent {
  readonly item = inject<DbxValueListItem<unknown, DbxListViewMetaIconConfig>>(DBX_VALUE_LIST_VIEW_ITEM, { optional: true });
  readonly defaultIcon = inject<Maybe<string>>(DBX_LIST_VIEW_DEFAULT_META_ICON, { optional: true });

  readonly icon: Maybe<string> = this.item?.meta?.icon ?? this.defaultIcon;

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
