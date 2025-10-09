import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Maybe } from '@dereekb/util';
import { DbxFirebaseStorageFileUploadStore } from '../store/storagefile.upload.store';
import { DbxFileUploadComponent, DbxFileUploadFilesChangedEvent } from '@dereekb/dbx-web';

@Component({
  selector: 'dbx-firebase-storagefile-upload-button',
  templateUrl: './storagefile.upload.button.component.html',
  imports: [CommonModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, DbxFileUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseStorageFileUploadButtonComponent {
  private readonly _uploadStore = inject(DbxFirebaseStorageFileUploadStore);

  constructor() {
    this._uploadStore.setIsComponentMultiUploadAllowed(false); // button upload only allows a single file
  }

  readonly acceptSignal = toSignal<Maybe<string>>(this._uploadStore.fileTypesAcceptString$);

  buttonFilesChanged(event: DbxFileUploadFilesChangedEvent) {
    this._uploadStore.setFiles(event.matchResult.accepted);
  }
}
