import { Component, inject } from '@angular/core';
import { DbxFirebaseAuthLoginService, DbxFirebaseAuthService } from '@dereekb/dbx-firebase';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxContentBorderDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.border.directive';
import { MatButton } from '@angular/material/button';
import { DbxFirebaseLoginComponent } from '../../../../../../../../../packages/dbx-firebase/src/lib/auth/login/login.component';
import { DbxFirebaseLoginTermsComponent } from '../../../../../../../../../packages/dbx-firebase/src/lib/auth/login/login.terms.component';
import { DbxFirebaseRegisterComponent } from '../../../../../../../../../packages/dbx-firebase/src/lib/auth/login/register.component';
import { AsyncPipe } from '@angular/common';
import { PrettyJsonPipe } from '../../../../../../../../../packages/dbx-core/src/lib/pipe/misc/prettyjson.pipe';

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
