import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
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
  selector: 'dbx-firebase-storagefile-upload-avatar',
  templateUrl: './storagefile.upload.avatar.component.html',
  imports: [CommonModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, MatInputModule, DbxFileUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseStorageFileUploadAvatarComponent {
  private readonly _uploadStore = inject(DbxFirebaseStorageFileUploadStore);
  private readonly _destroyRef = inject(DestroyRef);

  private _activeObjectUrl?: Maybe<string>;
  private _dragCounter = 0;

  readonly isDragOverSignal = signal(false);

  constructor() {
    this._uploadStore.setIsComponentMultiUploadAllowed(false); // avatar upload only allows a single file
    this._uploadStore.setComponentFileTypesAccepted(['image/*']); // any image file by default

    this._destroyRef.onDestroy(() => {
      if (this._activeObjectUrl) {
        URL.revokeObjectURL(this._activeObjectUrl);
        this._activeObjectUrl = undefined;
      }
    });
  }

  readonly multiUploadSignal = toSignal(this._uploadStore.isMultiUploadAllowed$, { initialValue: false });
  readonly acceptSignal = toSignal<Maybe<string>>(this._uploadStore.fileTypesAcceptString$);
  readonly fileListSignal = toSignal<Maybe<File[]>>(this._uploadStore.files$);

  readonly selectedFileSignal = computed(() => this.fileListSignal()?.[0] ?? undefined);
  readonly selectedFileNameSignal = computed(() => this.selectedFileSignal()?.name ?? undefined);

  avatarFilesChanged(event: DbxFileUploadFilesChangedEvent) {
    this._uploadStore.setFiles(event.matchResult.accepted);
  }

  /*
  private readonly _previewUrlSignal = signal<Maybe<string>>(undefined);
  readonly previewUrlSignal = this._previewUrlSignal.asReadonly();

  private readonly _syncPreviewEffect = effect(() => {
    const file = this.selectedFileSignal();
    const currentUrl = this._activeObjectUrl;

    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      this._activeObjectUrl = undefined;
    }

    if (!file) {
      this._previewUrlSignal.set(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    this._activeObjectUrl = objectUrl;
    this._previewUrlSignal.set(objectUrl);
  });

  triggerFileInput(fileInput: HTMLInputElement): void {
    fileInput.click();
  }

  onFileInputChange(fileInput: HTMLInputElement): void {
    this.onPickAvatarFile(fileInput.files);
    fileInput.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this._dragCounter = 0;
    this.isDragOverSignal.set(false);
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.onPickAvatarFile(files);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this._dragCounter++;
    this.isDragOverSignal.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this._dragCounter = Math.max(0, this._dragCounter - 1);
    if (this._dragCounter === 0) {
      this.isDragOverSignal.set(false);
    }
  }

  onPickAvatarFile(fileList: Maybe<FileList | File[]>): void {
    const singleFileList = this._createSingleFileList(fileList);
    this._uploadStore.setFileList(singleFileList ?? undefined);
  }

  private _createSingleFileList(fileList: Maybe<FileList | File[]>): Maybe<FileList> {
    if (!fileList) {
      return undefined;
    }

    const files = Array.from(fileList instanceof FileList ? Array.from(fileList) : fileList);
    if (files.length === 0) {
      return undefined;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(files[0]);
    return dataTransfer.files;
  }
    */
}
