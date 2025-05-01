import { Component } from '@angular/core';
import { DbxFirebaseLoginMode } from '@dereekb/dbx-firebase';
import { NgSwitch, NgSwitchCase } from '@angular/common';
import { DbxFirebaseLoginComponent } from '@dereekb/dbx-firebase';
import { DbxLinkComponent } from '@dereekb/dbx-web';
import { DbxFirebaseLoginTermsComponent } from '@dereekb/dbx-firebase';
import { DbxFirebaseRegisterComponent } from '@dereekb/dbx-firebase';

@Component({
  selector: 'demo-login-view',
  templateUrl: './login.view.component.html',
  standalone: true,
  imports: [NgSwitch, NgSwitchCase, DbxFirebaseLoginComponent, DbxLinkComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent]
})
export class DemoAuthLoginViewComponent {
  mode: DbxFirebaseLoginMode = 'login';
}
