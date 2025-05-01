import { Component } from '@angular/core';
import { DbxFirebaseLoginMode, DbxFirebaseLoginComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent } from '@dereekb/dbx-firebase';
import { NgSwitch, NgSwitchCase } from '@angular/common';
import { DbxLinkComponent } from '@dereekb/dbx-web';

@Component({
  selector: 'demo-login-view',
  templateUrl: './login.view.component.html',
  standalone: true,
  imports: [NgSwitch, NgSwitchCase, DbxFirebaseLoginComponent, DbxLinkComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent]
})
export class DemoAuthLoginViewComponent {
  mode: DbxFirebaseLoginMode = 'login';
}
