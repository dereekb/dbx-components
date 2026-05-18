import { ChangeDetectionStrategy, Component, InjectionToken, inject } from '@angular/core';
import { DBX_VALUE_LIST_VIEW_ITEM, type DbxValueListItem } from '../list.view.value';
import { type Maybe } from '@dereekb/util';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Injection token for providing a default meta icon string to {@link DbxListViewMetaIconComponent} instances.
 */
export const DEFAULT_DBX_LIST_VIEW_META_ICON = new InjectionToken<string>('DEFAULT_DBX_LIST_VIEW_META_ICON');

/**
 * Configuration interface for the meta icon, specifying which Material icon to display.
 */
export interface DbxListViewMetaIconConfig {
  readonly icon?: Maybe<string>;
}

/**
 * Displays a Material icon in the meta (trailing) area of a list item. Reads its icon from the item's meta
 * configuration or falls back to a default provided via {@link DEFAULT_DBX_LIST_VIEW_META_ICON}.
 *
 * Use the static `metaConfig()` method to create the injection component config for use in list view configurations.
 *
 * @example
 * ```html
 * <dbx-list-view-meta-icon></dbx-list-view-meta-icon>
 * ```
 */
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
  readonly defaultIcon = inject<Maybe<string>>(DEFAULT_DBX_LIST_VIEW_META_ICON, { optional: true });

  readonly icon: Maybe<string> = this.item?.meta?.icon ?? this.defaultIcon;

  static metaConfig(defaultIcon?: Maybe<string>): DbxInjectionComponentConfig<DbxListViewMetaIconConfig> {
    return {
      componentClass: DbxListViewMetaIconComponent,
      providers: [
        {
          provide: DEFAULT_DBX_LIST_VIEW_META_ICON,
          useValue: defaultIcon
        }
      ]
    };
  }
}
