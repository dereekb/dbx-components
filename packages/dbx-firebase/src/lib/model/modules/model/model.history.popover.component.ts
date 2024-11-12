import { Component, ElementRef } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { AbstractPopoverDirective, AnchorForValueFunction, DbxPopoverComponent, DbxPopoverKey, DbxPopoverService } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseModelTypesServiceInstancePair } from './model.types.service';
import { DbxFirebaseModelTrackerHistoryFilter } from './model.tracker.service';

export interface DbxFirebaseModelHistoryPopoverParams {
  /**
   * Custom icon
   *
   * Defaults to "history"
   */
  icon?: string;
  /**
   * Custom header text
   *
   * Defaults to "History"
   */
  header?: string;
  /**
   * Custom empty text when no items exist.
   */
  emptyText?: string;
  /**
   * Origin to add the popover to.
   */
  origin: ElementRef;
  /**
   * Optional config to pass to the DbxFirebaseHistoryComponent
   */
  historyFilter?: Maybe<DbxFirebaseModelTrackerHistoryFilter>;
  /**
   * Anchor
   */
  anchorForItem?: Maybe<AnchorForValueFunction<DbxFirebaseModelTypesServiceInstancePair>>;
}

export const DEFAULT_FIREBASE_HISTORY_COMPONENT_POPOVER_KEY = 'history';

@Component({
  templateUrl: './model.history.popover.component.html'
})
export class DbxFirebaseModelHistoryPopoverComponent extends AbstractPopoverDirective<unknown, DbxFirebaseModelHistoryPopoverParams> {
  static openPopover(popupService: DbxPopoverService, { origin, header, icon, emptyText, historyFilter, anchorForItem }: DbxFirebaseModelHistoryPopoverParams, popoverKey?: DbxPopoverKey): NgPopoverRef {
    return popupService.open({
      key: popoverKey ?? DEFAULT_FIREBASE_HISTORY_COMPONENT_POPOVER_KEY,
      origin,
      componentClass: DbxFirebaseModelHistoryPopoverComponent,
      data: {
        header,
        icon,
        emptyText,
        historyFilter,
        anchorForItem
      } as DbxFirebaseModelHistoryPopoverParams
    });
  }

  get params(): DbxFirebaseModelHistoryPopoverParams {
    return this.popover.data as DbxFirebaseModelHistoryPopoverParams;
  }

  get icon() {
    return this.params.icon ?? 'history';
  }

  get header() {
    return this.params.header ?? 'History';
  }

  get emptyText() {
    return this.params.header ?? 'History is empty.';
  }

  get historyFilter() {
    return this.params.historyFilter;
  }

  get anchorForItem() {
    return this.params.anchorForItem;
  }
}
