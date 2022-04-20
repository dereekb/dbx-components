import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { DbxFirebaseLoginAppleComponent } from './login.apple.component';
import { DbxFirebaseLoginButtonComponent, DbxFirebaseLoginButtonContainerComponent } from './login.button.component';
import { ModuleWithProviders, NgModule, Type } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxActionModule, DbxAnchorModule, DbxButtonModule, DbxReadableErrorModule } from '@dereekb/dbx-web';
import { FirebaseLoginMethodType, KnownFirebaseLoginMethodType, OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY, DEFAULT_FIREBASE_LOGIN_METHOD_CATEGORY } from './login';
import { DbxFirebaseLoginAnonymousComponent } from './login.anonymous.component';
import { DbxFirebaseLoginComponent } from './login.component';
import { DbxFirebaseLoginEmailComponent } from './login.email.component';
import { DbxFirebaseLoginFacebookComponent } from './login.facebook.component';
import { DbxFirebaseLoginGoogleComponent } from './login.google.component';
import { DbxFirebaseAuthLoginProvider, DbxFirebaseAuthLoginService, DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG_TOKEN, DEFAULT_FIREBASE_AUTH_LOGIN_PROVIDERS_TOKEN, DEFAULT_FIREBASE_AUTH_LOGIN_TERMS_COMPONENT_CLASS_TOKEN } from './login.service';
import { DbxFirebaseRegisterComponent } from './register.component';
import { DbxFirebaseLoginGitHubComponent } from './login.github.component';
import { DbxFirebaseLoginTwitterComponent } from './login.twitter.component';
import { DbxFirebaseLoginMicrosoftComponent } from './login.microsoft.component';
import { DbxFirebaseLoginListComponent } from './login.list.component';
import { DbxFirebaseRegisterEmailComponent } from './register.email.component';
import { DbxFirebaseLoginContextDirective } from './login.context.directive';
import { DbxFirebaseLoginEmailContentComponent } from './login.email.content.component';
import { DbxFormActionModule, DbxFormFormlyTextFieldModule, DbxFormIoModule, DbxFormlyModule, DbxFormModule } from '@dereekb/dbx-form';
import { DbxFirebaseEmailFormComponent } from './login.email.form.component';
import { DbxFirebaseLoginTermsComponent } from './login.terms.component';
import { DbxFirebaseLoginTermsSimpleComponent } from './login.terms.simple.component';
import { DbxFirebaseLoginContextBackButtonComponent } from './login.context.back.component';
import { DbxFirebaseEmailRecoveryFormComponent } from './login.email.recovery.form.component';
import { DbxFirebaseAuthLoginPasswordConfig } from './login.password';
import { DbxFirebaseLoginTermsConfig } from './login.terms';

export abstract class DbxFirebaseLoginModuleRootConfig extends DbxFirebaseLoginTermsConfig {
  abstract readonly enabledLoginMethods: FirebaseLoginMethodType[] | true;
  abstract readonly termsComponentClass?: Type<any>;
  abstract readonly passwordConfig?: DbxFirebaseAuthLoginPasswordConfig;
}

