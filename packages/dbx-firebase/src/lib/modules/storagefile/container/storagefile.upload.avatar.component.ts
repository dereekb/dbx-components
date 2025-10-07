import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseStorageFileUploadStore } from '../store/storagefile.upload.store';

@Component({
  selector: 'dbx-firebase-storagefile-upload-avatar',
  templateUrl: './storagefile.upload.avatar.component.html',
  imports: [CommonModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseStorageFileUploadAvatarComponent {
  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);

  constructor() {
    this.uploadStore.setIsComponentMultiUploadAllowed(false); // avatar upload only allows a single file
    this.uploadStore.setComponentFileTypesAccepted(['image/*']); // any image file by default
  }

  readonly multiUploadSignal = toSignal(this.uploadStore.isMultiUploadAllowed$, { initialValue: false });
  readonly acceptSignal = toSignal<Maybe<string>>(this.uploadStore.fileTypesAcceptString$);

  onPickAvatarFile(fileList: FileList) {
    this.uploadStore.setFileList(fileList);
  }
}
