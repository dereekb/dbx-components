import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBar } from '@angular/material/progress-bar';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionListViewDirective, AbstractDbxValueListViewItemComponent, type DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DbxSelectionValueListViewComponentImportsModule, DbxColorDirective, DbxIconTileComponent, DbxAnchorComponent } from '@dereekb/dbx-web';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type AnchorButtonItemValue, type AnchorButtonItemValueWithSelection } from './anchor.button.item.list';

/**
 * Demo wrapper that renders {@link AnchorButtonItemValue} items as a customised
 * `.dbx-list-two-line-item` row whose trailing button wraps a per-item
 * {@link ClickableAnchor} via `<dbx-anchor>`.
 *
 * The row itself stays non-clickable: `mapValuesToItemValues` intentionally
 * leaves `item.anchor` undefined so the list's row hosting doesn't pick up
 * the anchor as a row-click target. Only the trailing button is interactive,
 * scoped to the action surface where the user expects it.
 */
@Component({
  selector: 'doc-anchor-button-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-list-no-hover-effects dbx-list-card-items-list'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocAnchorButtonItemListComponent extends AbstractDbxSelectionListWrapperDirective<AnchorButtonItemValue> {
  constructor() {
    super({
      componentClass: DocAnchorButtonItemListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'doc-anchor-button-item-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DocAnchorButtonItemListViewComponent),
  host: {
    class: 'dbx-list-item-p0'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocAnchorButtonItemListViewComponent extends AbstractDbxSelectionListViewDirective<AnchorButtonItemValue> {
  // Drop `icon` (template paints its own tile) and `anchor` (button owns it; row stays non-clickable).
  readonly config: DbxSelectionValueListViewConfig<AnchorButtonItemValueWithSelection> = {
    componentClass: DocAnchorButtonItemListViewItemComponent,
    mapValuesToItemValues: (values) => of(values.map((value) => ({ ...value, itemValue: value, icon: undefined, anchor: undefined })))
  };
}

@Component({
  selector: 'doc-anchor-button-item-list-view-item',
  template: `
    <div class="dbx-list-item-padded-thick dbx-list-two-line-item dbx-list-two-line-item-with-icon">
      <dbx-icon-tile class="item-icon" [icon]="icon" [dbxColor]="'primary'" [dbxColorTone]="18"></dbx-icon-tile>
      <div class="item-left">
        <span class="dbx-text-title-medium dbx-pb1">{{ title }}</span>
        <span class="item-details dbx-pb2">{{ progress }} of {{ total }} complete</span>
        <mat-progress-bar mode="determinate" [value]="progressPercent"></mat-progress-bar>
      </div>
      <div class="item-right">
        <dbx-anchor [anchor]="anchor">
          <button mat-flat-button>{{ buttonText }}</button>
        </dbx-anchor>
      </div>
    </div>
  `,
  imports: [MatButtonModule, MatProgressBar, DbxColorDirective, DbxIconTileComponent, DbxAnchorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocAnchorButtonItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<AnchorButtonItemValue> {
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

  get buttonText(): string {
    return this.itemValue.buttonText;
  }

  get anchor(): ClickableAnchor {
    return this.itemValue.anchor;
  }

  get progressPercent(): number {
    return this.total > 0 ? Math.min(100, Math.round((this.progress / this.total) * 100)) : 0;
  }
}
