import { Component, ElementRef } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { AbstractPopoverDirective, AnchorForValueFunction, DbxPopoverKey, DbxPopoverService } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { DbxFirebaseModelTypesServiceInstancePair } from '../model.types.service';
import { DbxFirebaseModelTrackerHistoryFilter } from './model.tracker.service';

export interface DbxFirebaseModelHistoryPopoverConfig {
  /**
   * Custom icon
   *
   * Defaults to "history"
   */
  readonly icon?: string;
  /**
   * Custom header text
   *
   * Defaults to "History"
   */
  readonly header?: string;
  /**
   * Custom empty text when no items exist.
   */
  readonly emptyText?: string;
  /**
   * Origin to add the popover to.
   */
  readonly origin: ElementRef;
  /**
   * Optional config to pass to the DbxFirebaseHistoryComponent
   */
  readonly historyFilter?: Maybe<DbxFirebaseModelTrackerHistoryFilter>;
  /**
   * Anchor
   */
  readonly anchorForItem?: Maybe<AnchorForValueFunction<DbxFirebaseModelTypesServiceInstancePair>>;
}

export const DEFAULT_DBX_FIREBASE_MODEL_HISTORY_COMPONENT_POPOVER_KEY = 'history';

@Component({
  templateUrl: './model.history.popover.component.html'
})
export class DbxFirebaseModelHistoryPopoverComponent extends AbstractPopoverDirective<unknown, DbxFirebaseModelHistoryPopoverConfig> {
  static openPopover(popupService: DbxPopoverService, { origin, header, icon, emptyText, historyFilter, anchorForItem }: DbxFirebaseModelHistoryPopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef {
    return popupService.open({
      key: popoverKey ?? DEFAULT_DBX_FIREBASE_MODEL_HISTORY_COMPONENT_POPOVER_KEY,
      origin,
      componentClass: DbxFirebaseModelHistoryPopoverComponent,
      data: {
        header,
        icon,
        emptyText,
        historyFilter,
        anchorForItem
      }
    });
  }

  get config(): DbxFirebaseModelHistoryPopoverConfig {
    return this.popover.data as DbxFirebaseModelHistoryPopoverConfig;
  }

  get icon() {
    return this.config.icon ?? 'history';
  }

  get header() {
    return this.config.header ?? 'History';
  }

  get emptyText() {
    return this.config.header ?? 'History is empty.';
  }

  get historyFilter() {
    return this.config.historyFilter;
  }

  get anchorForItem() {
    return this.config.anchorForItem;
  }

  /**
   * @deprecated Use config instead.
   */
  get params() {
    return this.config;
  }
}

// MARK: Compat
/**
 * @deprecated Use DbxFirebaseModelHistoryPopoverConfig instead.
 */
export type DbxFirebaseModelHistoryPopoverParams = DbxFirebaseModelHistoryPopoverConfig;
