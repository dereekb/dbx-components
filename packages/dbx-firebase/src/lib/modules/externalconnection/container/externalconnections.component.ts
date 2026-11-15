import { Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { type Maybe } from '@dereekb/util';
import { beginLoading, isLoadingStateLoading, type ListLoadingState, successResult } from '@dereekb/rxjs';
import { type UserExternalConnectionProviderType, type UserExternalConnectionScopePresetKey } from '@dereekb/firebase';
import { DbxErrorComponent, DbxListEmptyContentComponent } from '@dereekb/dbx-web';
import { DbxFirebaseAuthService } from '../../../auth/service/firebase.auth.service';
import { DbxFirebaseExternalConnectionListComponent } from '../component/externalconnection.list.component';
import { type DbxFirebaseExternalConnectionActionConfig, dbxFirebaseExternalConnectionConnectFailureReadableError, type DbxFirebaseExternalConnectionListItemValue, type DbxFirebaseExternalConnectionRow, dbxFirebaseExternalConnectionRows } from '../service/externalconnection';
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
      @if (connectFailureErrorSignal(); as connectFailure) {
        <dbx-error [error]="connectFailure"></dbx-error>
      }
      @if (errorSignal(); as error) {
        <dbx-error [error]="error"></dbx-error>
      } @else {
        <dbx-firebase-external-connection-list [state]="listStateSignal()">
          <dbx-list-empty-content empty>
            <p class="dbx-hint no-margin">There are no apps available to connect.</p>
          </dbx-list-empty-content>
        </dbx-firebase-external-connection-list>
      }
    } @else {
      <p class="dbx-hint no-margin">Sign in to connect your apps.</p>
    }
  `,
  host: {
    class: 'd-block dbx-firebase-external-connections'
  },
  imports: [DbxErrorComponent, DbxFirebaseExternalConnectionListComponent, DbxListEmptyContentComponent],
  providers: [UserExternalConnectionDocumentStore, DbxFirebaseUserExternalConnectionsStore]
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

    // a refusal belongs to the visit that reported it; leaving the page drops it so it does not greet
    // the user again on their next, unrelated visit
    inject(DestroyRef).onDestroy(() => this.dbxFirebaseExternalConnectionService.clearConnectFailure());
  }

  private readonly _currentUidSignal = toSignal(this.dbxFirebaseAuthService.currentUid$, { initialValue: undefined });

  /**
   * THE shared subscription. Every row is computed from this one document read.
   */
  private readonly _entriesStateSignal = toSignal(this.dbxFirebaseUserExternalConnectionsStore.entriesLoadingState$, { initialValue: beginLoading() });

  /**
   * The user's auth roles, or undefined until they resolve. Admin-only rows stay hidden until then, so
   * they never flash in front of a non-admin.
   */
  private readonly _authRolesSignal = toSignal(this.dbxFirebaseAuthService.authRoles$, { initialValue: undefined });

  readonly signedInSignal = computed(() => this._currentUidSignal() != null);

  readonly errorSignal = computed(() => this._entriesStateSignal().error);

  /**
   * The refused connect the last connect redirect reported, as the error its banner renders.
   *
   * Rendered in its own block above the list rather than in place of it, so a refusal never hides the
   * rows or the Switch/Connect actions the user needs to try again.
   */
  readonly connectFailureErrorSignal = computed(() => {
    const failure = this.dbxFirebaseExternalConnectionService.connectFailure();
    return failure ? dbxFirebaseExternalConnectionConnectFailureReadableError({ failure, provider: this.dbxFirebaseExternalConnectionService.getProvider(failure.providerType) }) : undefined;
  });

  readonly rowsSignal = computed<DbxFirebaseExternalConnectionRow[]>(() => {
    const state = this._entriesStateSignal();
    const authRoles = this._authRolesSignal();
    const isAdmin = authRoles != null && this.dbxFirebaseAuthService.isAdminInAuthRoleSet(authRoles);

    return dbxFirebaseExternalConnectionRows({
      providers: this.dbxFirebaseExternalConnectionService.getProviders(),
      enabledProviderTypes: this.dbxFirebaseExternalConnectionService.getEnabledTypes(),
      entries: state.value,
      loading: isLoadingStateLoading(state),
      isAdmin
    });
  });

  /**
   * The list's state.
   *
   * Always a success result, never a loading one: a row carries its own `loading` status and renders a "Loading"
   * chip, which reads better here than the list swapping itself out for a spinner and then reflowing.
   */
  readonly listStateSignal = computed<ListLoadingState<DbxFirebaseExternalConnectionListItemValue>>(() => successResult(this.rowsSignal().map((row) => ({ row, actions: this.actionsForRow(row) }))));

  /**
   * Builds the actions for a row.
   *
   * An errored connection offers both Reconnect and Disconnect: reconnecting is the usual fix, but a
   * user who no longer wants the integration must not be forced to reauthorize just to remove it.
   *
   * A provider with scope presets offers one connect action per preset ("Connect: Read"), and once
   * connected a "Switch to <label>" action for every preset other than the current one — switching is
   * a reconnect with the other preset.
   *
   * Every connect-type action (Connect, a preset connect, Switch to, Reconnect) carries the provider's
   * `connectConfirm`, so a notice the user must read before the consent page opens is shown whichever way
   * they start it. Disconnect keeps its own confirm.
   *
   * @param row - The row to build actions for.
   * @returns The actions to render, or null while loading.
   */
  actionsForRow(row: DbxFirebaseExternalConnectionRow): Maybe<DbxFirebaseExternalConnectionActionConfig[]> {
    const { providerType, assets, status, scopePresets, scopePreset } = row;
    const provider = this.dbxFirebaseExternalConnectionService.getProvider(providerType);
    const result: DbxFirebaseExternalConnectionActionConfig[] = [];

    if (status !== 'loading') {
      if (row.enabled) {
        const connectLabel = assets.connectText ?? (status === 'error' ? 'Reconnect' : 'Connect');
        const connectConfirm = provider?.connectConfirm;

        if (!scopePresets?.length) {
          if (status !== 'connected') {
            result.push({
              label: connectLabel,
              icon: 'link',
              confirm: connectConfirm,
              handler: (_, context) => context.startWorkingWithPromise(this.connectToProvider(providerType))
            });
          }
        } else if (status === 'connected') {
          scopePresets
            .filter((x) => x.key !== scopePreset?.key)
            .forEach((preset) => {
              result.push({
                label: `Switch to ${preset.label}`,
                icon: 'swap_horiz',
                confirm: connectConfirm,
                handler: (_, context) => context.startWorkingWithPromise(this.connectToProvider(providerType, preset.key))
              });
            });
        } else {
          scopePresets.forEach((preset) => {
            result.push({
              label: `${connectLabel}: ${preset.label}`,
              icon: 'link',
              confirm: connectConfirm,
              handler: (_, context) => context.startWorkingWithPromise(this.connectToProvider(providerType, preset.key))
            });
          });
        }
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
   * @param scopePreset - The scope preset to connect with, for a provider that declares presets.
   * @returns Resolves once the authorize page is actually opening.
   */
  async connectToProvider(providerType: UserExternalConnectionProviderType, scopePreset?: Maybe<UserExternalConnectionScopePresetKey>): Promise<void> {
    await this.dbxFirebaseExternalConnectionService.connectToProvider(providerType, { scopePreset });
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
