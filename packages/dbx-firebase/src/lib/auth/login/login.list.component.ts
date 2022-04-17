import { Observable, BehaviorSubject, map, shareReplay, combineLatest } from 'rxjs';
import { DbxFirebaseAuthLoginProvider, DbxFirebaseAuthLoginService } from './login.service';
import { DbxFirebaseLoginMode, FirebaseLoginMethodType } from './login';
import { Component, Input, OnDestroy } from "@angular/core";
import { Maybe } from '@dereekb/util';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';

/**
 * Pre-configured login component that displays all configured login types.
 */
@Component({
  selector: 'dbx-firebase-login-list',
  template: `
    <div class="dbx-firebase-login-item" *ngFor="let config of (providerInjectionConfigs$ | async)">
      <dbx-injection [config]="config"></dbx-injection>
    </div>
`,
  host: {
    'class': 'dbx-firebase-login-list'
  }
})
export class DbxFirebaseLoginListComponent implements OnDestroy {

  private _loginMode = new BehaviorSubject<DbxFirebaseLoginMode>('login');
  private _inputProviderTypes = new BehaviorSubject<Maybe<FirebaseLoginMethodType[]>>(undefined);

  readonly providerTypes$ = this._inputProviderTypes.pipe(
    map((x) => (x) ? x : this.dbxFirebaseAuthLoginService.getEnabledTypes()),
    shareReplay(1)
  );

  readonly providers$ = this.providerTypes$.pipe(map(x => this.dbxFirebaseAuthLoginService.getLoginProviders(x)));
  readonly providerInjectionConfigs$: Observable<DbxInjectionComponentConfig[]> = combineLatest([this._loginMode, this.providers$]).pipe(
    map(([mode, providers]: [DbxFirebaseLoginMode, DbxFirebaseAuthLoginProvider[]]) => {
      const mapFn = (mode === 'register') ?
        ((x: DbxFirebaseAuthLoginProvider) => ({ componentClass: x.registrationComponentClass ?? x.componentClass }) as DbxInjectionComponentConfig) :
        ((x: DbxFirebaseAuthLoginProvider) => ({ componentClass: x.componentClass }) as DbxInjectionComponentConfig);
      return providers.map(mapFn);
    })
  );

  constructor(readonly dbxFirebaseAuthLoginService: DbxFirebaseAuthLoginService) { }

  ngOnDestroy(): void {
    this._inputProviderTypes.complete();
  }

  @Input()
  set loginMode(loginMode: DbxFirebaseLoginMode) {
    this._loginMode.next(loginMode);
  }

  @Input()
  set providerTypes(providerTypes: Maybe<FirebaseLoginMethodType[]>) {
    this._inputProviderTypes.next(providerTypes);
  }

}
