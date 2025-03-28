import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { DbxFirebaseLoginAppleComponent } from './login.apple.component';
import { DbxFirebaseLoginButtonComponent, DbxFirebaseLoginButtonContainerComponent } from './login.button.component';
import { NgModule } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxActionModule, DbxRouterAnchorModule, DbxButtonModule, DbxReadableErrorModule } from '@dereekb/dbx-web';
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
import { DbxFormActionModule, DbxFormFormlyTextFieldModule, DbxFormIoModule, DbxFormlyModule, DbxFormModule } from '@dereekb/dbx-form';
import { DbxFirebaseEmailFormComponent } from './login.email.form.component';
import { DbxFirebaseLoginTermsComponent } from './login.terms.component';
import { DbxFirebaseLoginTermsSimpleComponent } from './login.terms.simple.component';
import { DbxFirebaseLoginContextBackButtonComponent } from './login.context.back.component';
import { DbxFirebaseEmailRecoveryFormComponent } from './login.email.recovery.form.component';

const importsAndExports = [
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
  imports: [CommonModule, MatIconModule, MatButtonModule, DbxRouterAnchorModule, DbxFormIoModule, DbxFormModule, DbxFormlyModule, DbxFormActionModule, DbxFormFormlyTextFieldModule, DbxReadableErrorModule, DbxActionModule, DbxButtonModule, DbxInjectionComponentModule],
  declarations: importsAndExports,
  exports: importsAndExports
})
export class DbxFirebaseLoginModule {}
