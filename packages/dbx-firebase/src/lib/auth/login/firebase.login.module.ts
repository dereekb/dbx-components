import { NgModule } from '@angular/core';
import { DbxFirebaseLoginAppleComponent } from './login.apple.component';
import { DbxFirebaseLoginButtonComponent, DbxFirebaseLoginButtonContainerComponent } from './login.button.component';
import { DbxFirebaseLoginAnonymousComponent } from './login.anonymous.component';
import { DbxFirebaseLoginComponent } from './login.component';
import { DbxFirebaseLoginEmailComponent } from './login.email.component';
import { DbxFirebaseLoginFacebookComponent } from './login.facebook.component';
import { DbxFirebaseLoginGoogleComponent } from './login.google.component';
import { DbxFirebaseRegisterComponent } from './register.component';
import { DbxFirebaseLoginGitHubComponent } from './login.github.component';
import { DbxFirebaseLoginTwitterComponent } from './login.twitter.component';
import { DbxFirebaseLoginMicrosoftComponent } from './login.microsoft.component';
import { DbxFirebaseLoginListComponent } from './login.list.component';
import { DbxFirebaseRegisterEmailComponent } from './register.email.component';
import { DbxFirebaseLoginContextDirective } from './login.context.directive';
import { DbxFirebaseLoginEmailContentComponent } from './login.email.content.component';
import { DbxFirebaseEmailFormComponent } from './login.email.form.component';
import { DbxFirebaseLoginTermsComponent } from './login.terms.component';
import { DbxFirebaseLoginTermsSimpleComponent } from './login.terms.simple.component';
import { DbxFirebaseLoginContextBackButtonComponent } from './login.context.back.component';
import { DbxFirebaseEmailRecoveryFormComponent } from './login.email.recovery.form.component';

/**
 * All standalone components related to Firebase login.
 */
export const DBX_FIREBASE_LOGIN_COMPONENTS = [
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
];

/**
 * Contains components related to logging in.
 *
 * @deprecated Use provideDbxFirebaseLogin() instead.
 */
@NgModule({
  imports: DBX_FIREBASE_LOGIN_COMPONENTS,
  exports: DBX_FIREBASE_LOGIN_COMPONENTS
})
export class DbxFirebaseLoginModule {}
