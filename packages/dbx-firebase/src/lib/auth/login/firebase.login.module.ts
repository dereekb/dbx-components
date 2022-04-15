import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxInjectedComponentModule } from '@dereekb/dbx-core';
import { DbxActionModule } from '@dereekb/dbx-web';
import { FirebaseLoginMethodType, KnownFirebaseLoginMethodType } from './login';
import { DbxFirebaseLoginComponent } from './login.component';
import { DbxFirebaseLoginEmailComponent } from './login.email.component';
import { DbxFirebaseLoginGoogleComponent } from './login.google.component';
import { DbxFirebaseAuthLoginProvider, DbxFirebaseAuthLoginService, DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN } from './login.service';
import { DbxFirebaseRegisterComponent } from './register.component';

export abstract class DbxFirebaseLoginModuleRootConfig {
  abstract readonly enabledLoginMethods: FirebaseLoginMethodType[];
}

export function defaultFirebaseAuthLoginProvidersFactory(): DbxFirebaseAuthLoginProvider[] {
  return [{
    loginMethodType: 'email' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginEmailComponent
  }, {
    loginMethodType: 'google' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginGoogleComponent
  }];
}

/**
 * Contains components related to logging in.
 */
@NgModule({
  imports: [
    CommonModule,
    DbxActionModule,
    DbxInjectedComponentModule
  ],
  declarations: [
    DbxFirebaseLoginComponent,
    DbxFirebaseRegisterComponent,
    DbxFirebaseLoginEmailComponent,
    DbxFirebaseLoginGoogleComponent
  ],
  exports: [
    DbxFirebaseLoginComponent,
    DbxFirebaseRegisterComponent,
    DbxFirebaseLoginEmailComponent,
    DbxFirebaseLoginGoogleComponent
  ],
  providers: []
})
export class DbxFirebaseLoginModule {

  constructor(config: DbxFirebaseLoginModuleRootConfig, dbxFirebaseAuthLoginService: DbxFirebaseAuthLoginService) {
    dbxFirebaseAuthLoginService.enable(config.enabledLoginMethods); // enable the types in the service.
  }

  static forRoot(config: DbxFirebaseLoginModuleRootConfig): ModuleWithProviders<DbxFirebaseLoginModule> {
    return {
      ngModule: DbxFirebaseLoginModule,
      providers: [{
        provide: DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN,
        useFactory: defaultFirebaseAuthLoginProvidersFactory
      }, {
        provide: DbxFirebaseLoginModuleRootConfig,
        useValue: config
      }]
    };
  }

}
