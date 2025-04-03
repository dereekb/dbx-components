import { ChangeDetectionStrategy, Component, ElementRef } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { AbstractPopoverDirective, AnchorForValueFunction, DbxListEmptyContentComponent, DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverKey, DbxPopoverScrollContentComponent, DbxPopoverService } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';
import { DbxFirebaseModelTypesServiceInstancePair } from '../model.types.service';
import { DbxFirebaseModelTrackerHistoryFilter } from './model.tracker.service';
import { DbxFirebaseModelHistoryComponent } from './model.history.component';

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

export type DbxFirebaseModelHistoryPopoverConfigWithoutOrigin = Omit<DbxFirebaseModelHistoryPopoverConfig, 'origin'>;

export const DEFAULT_DBX_FIREBASE_MODEL_HISTORY_COMPONENT_POPOVER_KEY = 'history';

@Component({
  templateUrl: './model.history.popover.component.html',
  imports: [DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverScrollContentComponent, DbxFirebaseModelHistoryComponent, DbxListEmptyContentComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
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

  readonly icon = this.config.icon ?? 'history';
  readonly header = this.config.header ?? 'History';
  readonly emptyText = this.config.emptyText ?? 'History is empty.';
  readonly historyFilter = this.config.historyFilter;
  readonly anchorForItem = this.config.anchorForItem;
}
