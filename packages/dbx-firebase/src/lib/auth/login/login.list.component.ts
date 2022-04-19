import { Observable, BehaviorSubject, map, shareReplay, combineLatest } from 'rxjs';
import { DbxFirebaseAuthLoginProvider, DbxFirebaseAuthLoginService } from './login.service';
import { DbxFirebaseLoginMode, FirebaseLoginMethodType, FirebaseLoginMethodCategory } from './login';
import { Component, Input, OnDestroy } from "@angular/core";
import { containsStringAnyCase, Maybe, ArrayOrValue, excludeValuesFromArray, asArray } from '@dereekb/util';
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
  private _inputProviderCategories = new BehaviorSubject<Maybe<ArrayOrValue<FirebaseLoginMethodCategory>>>(undefined);
  private _omitProviderTypes = new BehaviorSubject<Maybe<ArrayOrValue<FirebaseLoginMethodType>>>(undefined);
  private _inputProviderTypes = new BehaviorSubject<Maybe<ArrayOrValue<FirebaseLoginMethodType>>>(undefined);

  readonly providerTypes$: Observable<string[]> = combineLatest([this._inputProviderTypes, this._omitProviderTypes]).pipe(
    map(([providerTypes, omitProviderTypes]) => {
      const baseTypes = (providerTypes) ? asArray(providerTypes) : this.dbxFirebaseAuthLoginService.getEnabledTypes();
      const types = (omitProviderTypes) ? excludeValuesFromArray(baseTypes, asArray(omitProviderTypes)) : baseTypes;
      return types;
    }),
    shareReplay(1)
  );

  readonly providers$ = combineLatest([this.providerTypes$, this._inputProviderCategories]).pipe(
    map(([x, inputProviderCategories]) => {
      const providerCategories = asArray(inputProviderCategories);
      let providers = this.dbxFirebaseAuthLoginService.getLoginProviders(x);

      if (providerCategories.length) {
        const categories = new Set(providerCategories);
        providers = providers.filter(x => containsStringAnyCase(categories, x.category ?? ''));
      }

      return providers;
    })
  );


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
  set providerTypes(providerTypes: Maybe<ArrayOrValue<FirebaseLoginMethodType>>) {
    this._inputProviderTypes.next(providerTypes);
  }

  @Input()
  set omitProviderTypes(providerTypes: Maybe<ArrayOrValue<FirebaseLoginMethodType>>) {
    this._omitProviderTypes.next(providerTypes);
  }

  @Input()
  set providerCategories(providerCategories: Maybe<ArrayOrValue<FirebaseLoginMethodCategory>>) {
    this._inputProviderCategories.next(providerCategories);
  }

}
