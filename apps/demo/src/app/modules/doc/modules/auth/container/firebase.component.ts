import { Component, inject } from '@angular/core';
import { DbxFirebaseAuthLoginService, DbxFirebaseAuthService, DbxFirebaseLoginComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent } from '@dereekb/dbx-firebase';
import { DbxContentContainerDirective, DbxContentBorderDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { PrettyJsonPipe } from '@dereekb/dbx-core';

@Component({
  templateUrl: './firebase.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentBorderDirective, MatButton, DbxFirebaseLoginComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent, AsyncPipe, PrettyJsonPipe]
})
export class DocAuthFirebaseComponent {
  readonly dbxFirebaseAuthLoginService = inject(DbxFirebaseAuthLoginService);
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  readonly authUserInfo$ = this.dbxFirebaseAuthService.currentAuthUserInfo$;

  logOut() {
    this.dbxFirebaseAuthService.logOut();
  }
}
