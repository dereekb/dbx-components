import { InjectionToken, Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { PrimativeKey } from '@dereekb/util';
import { DbxListTitleGroupData } from './list.view.value.group.title';
import { MatIconModule } from '@angular/material/icon';
import { NgClass } from '@angular/common';

export const DBX_LIST_TITLE_GROUP_DATA = new InjectionToken<unknown>('DbxListTitleGroupData');

/**
 * Abstract DbxListTitleGroupHeaderComponent that already has the data injected.
 */
export abstract class AbstractDbxListTitleGroupHeaderComponent<O extends PrimativeKey, D extends DbxListTitleGroupData<O>> {
  readonly data = inject<D>(DBX_LIST_TITLE_GROUP_DATA);
}

/**
 * The default group header component.
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
