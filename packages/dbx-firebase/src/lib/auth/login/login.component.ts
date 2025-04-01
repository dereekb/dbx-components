import { DbxFirebaseLoginMode, FirebaseLoginMethodCategory, FirebaseLoginMethodType } from './login';
import { ChangeDetectionStrategy, Component, input, Input } from '@angular/core';
import { ArrayOrValue, type Maybe } from '@dereekb/util';
import { DbxInjectionContextDirective } from '@dereekb/dbx-core';
import { DbxFirebaseLoginListComponent } from './login.list.component';
import { DbxFirebaseLoginContextDirective } from './login.context.directive';

/**
 * Pre-configured login component that displays all configured login types.
 */
@Component({
  selector: 'dbx-firebase-login',
  standalone: true,
  imports: [DbxInjectionContextDirective, DbxFirebaseLoginContextDirective, DbxFirebaseLoginListComponent],
  template: `
    <ng-container *dbxInjectionContext dbxFirebaseLoginContext>
      <dbx-firebase-login-list [providerTypes]="providerTypes()" [omitProviderTypes]="omitProviderTypes()" [providerCategories]="providerCategories()" [loginMode]="loginMode()"></dbx-firebase-login-list>
    </ng-container>
  `,
  host: {
    class: 'd-block dbx-firebase-login',
    '[class]': '{ "dbx-firebase-register": loginMode() === "register" }'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseLoginComponent {
  readonly loginMode = input<DbxFirebaseLoginMode>('login');
  readonly providerTypes = input<Maybe<ArrayOrValue<FirebaseLoginMethodType>>>();
  readonly omitProviderTypes = input<Maybe<ArrayOrValue<FirebaseLoginMethodType>>>();
  readonly providerCategories = input<Maybe<ArrayOrValue<FirebaseLoginMethodCategory>>>();
}
