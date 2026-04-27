import { InjectionToken, Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { type PrimativeKey } from '@dereekb/util';
import { type DbxListTitleGroupData } from './list.view.value.group.title';
import { MatIconModule } from '@angular/material/icon';
import { NgClass } from '@angular/common';

/**
 * Injection token that provides the {@link DbxListTitleGroupData} to group header components.
 */
export const DBX_LIST_TITLE_GROUP_DATA = new InjectionToken<unknown>('DbxListTitleGroupData');

/**
 * Abstract base class for group header components. Automatically injects the {@link DbxListTitleGroupData}
 * via the {@link DBX_LIST_TITLE_GROUP_DATA} token. Extend this to create custom group header renderers.
 */
export abstract class AbstractDbxListTitleGroupHeaderComponent<O extends PrimativeKey, D extends DbxListTitleGroupData<O>> {
  readonly data = inject<D>(DBX_LIST_TITLE_GROUP_DATA);
}

/**
 * Default group header component that displays a title, optional icon, and optional hint text.
 * Used automatically by {@link DbxListTitleGroupDirective} unless a custom header component is specified.
 *
 * @dbxWebComponent
 * @dbxWebSlug list-title-group-header
 * @dbxWebCategory list
 * @dbxWebRelated list, list-view
 * @dbxWebSkillRefs dbx__ref__dbx-component-patterns
 * @dbxWebMinimalExample ```html
 * <dbx-list-title-group-header></dbx-list-title-group-header>
 * ```
 *
 * @example
 * ```html
 * <dbx-list-view [config]="rowConfig" dbxListTitleGroup></dbx-list-view>
 * ```
 */
@Component({
  selector: 'dbx-list-title-group-header',
  template: `
    <div class="dbx-list-item-padded dbx-list-two-line-item" [ngClass]="{ 'dbx-list-two-line-item-with-icon': icon }">
      @if (icon) {
        <mat-icon class="item-icon">{{ icon }}</mat-icon>
      }
      <div class="item-left">
        <div class="mat-subtitle-2">{{ title }}</div>
        @if (hint) {
          <div class="item-details">{{ hint }}</div>
        }
      </div>
    </div>
  `,
  imports: [NgClass, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dbx-list-title-group-header'
  },
  standalone: true
})
export class DbxListTitleGroupHeaderComponent<O extends PrimativeKey, D extends DbxListTitleGroupData<O>> extends AbstractDbxListTitleGroupHeaderComponent<O, D> {
  readonly icon = this.data.icon;
  readonly title = this.data.title;
  readonly hint = this.data.hint;
}
