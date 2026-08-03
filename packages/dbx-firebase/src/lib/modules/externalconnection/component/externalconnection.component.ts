import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { type Maybe } from '@dereekb/util';
import { DbxActionButtonDirective, DbxActionDirective, DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { DbxActionConfirmDirective, DbxActionErrorDirective, DbxButtonComponent, DbxChipDirective, DbxColorDirective, DbxErrorComponent, DbxIconTileComponent, type DbxThemeColor } from '@dereekb/dbx-web';
import { type DbxFirebaseExternalConnectionActionConfig, type DbxFirebaseExternalConnectionRow } from '../service/externalconnection';

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
 * Renders one third-party connection: its brand, its current state for the signed-in user, and the
 * actions available for it.
 *
 * Presentational. It injects nothing and holds no subscription — the row's entry arrives as a plain
 * input from the container, which reads every provider's state from ONE document.
 */
@Component({
  selector: 'dbx-firebase-external-connection',
  template: `
    @if (row(); as rowValue) {
      <div class="dbx-flex-bar dbx-pb1">
        <dbx-icon-tile class="dbx-icon-spacer dbx-firebase-external-connection-tile" [icon]="iconSignal()" [dbxColor]="statusColorSignal()" [dbxColorTone]="18">
          @if (rowValue.assets.logoUrl) {
            <img [src]="rowValue.assets.logoUrl" [alt]="rowValue.assets.providerName" [style.filter]="rowValue.assets.logoFilter" />
          }
        </dbx-icon-tile>
        <div class="dbx-flex-fill">
          <div class="dbx-text-title-medium">{{ rowValue.assets.providerName }}</div>
          @if (detailSignal(); as detail) {
            <div class="dbx-text-body-small dbx-hint">{{ detail }}</div>
          }
        </div>
        <dbx-chip [small]="true" [color]="statusColorSignal()">{{ statusLabelSignal() }}</dbx-chip>
      </div>

      @if (rowValue.entry?.coa; as connectedAt) {
        @if (rowValue.status === 'connected') {
          <div class="dbx-text-body-small dbx-hint">Connected {{ connectedAt | date: 'medium' }}</div>
        }
      }

      <div class="dbx-flex-bar dbx-pt2">
        @for (action of actionsSignal(); track action.label) {
          <!-- dbxActionValue is not used: each action's handler takes no input and the confirm (when present) marks it ready -->
          <div dbxAction [dbxActionHandler]="action.handler" [dbxActionConfirm]="action.confirm">
            <dbx-button dbxActionButton [stroked]="true" [text]="action.label" [icon]="action.icon"></dbx-button>
            <dbx-error dbxActionError></dbx-error>
          </div>
        }
      </div>
    }
  `,
  host: {
    class: 'd-block dbx-firebase-external-connection'
  },
  standalone: true,
  imports: [DatePipe, DbxActionButtonDirective, DbxActionConfirmDirective, DbxActionDirective, DbxActionErrorDirective, DbxActionHandlerDirective, DbxButtonComponent, DbxChipDirective, DbxColorDirective, DbxErrorComponent, DbxIconTileComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseExternalConnectionComponent {
  readonly row = input<Maybe<DbxFirebaseExternalConnectionRow>>();

  /**
   * Actions for this row. An ARRAY because the `error` status offers both Reconnect and Disconnect.
   */
  readonly actions = input<Maybe<DbxFirebaseExternalConnectionActionConfig[]>>();

  readonly actionsSignal = computed(() => this.actions() ?? []);

  readonly statusLabelSignal = computed(() => {
    const status = this.row()?.status;
    return status ? CONNECTION_STATUS_LABELS[status] : '';
  });

  readonly statusColorSignal = computed<DbxThemeColor>(() => {
    const status = this.row()?.status;
    return status ? CONNECTION_STATUS_COLORS[status] : 'grey';
  });

  readonly iconSignal = computed(() => {
    const rowValue = this.row();
    // the logo image is projected into the tile when there is one, so the icon is the fallback.
    return rowValue?.assets.logoUrl ? '' : (rowValue?.assets.icon ?? 'link');
  });

  /**
   * The line under the provider name: which account is connected, or what the provider is for.
   */
  readonly detailSignal = computed(() => {
    const rowValue = this.row();
    let result: Maybe<string>;

    if (rowValue?.status === 'connected' || rowValue?.status === 'error') {
      result = rowValue.entry?.l ?? rowValue.entry?.ea ?? rowValue.assets.description;
    } else {
      result = rowValue?.assets.description;
    }

    return result;
  });
}
