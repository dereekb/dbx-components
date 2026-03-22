import { DEFAULT_FIREBASE_LOGIN_METHOD_CATEGORY, type KnownFirebaseLoginMethodType, OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY } from './login';
import { DbxFirebaseLoginAnonymousComponent } from './login.anonymous.component';
import { DbxFirebaseLoginAppleComponent } from './login.apple.component';
import { DbxFirebaseLoginEmailComponent } from './login.email.component';
import { DbxFirebaseLoginFacebookComponent } from './login.facebook.component';
import { DbxFirebaseLoginGitHubComponent } from './login.github.component';
import { DbxFirebaseLoginGoogleComponent } from './login.google.component';
import { type DbxFirebaseAuthLoginProvider } from './login.service';
import { DbxFirebaseLoginTwitterComponent } from './login.twitter.component';
import { DbxFirebaseRegisterEmailComponent } from './register.email.component';

/**
 * Factory function for creating the default Firebase auth login providers.
 *
 * @returns Array of DbxFirebaseAuthLoginProvider
 */
export function defaultFirebaseAuthLoginProvidersFactory(): DbxFirebaseAuthLoginProvider[] {
  // Brand logos from @firebase-oss/ui-core via jsdelivr CDN.
  // https://github.com/firebase/firebaseui-web/tree/master/packages/core/brands
  const brandLogoBaseUrl = `https://cdn.jsdelivr.net/npm/@firebase-oss/ui-core/brands`;

  // NOTE: Colors are from https://brandcolors.net/
  return [
    {
      category: DEFAULT_FIREBASE_LOGIN_METHOD_CATEGORY,
      loginMethodType: 'email' as KnownFirebaseLoginMethodType,
      componentClass: DbxFirebaseLoginEmailComponent,
      registrationComponentClass: DbxFirebaseRegisterEmailComponent,
      allowLinking: false,
      assets: {
        providerName: 'Email',
        loginIcon: 'mail',
        loginText: 'Continue with Email',
        backgroundColor: '#ea4335', // gmail red color
        textColor: '#FFF'
      }
    },
    {
      category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
      loginMethodType: 'google' as KnownFirebaseLoginMethodType,
      componentClass: DbxFirebaseLoginGoogleComponent,
      assets: {
        providerName: 'Google',
        logoUrl: `${brandLogoBaseUrl}/google/logo.svg`,
        loginText: 'Continue with Google',
        backgroundColor: '#FFF',
        textColor: '#757575'
      }
    },
    {
      category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
      loginMethodType: 'facebook' as KnownFirebaseLoginMethodType,
      componentClass: DbxFirebaseLoginFacebookComponent,
      assets: {
        providerName: 'Facebook',
        logoUrl: `${brandLogoBaseUrl}/facebook/logo.svg`,
        logoFilter: 'brightness(0) invert(1)',
        loginText: 'Continue with Facebook',
        backgroundColor: '#1877F2',
        textColor: '#FFF'
      }
    },
    {
      category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
      loginMethodType: 'twitter' as KnownFirebaseLoginMethodType,
      componentClass: DbxFirebaseLoginTwitterComponent,
      assets: {
        providerName: 'X',
        logoUrl: `${brandLogoBaseUrl}/twitter/logo.svg`,
        loginText: 'Continue with X',
        backgroundColor: '#FFF',
        textColor: '#000'
      }
    },
    {
      category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
      loginMethodType: 'github' as KnownFirebaseLoginMethodType,
      componentClass: DbxFirebaseLoginGitHubComponent,
      assets: {
        providerName: 'GitHub',
        logoUrl: `${brandLogoBaseUrl}/github/logo.svg`,
        logoFilter: 'brightness(0) invert(1)',
        loginText: 'Continue with GitHub',
        backgroundColor: '#333',
        textColor: '#FFF'
      }
    },
    {
      category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
      loginMethodType: 'apple' as KnownFirebaseLoginMethodType,
      componentClass: DbxFirebaseLoginAppleComponent,
      assets: {
        providerName: 'Apple',
        logoUrl: `${brandLogoBaseUrl}/apple/logo.svg`,
        loginText: 'Continue with Apple',
        backgroundColor: '#FFF',
        textColor: '#000'
      }
    },
    {
      category: DEFAULT_FIREBASE_LOGIN_METHOD_CATEGORY,
      loginMethodType: 'anonymous' as KnownFirebaseLoginMethodType,
      componentClass: DbxFirebaseLoginAnonymousComponent,
      allowLinking: false,
      assets: {
        providerName: 'Guest',
        loginIcon: 'account_circle',
        loginText: 'Continue as Guest',
        backgroundColor: '#000',
        textColor: '#FFF'
      }
    }
  ];
}
