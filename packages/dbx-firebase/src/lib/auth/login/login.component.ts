import { Observable, BehaviorSubject, map, shareReplay } from 'rxjs';
import { DbxFirebaseAuthLoginProvider, DbxFirebaseAuthLoginService } from './login.service';
import { FirebaseLoginMethodType } from './login';
import { Component } from "@angular/core";
import { Maybe } from '@dereekb/util';
import { DbxInjectedComponentConfig } from '@dereekb/dbx-core';


/**
 * Pre-configured login component that displays all configured login types.
 */
@Component({
  selector: 'dbx-firebase-login',
  templateUrl: './login.component.html'
})
export class DbxFirebaseLoginComponent {

  private _inputProviderTypes = new BehaviorSubject<Maybe<FirebaseLoginMethodType>>(undefined);

  readonly providerTypes$ = this._inputProviderTypes.pipe(
    map((x) => (x) ? x : this.dbxFirebaseAuthLoginService.getEnabledTypes()),
    shareReplay(1)
  );

  readonly providers$ = this.providerTypes$.pipe(map(x => this.dbxFirebaseAuthLoginService.getLoginProviders(x)));
  readonly providerInjectionConfigs$: Observable<DbxInjectedComponentConfig[]> = this.providers$.pipe(
    map(x => x.map((provider: DbxFirebaseAuthLoginProvider) => ({ componentClass: provider.componentClass }) as DbxInjectedComponentConfig))
  );

  constructor(readonly dbxFirebaseAuthLoginService: DbxFirebaseAuthLoginService) { }

}
