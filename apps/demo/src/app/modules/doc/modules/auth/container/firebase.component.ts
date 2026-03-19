import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxFirebaseAuthLoginService, DbxFirebaseAuthService, DbxFirebaseLoginComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent } from '@dereekb/dbx-firebase';
import { DbxContentContainerDirective, DbxContentBorderDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButton } from '@angular/material/button';
import { PrettyJsonPipe } from '@dereekb/dbx-core';

@Component({
  templateUrl: './firebase.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentBorderDirective, MatButton, DbxFirebaseLoginComponent, DbxFirebaseLoginTermsComponent, DbxFirebaseRegisterComponent, PrettyJsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocAuthFirebaseComponent {
  readonly dbxFirebaseAuthLoginService = inject(DbxFirebaseAuthLoginService);
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);

  readonly authUserInfo$ = this.dbxFirebaseAuthService.currentAuthUserInfo$;
  readonly authUserInfoSignal = toSignal(this.authUserInfo$, { initialValue: undefined });

  logOut() {
    this.dbxFirebaseAuthService.logOut();
  }
}
