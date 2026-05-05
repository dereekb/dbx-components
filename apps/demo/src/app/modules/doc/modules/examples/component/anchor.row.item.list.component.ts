import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionListViewDirective, AbstractDbxValueListViewItemComponent, type DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DbxSelectionValueListViewComponentImportsModule, DbxColorDirective, DbxIconTileComponent } from '@dereekb/dbx-web';
import { type AnchorRowItemValue, type AnchorRowItemValueWithSelection } from './anchor.row.item.list';

/**
 * Demo wrapper that renders {@link AnchorRowItemValue} items as a
 * `.dbx-list-two-line-item` row with a template-painted icon tile, progress
 * bar, and a trailing chevron — but **no** trailing button. The row itself is
 * the click target; the host applies
 * `dbxListItemModifier [dbxListItemAnchorModifier]="..."` to wire each row's
 * `ClickableAnchor` from a host-supplied {@link AnchorForValueFunction}, so
 * the data stays free of routing/onClick concerns.
 */
@Component({
  selector: 'doc-anchor-row-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dbx-list-card-items-list'
  },
  standalone: true
})
export class DocAnchorRowItemListComponent extends AbstractDbxSelectionListWrapperDirective<AnchorRowItemValue> {
  constructor() {
    super({
      componentClass: DocAnchorRowItemListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'doc-anchor-row-item-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DocAnchorRowItemListViewComponent),
  host: {
    class: 'dbx-list-item-p0'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocAnchorRowItemListViewComponent extends AbstractDbxSelectionListViewDirective<AnchorRowItemValue> {
  readonly config: DbxSelectionValueListViewConfig<AnchorRowItemValueWithSelection> = {
    componentClass: DocAnchorRowItemListViewItemComponent,
    mapValuesToItemValues: (values) => of(values.map((value) => ({ ...value, itemValue: value, icon: undefined })))
  };
}

@Component({
  selector: 'doc-anchor-row-item-list-view-item',
  template: `
    <div class="dbx-list-item-padded-thick dbx-list-two-line-item dbx-list-two-line-item-with-icon">
      <dbx-icon-tile class="item-icon" [icon]="icon" [dbxColor]="'primary'" [dbxColorTone]="18"></dbx-icon-tile>
      <div class="item-left">
        <span class="dbx-text-title-medium dbx-pb1">{{ title }}</span>
        <span class="item-details dbx-pb2">{{ progress }} of {{ total }} complete</span>
        <mat-progress-bar mode="determinate" [value]="progressPercent"></mat-progress-bar>
      </div>
      <div class="item-right">
        <mat-icon>chevron_right</mat-icon>
      </div>
    </div>
  `,
  imports: [MatIconModule, MatProgressBar, DbxColorDirective, DbxIconTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocAnchorRowItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<AnchorRowItemValue> {
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
