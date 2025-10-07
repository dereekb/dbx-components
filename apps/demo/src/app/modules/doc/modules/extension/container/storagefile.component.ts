import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { Component } from '@angular/core';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxFirebaseStorageFileUploadAvatarComponent, DbxFirebaseStorageFileUploadDirective, DbxFirebaseStorageFileUploadFilesComponent } from '@dereekb/dbx-firebase';

@Component({
  templateUrl: './storagefile.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxFirebaseStorageFileUploadDirective, DbxFirebaseStorageFileUploadAvatarComponent, DbxFirebaseStorageFileUploadFilesComponent]
})
export class DocExtensionStorageFileComponent {}
