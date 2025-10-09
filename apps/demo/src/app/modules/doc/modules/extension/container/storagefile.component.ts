import { DbxContentContainerDirective, DbxFileUploadComponent } from '@dereekb/dbx-web';
import { Component, inject } from '@angular/core';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxFirebaseStorageFileUploadActionDirective, DbxFirebaseStorageService, storageFileUploadHandler } from '@dereekb/dbx-firebase';
import { userAvatarUploadsFilePath, userTestFileUploadsFilePath } from 'demo-firebase';
import { DbxAuthService } from '@dereekb/dbx-core';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  templateUrl: './storagefile.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxFileUploadComponent, DbxFirebaseStorageFileUploadActionDirective]
})
export class DocExtensionStorageFileComponent {
  readonly storageService = inject(DbxFirebaseStorageService);
  readonly authService = inject(DbxAuthService);

  readonly userId = toSignal(this.authService.userIdentifier$);

  readonly avatarUploadHandler = storageFileUploadHandler({
    storageService: this.storageService,
    storagePathFactory: (file) => userAvatarUploadsFilePath(this.userId() ?? '0')
  });

  readonly filesUploadHandler = storageFileUploadHandler({
    storageService: this.storageService,
    storagePathFactory: (file) => userTestFileUploadsFilePath(this.userId() ?? '0', file.name)
  });
}
