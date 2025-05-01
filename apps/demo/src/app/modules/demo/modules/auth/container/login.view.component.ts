import { Component } from '@angular/core';
import { DbxFirebaseLoginMode } from '@dereekb/dbx-firebase';
import { NgSwitch, NgSwitchCase } from '@angular/common';
import { DbxFirebaseLoginComponent } from '../../../../../../../../../packages/dbx-firebase/src/lib/auth/login/login.component';
import { DbxLinkComponent } from '../../../../../../../../../packages/dbx-web/src/lib/router/layout/anchor/anchor.link.component';
import { DbxFirebaseLoginTermsComponent } from '../../../../../../../../../packages/dbx-firebase/src/lib/auth/login/login.terms.component';
import { DbxFirebaseRegisterComponent } from '../../../../../../../../../packages/dbx-firebase/src/lib/auth/login/register.component';

@Component({
    selector: 'demo-login-view',
    templateUrl: './login.view.component.html',
    standalone: true,
    imports: [NgSwitch, NgSwitchCase, DbxFirebaseLoginComponent, DbxLinkComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent]
})
export class DemoAuthLoginViewComponent {
  mode: DbxFirebaseLoginMode = 'login';
}
