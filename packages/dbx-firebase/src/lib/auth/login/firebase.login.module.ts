import { DbxFirebaseLoginAppleComponent } from './login.apple.component';
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
import { DbxFirebaseLoginGitHubComponent } from './login.github.component';
import { DbxFirebaseLoginTwitterComponent } from './login.twitter.component';
import { DbxFirebaseLoginMicrosoftComponent } from './login.microsoft.component';

export abstract class DbxFirebaseLoginModuleRootConfig {
  abstract readonly enabledLoginMethods: FirebaseLoginMethodType[] | true;
}

export function defaultFirebaseAuthLoginProvidersFactory(): DbxFirebaseAuthLoginProvider[] {
  // NOTE: Asset URLS are from Firebase.
  // https://firebase.google.com/docs/auth/web/firebaseui
  const baseFirebaseJSUrl = `https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth`;

  // NOTE: Colors are from https://brandcolors.net/

  return [{
    loginMethodType: 'email' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginEmailComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/mail.svg`,
      loginText: 'Continue with Email',
      backgroundColor: '#ea4335', // gmail red color
      textColor: '#FFF',
    }
  }, {
    loginMethodType: 'google' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginGoogleComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/google.svg`,
      loginText: 'Continue with Google',
      backgroundColor: '#FFF',
      textColor: '#757575'
    }
  }, {
    loginMethodType: 'facebook' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginFacebookComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/facebook.svg`,
      loginText: 'Continue with Facebook',
      backgroundColor: '#4267B2',
      textColor: '#FFF'
    }
  }, {
    loginMethodType: 'twitter' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginTwitterComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/twitter.svg`,
      loginText: 'Continue with Twitter',
      backgroundColor: '#1da1f2',
      textColor: '#FFF'
    }
  }, {
    loginMethodType: 'github' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginGitHubComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/github.svg`,
      loginText: 'Continue with Github',
      backgroundColor: '#333',
      textColor: '#FFF'
    }
  }, /*{
    loginMethodType: 'apple' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginGitHubComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/apple.svg`,
      loginText: 'Continue with Apple',
      backgroundColor: '#333',
      textColor: '#FFF'
    }
  }, {
    loginMethodType: 'microsoft' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginGitHubComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/microsoft.svg`,
      loginText: 'Continue with Microsoft',
      backgroundColor: '#ea3e23',
      textColor: '#FFF'
    }
  },*/ {
    loginMethodType: 'anonymous' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginAnonymousComponent,
    assets: {
      loginIcon: 'account_circle',
      loginText: 'Continue as Guest',
      backgroundColor: '#000',
      textColor: '#FFF'
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
    DbxFirebaseLoginGitHubComponent,
    DbxFirebaseLoginTwitterComponent,
    DbxFirebaseLoginAppleComponent,
    DbxFirebaseLoginMicrosoftComponent,
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
    DbxFirebaseLoginGitHubComponent,
    DbxFirebaseLoginTwitterComponent,
    DbxFirebaseLoginAppleComponent,
    DbxFirebaseLoginMicrosoftComponent,
    DbxFirebaseLoginFacebookComponent,
    DbxFirebaseLoginAnonymousComponent,
  ],
  providers: []
})
export class DbxFirebaseLoginModule {

  constructor(config: DbxFirebaseLoginModuleRootConfig, dbxFirebaseAuthLoginService: DbxFirebaseAuthLoginService) {
    if (config.enabledLoginMethods === true) {
      dbxFirebaseAuthLoginService.setEnableAll();
    } else {
      dbxFirebaseAuthLoginService.enable(config.enabledLoginMethods); // enable the types in the service.
    }
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
