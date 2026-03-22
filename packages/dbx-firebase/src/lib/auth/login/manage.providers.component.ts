import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { filterMaybeArrayValues } from '@dereekb/util';
import { DbxFirebaseAuthService } from '../service/firebase.auth.service';
import { DbxFirebaseAuthLoginService } from './login.service';
import { OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY, type FirebaseLoginMethodType } from './login';
import { firebaseProviderIdToLoginMethodType } from './login.provider.id';
import { DbxFirebaseLoginComponent } from './login.component';
import { DbxSectionComponent } from '@dereekb/dbx-web';

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
  imports: [DbxFirebaseLoginComponent, DbxSectionComponent],
  template: `
    @if (linkedMethodTypesSignal().length) {
      <dbx-section header="Connected Providers">
        <dbx-firebase-login loginMode="unlink" providerCategories="oauth"></dbx-firebase-login>
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

  readonly linkedMethodTypesSignal = computed<FirebaseLoginMethodType[]>(() => {
    return filterMaybeArrayValues(this._linkedProviderIds().map(firebaseProviderIdToLoginMethodType));
  });

  readonly showLinkSectionSignal = computed<boolean>(() => {
    const linkedTypes = new Set(this.linkedMethodTypesSignal());
    const oauthProviders = this.dbxFirebaseAuthLoginService.getLinkProviders(this.dbxFirebaseAuthLoginService.getEnabledTypes());
    return oauthProviders.some((p) => p.category === OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY && !linkedTypes.has(p.loginMethodType));
  });
}
