import { DEFAULT_FIREBASE_LOGIN_METHOD_CATEGORY, type KnownFirebaseLoginMethodType, OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY } from './login';
import { DbxFirebaseLoginAnonymousComponent } from './login.anonymous.component';
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
  // NOTE: Asset URLS are from Firebase.
  // https://firebase.google.com/docs/auth/web/firebaseui
  const baseFirebaseJSUrl = `https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth`;

  // NOTE: Colors are from https://brandcolors.net/
  return [
    {
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
    },
    {
      category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
      loginMethodType: 'google' as KnownFirebaseLoginMethodType,
      componentClass: DbxFirebaseLoginGoogleComponent,
      assets: {
        logoUrl: `${baseFirebaseJSUrl}/google.svg`,
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
        logoUrl: `${baseFirebaseJSUrl}/facebook.svg`,
        loginText: 'Continue with Facebook',
        backgroundColor: '#4267B2',
        textColor: '#FFF'
      }
    },
    {
      category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
      loginMethodType: 'twitter' as KnownFirebaseLoginMethodType,
      componentClass: DbxFirebaseLoginTwitterComponent,
      assets: {
        logoUrl: `${baseFirebaseJSUrl}/twitter.svg`,
        loginText: 'Continue with Twitter',
        backgroundColor: '#1da1f2',
        textColor: '#FFF'
      }
    },
    {
      category: OAUTH_FIREBASE_LOGIN_METHOD_CATEGORY,
      loginMethodType: 'github' as KnownFirebaseLoginMethodType,
      componentClass: DbxFirebaseLoginGitHubComponent,
      assets: {
        logoUrl: `${baseFirebaseJSUrl}/github.svg`,
        loginText: 'Continue with Github',
        backgroundColor: '#333',
        textColor: '#FFF'
      }
    },
    /*{
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
    }
  ];
}
