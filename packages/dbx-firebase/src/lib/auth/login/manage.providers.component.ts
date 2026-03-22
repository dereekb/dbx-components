import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { filterMaybeArrayValues, type Maybe } from '@dereekb/util';
import { DbxFirebaseAuthService } from '../service/firebase.auth.service';
import { DbxFirebaseAuthLoginService, type DbxFirebaseAuthLoginProviderAssets } from './login.service';
import { OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY, type FirebaseLoginMethodType } from './login';
import { firebaseProviderIdToLoginMethodType } from './login.provider.id';
import { DbxFirebaseLoginComponent } from './login.component';
import { DbxSectionComponent, DbxActionModule, DbxButtonModule } from '@dereekb/dbx-web';
import { MatIconModule } from '@angular/material/icon';

/**
 * Represents a linked provider in the manage providers view.
 */
export interface DbxFirebaseManageAuthLinkedProviderInfo {
  /**
   * Firebase provider ID (e.g., 'google.com').
   */
  readonly providerId: string;
  /**
   * Login method type (e.g., 'google').
   */
  readonly loginMethodType: Maybe<FirebaseLoginMethodType>;
  /**
   * Display name for this provider.
   */
  readonly providerName: string;
  /**
   * Text for the unlink/disconnect button.
   */
  readonly unlinkText: string;
  /**
   * Provider assets for display.
   */
  readonly assets: Maybe<DbxFirebaseAuthLoginProviderAssets>;
}

/**
 * Component for managing linked authentication providers on a user account.
 *
 * Displays two sections:
 * - **Connected Providers**: Shows currently linked providers with disconnect buttons.
 * - **Connect Provider**: Shows available OAuth providers that can be linked.
 *
 * @example
 * ```html
 * <dbx-firebase-manage-auth-providers></dbx-firebase-manage-auth-providers>
 * ```
 */
@Component({
  selector: 'dbx-firebase-manage-auth-providers',
  standalone: true,
  imports: [DbxFirebaseLoginComponent, DbxSectionComponent, MatIconModule, DbxActionModule, DbxButtonModule],
  template: `
    @if (linkedProvidersSignal().length) {
      <dbx-section header="Connected Providers">
        @for (provider of linkedProvidersSignal(); track provider.providerId) {
          <div class="dbx-firebase-manage-provider-item">
            <ng-container dbxAction [dbxActionHandler]="makeUnlinkHandler(provider.providerId)" dbxActionValue>
              <dbx-button dbxActionButton [text]="provider.unlinkText" icon="link_off" color="warn"></dbx-button>
            </ng-container>
          </div>
        }
      </dbx-section>
    }
    @if (showLinkSectionSignal()) {
      <dbx-section header="Connect Provider">
        <dbx-firebase-login loginMode="link" [omitProviderTypes]="linkedMethodTypesSignal()" providerCategories="oauth"></dbx-firebase-login>
      </dbx-section>
    }
  `,
  host: {
    class: 'd-block dbx-firebase-manage-auth-providers'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseManageAuthProvidersComponent {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly dbxFirebaseAuthLoginService = inject(DbxFirebaseAuthLoginService);

  private readonly _linkedProviderIds = toSignal(this.dbxFirebaseAuthService.currentLinkedProviderIds$, { initialValue: [] as string[] });

  readonly linkedProvidersSignal = computed<DbxFirebaseManageAuthLinkedProviderInfo[]>(() => {
    const providerIds = this._linkedProviderIds();

    return providerIds.map((providerId) => {
      const loginMethodType = firebaseProviderIdToLoginMethodType(providerId);
      const assets = loginMethodType ? this.dbxFirebaseAuthLoginService.getProviderAssets(loginMethodType) : undefined;
      const providerName = assets?.providerName ?? providerId;
      const unlinkText = assets?.unlinkText ?? `Disconnect ${providerName}`;

      return { providerId, loginMethodType, providerName, unlinkText, assets };
    });
  });

  readonly linkedMethodTypesSignal = computed<FirebaseLoginMethodType[]>(() => {
    return filterMaybeArrayValues(this.linkedProvidersSignal().map((p) => p.loginMethodType));
  });

  readonly showLinkSectionSignal = computed<boolean>(() => {
    const linkedTypes = new Set(this.linkedMethodTypesSignal());
    const oauthProviders = this.dbxFirebaseAuthLoginService.getLinkProviders(this.dbxFirebaseAuthLoginService.getEnabledTypes());
    return oauthProviders.some((p) => p.category === OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY && !linkedTypes.has(p.loginMethodType));
  });

  /**
   * Creates a work handler for unlinking a specific provider.
   *
   * @param providerId - The Firebase provider ID to unlink (e.g., 'google.com').
   * @returns A {@link WorkUsingContext} handler that unlinking the provider on execution.
   */
  makeUnlinkHandler(providerId: string): WorkUsingContext {
    return (_, context) => {
      const promise = this.dbxFirebaseAuthService.unlinkProvider(providerId);
      context.startWorkingWithPromise(promise);
    };
  }
}