export function defaultFirebaseAuthLoginProvidersFactory(): DbxFirebaseAuthLoginProvider[] {
  // NOTE: Asset URLS are from Firebase.
  // https://firebase.google.com/docs/auth/web/firebaseui
  const baseFirebaseJSUrl = `https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth`;

  // NOTE: Colors are from https://brandcolors.net/

  return [{
    category: DEFAULT_FIREBASE_LOGIN_METHOD_CATEGORY,
    loginMethodType: 'email' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginEmailComponent,
    registrationComponentClass: DbxFirebaseRegisterEmailComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/mail.svg`,
      loginText: 'Continue with Email',
      backgroundColor: '#ea4335', // gmail red color
      textColor: '#FFF'
    }
  }, {
    category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
    loginMethodType: 'google' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginGoogleComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/google.svg`,
      loginText: 'Continue with Google',
      backgroundColor: '#FFF',
      textColor: '#757575'
    }
  }, {
    category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
    loginMethodType: 'facebook' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginFacebookComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/facebook.svg`,
      loginText: 'Continue with Facebook',
      backgroundColor: '#4267B2',
      textColor: '#FFF'
    }
  }, {
    category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
    loginMethodType: 'twitter' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginTwitterComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/twitter.svg`,
      loginText: 'Continue with Twitter',
      backgroundColor: '#1da1f2',
      textColor: '#FFF'
    }
  }, {
    category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
    loginMethodType: 'github' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginGitHubComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/github.svg`,
      loginText: 'Continue with Github',
      backgroundColor: '#333',
      textColor: '#FFF'
    }
  }, /*{
    category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
    loginMethodType: 'apple' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginGitHubComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/apple.svg`,
      loginText: 'Continue with Apple',
      backgroundColor: '#333',
      textColor: '#FFF'
    }
  }, {
    category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
    loginMethodType: 'microsoft' as KnownFirebaseLoginMethodType,
    componentClass: DbxFirebaseLoginGitHubComponent,
    assets: {
      logoUrl: `${baseFirebaseJSUrl}/microsoft.svg`,
      loginText: 'Continue with Microsoft',
      backgroundColor: '#ea3e23',
      textColor: '#FFF'
    }
  },*/ {
    category: DEFAULT_FIREBASE_LOGIN_METHOD_CATEGORY,
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
    MatButtonModule,
    DbxAnchorModule,
    DbxFormIoModule,
    DbxFormModule,
    DbxFormlyModule,
    DbxFormActionModule,
    DbxFormFormlyTextFieldModule,
    DbxReadableErrorModule,
    DbxActionModule,
    DbxButtonModule,
    DbxInjectionComponentModule
  ],
  declarations: [
    DbxFirebaseLoginComponent,
    DbxFirebaseLoginContextDirective,
    DbxFirebaseLoginContextBackButtonComponent,
    DbxFirebaseRegisterComponent,
    DbxFirebaseLoginListComponent,
    DbxFirebaseLoginButtonComponent,
    DbxFirebaseLoginButtonContainerComponent,
    DbxFirebaseLoginEmailComponent,
    DbxFirebaseLoginEmailContentComponent,
    DbxFirebaseEmailFormComponent,
    DbxFirebaseEmailRecoveryFormComponent,
    DbxFirebaseRegisterEmailComponent,
    DbxFirebaseLoginGoogleComponent,
    DbxFirebaseLoginGitHubComponent,
    DbxFirebaseLoginTwitterComponent,
    DbxFirebaseLoginAppleComponent,
    DbxFirebaseLoginMicrosoftComponent,
    DbxFirebaseLoginFacebookComponent,
    DbxFirebaseLoginAnonymousComponent,
    DbxFirebaseLoginTermsComponent,
    DbxFirebaseLoginTermsSimpleComponent
  ],
  exports: [
    DbxFirebaseLoginComponent,
    DbxFirebaseLoginContextDirective,
    DbxFirebaseLoginContextBackButtonComponent,
    DbxFirebaseRegisterComponent,
    DbxFirebaseLoginListComponent,
    DbxFirebaseLoginButtonComponent,
    DbxFirebaseLoginButtonContainerComponent,
    DbxFirebaseLoginEmailComponent,
    DbxFirebaseLoginEmailContentComponent,
    DbxFirebaseEmailFormComponent,
    DbxFirebaseEmailRecoveryFormComponent,
    DbxFirebaseRegisterEmailComponent,
    DbxFirebaseLoginGoogleComponent,
    DbxFirebaseLoginGitHubComponent,
    DbxFirebaseLoginTwitterComponent,
    DbxFirebaseLoginAppleComponent,
    DbxFirebaseLoginMicrosoftComponent,
    DbxFirebaseLoginFacebookComponent,
    DbxFirebaseLoginAnonymousComponent,
    DbxFirebaseLoginTermsComponent,
    DbxFirebaseLoginTermsSimpleComponent
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
        provide: DEFAULT_FIREBASE_AUTH_LOGIN_TERMS_COMPONENT_CLASS_TOKEN,
        useValue: config.termsComponentClass
      }, {
        provide: DEFAULT_FIREBASE_AUTH_LOGIN_PASSWORD_CONFIG_TOKEN,
        useValue: config.passwordConfig
      }, {
        provide: DbxFirebaseLoginModuleRootConfig,
        useValue: config
      }, {
        provide: DbxFirebaseLoginTermsConfig,
        useValue: config
      }]
    };
  }

}
