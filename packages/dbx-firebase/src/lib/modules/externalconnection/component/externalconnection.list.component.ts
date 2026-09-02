import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { of } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionHandlerDirective } from '@dereekb/dbx-core';
import {
  AbstractDbxListViewDirective,
  AbstractDbxListWrapperDirective,
  AbstractDbxValueListViewItemComponent,
  DbxActionConfirmDirective,
  DbxActionErrorDirective,
  DbxAvatarComponent,
  DbxButtonComponent,
  DbxChipDirective,
  DbxErrorComponent,
  DbxListWrapperComponentImportsModule,
  DbxValueListViewComponentImportsModule,
  DEFAULT_DBX_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  provideDbxListView,
  type DbxActionConfirmConfig,
  type DbxThemeColor,
  type DbxValueAsListItem,
  type DbxValueListViewConfig
} from '@dereekb/dbx-web';
import { type DbxFirebaseExternalConnectionActionConfig, type DbxFirebaseExternalConnectionListItemValue, type DbxFirebaseExternalConnectionRow } from '../service/externalconnection';

export type DbxFirebaseExternalConnectionListItem = DbxValueAsListItem<DbxFirebaseExternalConnectionListItemValue>;

const CONNECTION_STATUS_LABELS: Record<DbxFirebaseExternalConnectionRow['status'], string> = {
  loading: 'Loading',
  connected: 'Connected',
  notConnected: 'Not connected',
  error: 'Needs attention'
};

const CONNECTION_STATUS_COLORS: Record<DbxFirebaseExternalConnectionRow['status'], DbxThemeColor> = {
  loading: 'grey',
  connected: 'success',
  notConnected: 'grey',
  error: 'warn'
};

/**
 * Fallback icon for a provider whose assets declare neither a logo nor an icon.
 */
const DEFAULT_CONNECTION_ICON = 'link';

/**
 * Used by actions that declare no confirm config, such as Connect, so they run without a dialog.
 *
 * The directive prompts with its defaults for a nullish config, which is not what an action with nothing to
 * confirm wants.
 */
const AUTO_CONFIRM_CONFIG: DbxActionConfirmConfig = { autoConfirm: true };

/**
 * Renders every third-party connection as a card row.
 *
 * Composed list utilities (see `DocProgressItemListComponent` for the same recipe):
 * - `.dbx-list-card-items-list` paints each row as a tinted, rounded card;
 * - `.dbx-list-no-hover-effects` drops the hover state layer, since a row is not clickable — only its buttons are;
 * - `.dbx-list-auto-height` lets the list flow inline inside the settings section rather than filling it.
 *
 * @example
 * ```html
 * <dbx-firebase-external-connection-list [state]="listStateSignal()"></dbx-firebase-external-connection-list>
 * ```
 */
@Component({
  selector: 'dbx-firebase-external-connection-list',
  template: DEFAULT_LIST_WRAPPER_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxListWrapperComponentImportsModule],
  host: {
    class: 'dbx-firebase-external-connection-list dbx-list-auto-height dbx-list-card-items-list dbx-list-no-hover-effects'
  }
})
export class DbxFirebaseExternalConnectionListComponent extends AbstractDbxListWrapperDirective<DbxFirebaseExternalConnectionListItemValue> {
  constructor() {
    super({
      componentClass: DbxFirebaseExternalConnectionListViewComponent
    });
  }
}

@Component({
  selector: 'dbx-firebase-external-connection-list-view',
  template: DEFAULT_DBX_VALUE_LIST_COMPONENT_CONFIGURATION_TEMPLATE,
  imports: [DbxValueListViewComponentImportsModule],
  providers: provideDbxListView(DbxFirebaseExternalConnectionListViewComponent),
  host: {
    // the item template owns all of its padding, including the leading avatar's inset
    class: 'dbx-list-item-p0'
  }
})
export class DbxFirebaseExternalConnectionListViewComponent extends AbstractDbxListViewDirective<DbxFirebaseExternalConnectionListItemValue> {
  readonly config: DbxValueListViewConfig<DbxFirebaseExternalConnectionListItem> = {
    componentClass: DbxFirebaseExternalConnectionListViewItemComponent,
    mapValuesToItemValues: (values) =>
      of(
        values.map((value) => ({
          ...value,
          itemValue: value,
          // the template paints its own leading avatar, so the built-in icon slot stays empty
          icon: undefined,
          // The key carries the row's rendered state, not just its identity. An item value reaches its
          // component through the injected DBX_VALUE_LIST_VIEW_ITEM provider, and
          // `dbxInjectionComponentConfigIsEqual` deliberately ignores the provider array — so under a
          // stable key the component is never recreated and would keep rendering the state it was built
          // with. Here that would pin every row to its initial 'loading' status forever.
          key: `${value.row.providerType}_${value.row.status}_${value.row.entry?.uat?.getTime() ?? 0}`
        }))
      )
  };
}

