import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { type Maybe } from '@dereekb/util';
import { beginLoading, isLoadingStateLoading, type LoadingState } from '@dereekb/rxjs';
import { type UserExternalConnectionEntryMap, type UserExternalConnectionProviderType } from '@dereekb/firebase';
import { DbxErrorComponent } from '@dereekb/dbx-web';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { DbxFirebaseExternalConnectionComponent } from '../component/externalconnection.component';
import { type DbxFirebaseExternalConnectionActionConfig, type DbxFirebaseExternalConnectionRow, dbxFirebaseExternalConnectionRows } from '../service/externalconnection';
import { DbxFirebaseExternalConnectionService } from '../service/externalconnection.service';
import { UserExternalConnectionDocumentStore } from '../store/userexternalconnection.document.store';
import { DbxFirebaseUserExternalConnectionsStore } from '../store/userexternalconnection.store';

/**
 * Renders every registered third-party connection for the signed-in user.
 *
 * Owns the stores and makes exactly ONE `toSignal` subscription, which every row is computed from —
 * the payoff of collapsing to one connection document per user. The rows are presentational and take
 * their entry as a plain input rather than loading anything themselves.
 *
 * @example
 * ```html
 * <dbx-firebase-external-connections></dbx-firebase-external-connections>
 * ```
 */
@Component({
  selector: 'dbx-firebase-external-connections',
  template: `
    @if (signedInSignal()) {
      @if (errorSignal(); as error) {
        <dbx-error [error]="error"></dbx-error>
      } @else {
        @for (row of rowsSignal(); track row.providerType) {
          <div class="dbx-firebase-external-connection-row">
            <dbx-firebase-external-connection [row]="row" [actions]="actionsForRow(row)"></dbx-firebase-external-connection>
          </div>
        } @empty {
          <p class="dbx-hint no-margin">There are no apps available to connect.</p>
        }
      }
    } @else {
      <p class="dbx-hint no-margin">Sign in to connect your apps.</p>
    }
  `,
  host: {
    class: 'd-block dbx-firebase-external-connections'
  },
  standalone: true,
  imports: [DbxErrorComponent, DbxFirebaseExternalConnectionComponent],
  providers: [UserExternalConnectionDocumentStore, DbxFirebaseUserExternalConnectionsStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseExternalConnectionsComponent {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly dbxFirebaseExternalConnectionService = inject(DbxFirebaseExternalConnectionService);
  readonly dbxFirebaseUserExternalConnectionsStore = inject(DbxFirebaseUserExternalConnectionsStore);
  readonly userExternalConnectionDocumentStore = inject(UserExternalConnectionDocumentStore);

  constructor() {
    // currentUid$ rather than userIdentifier$: the latter substitutes NO_AUTH_USER_IDENTIFIER ('0')
    // when signed out, which would ask Firestore for uec/0.
    this.dbxFirebaseUserExternalConnectionsStore.setUid(this.dbxFirebaseAuthService.currentUid$);

    // The connection document has to exist before a provider can be connected: the server asserts a
    // role against it, and a role map is only consulted for a document that exists. This page is where
    // it gets created — the user is present and known to want the feature, and creating it is gated
    // server-side in one place instead of being a side effect of the OAuth handoff. Nothing is created
    // for a signed-out user: no uid means no document ref, so the load never settles.
    this.dbxFirebaseUserExternalConnectionsStore.createIfMissing().pipe(takeUntilDestroyed()).subscribe();
  }

  private readonly _currentUidSignal = toSignal(this.dbxFirebaseAuthService.currentUid$, { initialValue: undefined });

  /**
   * THE shared subscription. Every row is computed from this one document read.
   */
  private readonly _entriesStateSignal = toSignal(this.dbxFirebaseUserExternalConnectionsStore.entriesLoadingState$, { initialValue: beginLoading<UserExternalConnectionEntryMap>() as LoadingState<UserExternalConnectionEntryMap> });

  readonly signedInSignal = computed(() => this._currentUidSignal() != null);

  readonly errorSignal = computed(() => this._entriesStateSignal().error);

  readonly rowsSignal = computed<DbxFirebaseExternalConnectionRow[]>(() => {
    const state = this._entriesStateSignal();

    return dbxFirebaseExternalConnectionRows({
      providers: this.dbxFirebaseExternalConnectionService.getProviders(),
      enabledProviderTypes: this.dbxFirebaseExternalConnectionService.getEnabledTypes(),
      entries: state.value,
      loading: isLoadingStateLoading(state)
    });
  });

  /**
   * Builds the actions for a row.
   *
   * An errored connection offers both Reconnect and Disconnect: reconnecting is the usual fix, but a
   * user who no longer wants the integration must not be forced to reauthorize just to remove it.
   *
   * @param row - The row to build actions for.
   * @returns The actions to render, or null while loading.
   */
  actionsForRow(row: DbxFirebaseExternalConnectionRow): Maybe<DbxFirebaseExternalConnectionActionConfig[]> {
    const { providerType, assets, status } = row;
    const provider = this.dbxFirebaseExternalConnectionService.getProvider(providerType);
    const result: DbxFirebaseExternalConnectionActionConfig[] = [];

    if (status !== 'loading') {
      if (status !== 'connected' && row.enabled) {
        result.push({
          label: assets.connectText ?? (status === 'error' ? 'Reconnect' : 'Connect'),
          icon: 'link',
          handler: (_, context) => context.startWorkingWithPromise(this.connectToProvider(providerType))
        });
      }

      if (status !== 'notConnected') {
        result.push({
          label: assets.disconnectText ?? 'Disconnect',
          icon: 'link_off',
          confirm: provider?.disconnectConfirm ?? {
            title: `Disconnect ${assets.providerName}?`,
            prompt: `This account will no longer be connected to ${assets.providerName}.`,
            confirmText: 'Disconnect'
          },
          handler: (_, context) => context.startWorkingWithLoadingStateObservable(this.disconnectFromProvider(providerType))
        });
      }
    }

    return result.length ? result : null;
  }

  /**
   * Starts the connect flow for a provider.
   *
   * The action stays working until the authorize page is actually opening, rather than succeeding the
   * moment the redirect is requested — the page the user is looking at has not changed yet, so a
   * success there reads as "nothing happened".
   *
   * @param providerType - The provider to connect.
   * @returns Resolves once the authorize page is actually opening.
   */
  async connectToProvider(providerType: UserExternalConnectionProviderType): Promise<void> {
    await this.dbxFirebaseExternalConnectionService.connectToProvider(providerType);
  }

  /**
   * Disconnects the signed-in user from a provider.
   *
   * @param providerType - The provider to disconnect.
   * @returns The loading state observable of the callable.
   */
  disconnectFromProvider(providerType: UserExternalConnectionProviderType) {
    return this.userExternalConnectionDocumentStore.disconnectUserExternalConnection({ providerType });
  }
}
