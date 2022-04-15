import { Observable } from 'rxjs';
import { BehaviorSubject, map, shareReplay } from 'rxjs';
import { DbxFirebaseAuthLoginProvider, DbxFirebaseAuthLoginService } from './login.service';
import { FirebaseLoginMethodType } from './login';
import { Component } from "@angular/core";
import { Maybe } from '@dereekb/util';
import { DbxInjectedComponentConfig } from '@dereekb/dbx-core';


/**
 * Pre-configured register component that displays all configured login types, and the email registration if it is available.
 */
@Component({
  selector: 'dbx-firebase-register',
  templateUrl: './register.component.html'
})
export class DbxFirebaseRegisterComponent {

  private _inputProviderTypes = new BehaviorSubject<Maybe<FirebaseLoginMethodType>>(undefined);

  readonly providerTypes$ = this._inputProviderTypes.pipe(
    map((x) => (x) ? x : this.dbxFirebaseAuthLoginService.getEnabledTypes()),
    shareReplay(1)
  );

  readonly providers$ = this.providerTypes$.pipe(map(x => this.dbxFirebaseAuthLoginService.getLoginProviders(x)));
  readonly providerInjectionConfigs$: Observable<DbxInjectedComponentConfig[]> = this.providers$.pipe(
    map(x => x
      .filter(x => x.registrationComponentClass !== false)
      .map((provider: DbxFirebaseAuthLoginProvider) => ({ componentClass: provider.registrationComponentClass ?? provider.componentClass }) as DbxInjectedComponentConfig))
  );

  constructor(readonly dbxFirebaseAuthLoginService: DbxFirebaseAuthLoginService) { }

}
