import { Component, InjectionToken, computed, inject, type Signal } from '@angular/core';
import { type DbxValueListItem, injectDbxValueListViewItemSignal } from '../list.view.value';
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
    <mat-icon class="dbx-list-view-meta-icon">{{ iconSignal() }}</mat-icon>
  `,
  imports: [MatIconModule]
})
export class DbxListViewMetaIconComponent {
  readonly itemSignal: Maybe<Signal<DbxValueListItem<unknown, DbxListViewMetaIconConfig>>> = injectDbxValueListViewItemSignal<DbxValueListItem<unknown, DbxListViewMetaIconConfig>>({ optional: true });
  readonly defaultIcon = inject<Maybe<string>>(DEFAULT_DBX_LIST_VIEW_META_ICON, { optional: true });

  readonly iconSignal = computed(() => this.itemSignal?.().meta?.icon ?? this.defaultIcon);

  get item(): Maybe<DbxValueListItem<unknown, DbxListViewMetaIconConfig>> {
    return this.itemSignal?.();
  }

  get icon(): Maybe<string> {
    return this.iconSignal();
  }

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
