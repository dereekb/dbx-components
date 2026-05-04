import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBar } from '@angular/material/progress-bar';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionListViewDirective, AbstractDbxValueListViewItemComponent, type DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DbxSelectionValueListViewComponentImportsModule, DbxColorDirective } from '@dereekb/dbx-web';
import { type ProgressItemValue, type ProgressItemValueWithSelection } from './progress.item.list';

/**
 * Demo wrapper that renders {@link ProgressItemValue} items as a customized
 * `.dbx-list-two-line-item` row with a template-painted icon tile, a
 * full-width progress bar, and a trailing action button.
 *
 * Composed utilities:
 * - `.dbx-list-two-line-item-with-icon` — flags the template-supplied leading
 *   icon so the parent list view skips its built-in icon slot (the mapped
 *   item also drops its `icon` field to belt-and-suspenders this).
 * - `.dbx-icon-tile` — reusable rounded/padded icon container, paired with
 *   `[dbxColor]` + `[dbxColorTone]` for a tonal background.
 * - `.dbx-list-item-padded-thick` — roomier row padding (`--dbx-padding-3`).
 * - `.dbx-list-item-card` — tinted, rounded surface around the row. Defaults
 *   to `--mat-sys-surface-container` + `--mat-sys-corner-large` (16px); both
 *   are overridable via `--dbx-list-item-card-background` /
 *   `--dbx-list-item-card-border-radius`.
 * - `.dbx-list-item-p0` — host class on the value-list view that zeroes
 *   Material's default list-item padding so the tile owns the leading inset.
 * - `.dbx-list-no-hover-effects` — host class on the wrapper that disables
 *   the hover state-layer and pointer cursor (rows aren't clickable here).
 */
@Component({
  selector: 'doc-progress-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-list-no-hover-effects'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocProgressItemListComponent extends AbstractDbxSelectionListWrapperDirective<ProgressItemValue> {
  constructor() {
    super({
      componentClass: DocProgressItemListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'doc-progress-item-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DocProgressItemListViewComponent),
  host: {
    class: 'dbx-list-item-p0'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocProgressItemListViewComponent extends AbstractDbxSelectionListViewDirective<ProgressItemValue> {
  readonly config: DbxSelectionValueListViewConfig<ProgressItemValueWithSelection> = {
    componentClass: DocProgressItemListViewItemComponent,
    mapValuesToItemValues: (values) => of(values.map((value) => ({ ...value, itemValue: value, icon: undefined })))
  };
}

@Component({
  selector: 'doc-progress-item-list-view-item',
  template: `
    <div class="dbx-list-item-padded-thick dbx-list-item-card dbx-list-two-line-item dbx-list-two-line-item-with-icon doc-progress-item">
      <div class="item-icon dbx-icon-tile" [dbxColor]="'primary'" [dbxColorTone]="18">
        <mat-icon>{{ icon }}</mat-icon>
      </div>
      <div class="item-left">
        <span class="doc-progress-item-title">{{ title }}</span>
        <span class="item-details">{{ progress }} of {{ total }} complete</span>
        <mat-progress-bar class="doc-progress-item-bar" mode="determinate" [value]="progressPercent"></mat-progress-bar>
      </div>
      <div class="item-right">
        <button mat-flat-button>View requirements</button>
      </div>
    </div>
  `,
  styles: [
    `
      .doc-progress-item-title {
        font-size: 1em;
        font-weight: 600;
      }

      .doc-progress-item-bar {
        margin-top: 6px;
      }
    `
  ],
  imports: [MatIconModule, MatButtonModule, MatProgressBar, DbxColorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocProgressItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<ProgressItemValue> {
  get icon(): string {
    return this.itemValue.icon;
  }

  get title(): string {
    return this.itemValue.title;
  }

  get progress(): number {
    return this.itemValue.progress;
  }

  get total(): number {
    return this.itemValue.total;
  }

  get progressPercent(): number {
    return this.total > 0 ? Math.min(100, Math.round((this.progress / this.total) * 100)) : 0;
  }
}
