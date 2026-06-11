import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionListViewDirective, AbstractDbxValueListViewItemComponent, type DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DbxSelectionValueListViewComponentImportsModule, DbxColorDirective, DbxIconTileComponent, DbxAnchorComponent } from '@dereekb/dbx-web';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type WorthKnowingItemValue, type WorthKnowingItemValueWithSelection } from './worth.knowing.item.list';

/**
 * Demo wrapper that renders {@link WorthKnowingItemValue} items as plain
 * informational `.dbx-list-two-line-item` rows with an optional trailing
 * action button wrapping a per-item {@link ClickableAnchor} via `<dbx-anchor>`.
 *
 * The rows are intentionally non-interactive: the wrapper host applies
 * `dbx-list-no-hover-effects` (no hover cursor/state layer) and
 * `mapValuesToItemValues` leaves `item.anchor` undefined so the row hosting
 * doesn't pick up the anchor as a row-click target. Only the trailing button
 * (when present) is interactive.
 */
@Component({
  selector: 'doc-worth-knowing-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-list-no-hover-effects'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocWorthKnowingItemListComponent extends AbstractDbxSelectionListWrapperDirective<WorthKnowingItemValue> {
  constructor() {
    super({
      componentClass: DocWorthKnowingItemListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'doc-worth-knowing-item-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DocWorthKnowingItemListViewComponent),
  host: {
    class: 'dbx-list-item-p0'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocWorthKnowingItemListViewComponent extends AbstractDbxSelectionListViewDirective<WorthKnowingItemValue> {
  // Drop `icon` (template paints its own tile) and `anchor` (button owns it; row stays non-clickable).
  readonly config: DbxSelectionValueListViewConfig<WorthKnowingItemValueWithSelection> = {
    componentClass: DocWorthKnowingItemListViewItemComponent,
    mapValuesToItemValues: (values) => of(values.map((value) => ({ ...value, itemValue: value, icon: undefined, anchor: undefined })))
  };
}

@Component({
  selector: 'doc-worth-knowing-item-list-view-item',
  template: `
    <div class="dbx-list-item-padded dbx-list-two-line-item dbx-list-two-line-item-with-icon">
      <dbx-icon-tile class="item-icon" [icon]="icon" [dbxColor]="'primary'" [dbxColorTone]="18"></dbx-icon-tile>
      <div class="item-left">
        <span class="dbx-text-title-medium">{{ title }}</span>
        <span class="item-details">{{ detail }}</span>
      </div>
      @if (buttonText) {
        <div class="item-right">
          <dbx-anchor [anchor]="anchor">
            <button mat-stroked-button class="dbx-nowrap">{{ buttonText }}</button>
          </dbx-anchor>
        </div>
      }
    </div>
  `,
  imports: [MatButtonModule, DbxColorDirective, DbxIconTileComponent, DbxAnchorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocWorthKnowingItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<WorthKnowingItemValue> {
  get icon(): string {
    return this.itemValue.icon;
  }

  get title(): string {
    return this.itemValue.title;
  }

  get detail(): string {
    return this.itemValue.detail;
  }

  get buttonText(): Maybe<string> {
    return this.itemValue.buttonText;
  }

  get anchor(): Maybe<ClickableAnchor> {
    return this.itemValue.anchor;
  }
}
