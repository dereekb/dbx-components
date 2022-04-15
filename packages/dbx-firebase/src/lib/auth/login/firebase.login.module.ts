import { MatIconModule } from '@angular/material/icon';
import { DbxFirebaseLoginButtonComponent, DbxFirebaseLoginButtonContainerComponent } from './login.button.component';
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxInjectedComponentModule } from '@dereekb/dbx-core';
import { DbxActionModule, DbxButtonModule } from '@dereekb/dbx-web';
import { FirebaseLoginMethodType, KnownFirebaseLoginMethodType } from './login';
import { DbxFirebaseLoginAnonymousComponent } from './login.anonymous.component';
import { DbxFirebaseLoginComponent } from './login.component';
import { DbxFirebaseLoginEmailComponent } from './login.email.component';
import { DbxFirebaseLoginFacebookComponent } from './login.facebook.component';
import { DbxFirebaseLoginGoogleComponent } from './login.google.component';
import { DbxFirebaseAuthLoginProvider, DbxFirebaseAuthLoginService, DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN } from './login.service';
import { DbxFirebaseRegisterComponent } from './register.component';

export abstract class DbxFirebaseLoginModuleRootConfig {
  abstract readonly enabledLoginMethods: FirebaseLoginMethodType[];
}

export function defaultFirebaseAuthLoginProvidersFactory(): DbxFirebaseAuthLoginProvider[] {
  // NOTE: Asset URLS are from Firebase.
  // https://firebase.google.com/docs/auth/web/firebaseui

  const baseFirebaseJSUrl = `https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth`;

  return [{
    loginMethodType: 'email' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginEmailComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/mail.svg`,
      loginText: 'Continue with Email'
    }
  }, {
    loginMethodType: 'google' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginGoogleComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/google.svg`,
      loginText: 'Continue with Google'
    }
  }, {
    loginMethodType: 'facebook' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginFacebookComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/facebook.svg`,
      loginText: 'Continue with Facebook'
    }
  }, {
    loginMethodType: 'anonymous' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginAnonymousComponent,
    assets: {
      loginIcon: 'guest',
      loginText: 'Continue as Guest'
    }
  }];
}

/**
 * Contains components related to logging in.
 */
@NgModule({
  imports: [
    CommonModule,
    MatIconModule,
    DbxActionModule,
    DbxButtonModule,
    DbxInjectedComponentModule
  ],
  declarations: [
    DbxFirebaseLoginComponent,
    DbxFirebaseLoginButtonComponent,
    DbxFirebaseLoginButtonContainerComponent,
    DbxFirebaseRegisterComponent,
    DbxFirebaseLoginEmailComponent,
    DbxFirebaseLoginGoogleComponent,
    DbxFirebaseLoginFacebookComponent,
    DbxFirebaseLoginAnonymousComponent,
  ],
  exports: [
    DbxFirebaseLoginComponent,
    DbxFirebaseLoginButtonComponent,
    DbxFirebaseLoginButtonContainerComponent,
    DbxFirebaseRegisterComponent,
    DbxFirebaseLoginEmailComponent,
    DbxFirebaseLoginGoogleComponent,
    DbxFirebaseLoginFacebookComponent,
    DbxFirebaseLoginAnonymousComponent
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
