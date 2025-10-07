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
  selector: 'dbx-firebase-storagefile-upload-progress',
  templateUrl: './storagefile.upload.progress.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseStorageFileUploadProgressComponent {
  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);

  constructor() {
    this.uploadStore.setIsComponentMultiUploadAllowed(true); // can upload multiple files
    this.uploadStore.setComponentFileTypesAccepted(null); // no restrictions
  }

  readonly multiUploadSignal = toSignal(this.uploadStore.isMultiUploadAllowed$, { initialValue: false });
  readonly acceptSignal = toSignal<Maybe<string>>(this.uploadStore.fileTypesAcceptString$);

  /*
  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) {
      return;
    }

    const files = input.files ? Array.from(input.files) : [];
    if (!this.multiUploadSignal() && files.length > 1) {
      files.splice(1);
    }

    this.uploadStore.setFiles(files.length > 0 ? files : undefined);

    if (input.value) {
      input.value = '';
    }
  }
  */
}