/**
 * One third-party connection: its brand, its current state for the signed-in user, and the actions available for it.
 *
 * Presentational — the row and its actions arrive as the injected list item, built by the container that reads every
 * provider's state from ONE document.
 */
@Component({
  selector: 'dbx-firebase-external-connection-list-view-item',
  template: `
    <div class="dbx-list-item-padded-thick dbx-firebase-external-connection-item">
      <div class="dbx-flex-bar dbx-pb1">
        <dbx-avatar class="dbx-icon-spacer dbx-firebase-external-connection-tile" [avatarTile]="true" avatarStyle="square" [avatarUrl]="assets.logoUrl" [avatarIcon]="assets.icon ?? defaultIcon" [avatarImageFilter]="assets.logoFilter" [avatarIgnoreDefaultUrl]="true" [avatarColor]="statusColor" [avatarColorTone]="18"></dbx-avatar>
        <div class="dbx-flex-fill">
          <div class="dbx-text-title-medium">{{ assets.providerName }}</div>
          @if (detail; as detailValue) {
            <div class="dbx-text-body-small dbx-hint">{{ detailValue }}</div>
          }
        </div>
        <dbx-chip [small]="true" [color]="statusColor">{{ statusLabel }}</dbx-chip>
      </div>

      @if (connectedAt; as connectedAtValue) {
        <div class="dbx-text-body-small dbx-hint">Connected {{ connectedAtValue | date: 'medium' }}</div>
      }

      @if (actions.length) {
        <div class="dbx-flex-bar dbx-pt2">
          @for (action of actions; track action.label) {
            <!-- dbxActionValue is not used: each action's handler takes no input and the confirm marks it ready, dialog or not -->
            <div dbxAction [dbxActionHandler]="action.handler" [dbxActionConfirm]="action.confirm ?? autoConfirmConfig">
              <dbx-button dbxActionButton [stroked]="true" [text]="action.label" [icon]="action.icon"></dbx-button>
              <dbx-error dbxActionError></dbx-error>
            </div>
          }
        </div>
      }
    </div>
  `,
  imports: [DatePipe, DbxActionButtonDirective, DbxActionConfirmDirective, DbxActionDirective, DbxActionErrorDirective, DbxActionHandlerDirective, DbxAvatarComponent, DbxButtonComponent, DbxChipDirective, DbxErrorComponent]
})
export class DbxFirebaseExternalConnectionListViewItemComponent extends AbstractDbxValueListViewItemComponent<DbxFirebaseExternalConnectionListItemValue> {
  readonly defaultIcon = DEFAULT_CONNECTION_ICON;
  readonly autoConfirmConfig = AUTO_CONFIRM_CONFIG;

  get row(): DbxFirebaseExternalConnectionRow {
    return this.itemValue.row;
  }

  get assets() {
    return this.row.assets;
  }

  /**
   * Actions for this row. An ARRAY because the `error` status offers both Reconnect and Disconnect.
   *
   * @returns The actions to render, empty when there are none.
   */
  get actions(): DbxFirebaseExternalConnectionActionConfig[] {
    return this.itemValue.actions ?? [];
  }

  get statusLabel(): string {
    return CONNECTION_STATUS_LABELS[this.row.status];
  }

  get statusColor(): DbxThemeColor {
    return CONNECTION_STATUS_COLORS[this.row.status];
  }

  get connectedAt(): Maybe<Date> {
    return this.row.status === 'connected' ? this.row.entry?.coa : undefined;
  }

  /**
   * The line under the provider name: which account is connected, or what the provider is for.
   *
   * @returns The detail line, or nullish when there is nothing to say.
   */
  get detail(): Maybe<string> {
    const { status, entry, assets } = this.row;
    let result: Maybe<string>;

    if (status === 'connected' || status === 'error') {
      result = entry?.l ?? entry?.ea ?? assets.description;
    } else {
      result = assets.description;
    }

    return result;
  }
}
