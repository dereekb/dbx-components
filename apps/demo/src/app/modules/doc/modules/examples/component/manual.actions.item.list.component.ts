import { ChangeDetectionStrategy, Component } from '@angular/core';
import { of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { AbstractDbxSelectionListWrapperDirective, AbstractDbxSelectionListViewDirective, AbstractDbxValueListViewItemComponent, type DbxSelectionValueListViewConfig, provideDbxListView, DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE, DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE, DbxListWrapperComponentImportsModule, DbxSelectionValueListViewComponentImportsModule, DbxAnchorComponent, DbxButtonComponent } from '@dereekb/dbx-web';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { type ManualActionItemValue, type ManualActionItemValueWithSelection } from './manual.actions.item.list';

/**
 * Demo wrapper that renders {@link ManualActionItemValue} items as hover-free
 * `.dbx-list-two-line-item` rows (no leading icon tile) with a trailing action
 * button wrapping a per-item {@link ClickableAnchor} via `<dbx-anchor>`.
 *
 * Modeled on {@link DocWorthKnowingItemListComponent}: the wrapper host applies
 * `dbx-list-no-hover-effects` (no hover cursor/state layer) and
 * `mapValuesToItemValues` leaves `item.anchor` undefined so the row hosting
 * doesn't pick up the anchor as a row-click target. Only the trailing button is
 * interactive; the emphasized "refresh" action renders raised + primary while
 * the rest render stroked.
 *
 * The host also applies `dbx-list-auto-height` so the list sizes to its rows —
 * this list flows inline with other card content (a dashed CTA box renders
 * below it), where the `.dbx-list` default `height: 100%` would resolve
 * against the stretched card and push that trailing content out of the card.
 */
@Component({
  selector: 'doc-manual-actions-item-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-list-auto-height dbx-list-no-hover-effects dbx-list-no-item-padding'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocManualActionsItemListComponent extends AbstractDbxSelectionListWrapperDirective<ManualActionItemValue> {
  constructor() {
    super({
      componentClass: DocManualActionsItemListViewComponent,
      defaultSelectionMode: 'view'
    });
  }
}

@Component({
  selector: 'doc-manual-actions-item-list-view',
  template: DEFAULT_DBX_SELECTION_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxSelectionValueListViewComponentImportsModule],
  providers: provideDbxListView(DocManualActionsItemListViewComponent),
  host: {
    class: 'dbx-list-item-p0'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocManualActionsItemListViewComponent extends AbstractDbxSelectionListViewDirective<ManualActionItemValue> {
  // Drop `icon` (rows render no tile) and `anchor` (button owns it; row stays non-clickable).
  readonly config: DbxSelectionValueListViewConfig<ManualActionItemValueWithSelection> = {
    componentClass: DocManualActionsItemListViewItemComponent,
    mapValuesToItemValues: (values) => of(values.map((value) => ({ ...value, itemValue: value, icon: undefined, anchor: undefined })))
  };
}

@Component({
  selector: 'doc-manual-actions-item-list-view-item',
  template: `
    <div class="dbx-list-item-padded dbx-list-two-line-item">
      <div class="item-left">
        <span class="dbx-text-title-medium">{{ title }}</span>
        <span class="item-details">{{ detail }}</span>
      </div>
      <div class="item-right">
        <dbx-anchor [anchor]="anchor">
          @if (buttonRaised) {
            <dbx-button [raised]="true" color="primary" class="dbx-nowrap" [text]="buttonText"></dbx-button>
          } @else {
            <dbx-button [stroked]="true" class="dbx-nowrap" [text]="buttonText"></dbx-button>
          }
        </dbx-anchor>
      </div>
    </div>
  `,
  imports: [MatButtonModule, DbxButtonComponent, DbxAnchorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DocManualActionsItemListViewItemComponent extends AbstractDbxValueListViewItemComponent<ManualActionItemValue> {
  get title(): string {
    return this.itemValue.title;
  }

  get detail(): string {
    return this.itemValue.detail;
  }

  get buttonText(): string {
    return this.itemValue.buttonText;
  }

  get buttonRaised(): Maybe<boolean> {
    return this.itemValue.buttonRaised;
  }

  get anchor(): Maybe<ClickableAnchor> {
    return this.itemValue.anchor;
  }
}
