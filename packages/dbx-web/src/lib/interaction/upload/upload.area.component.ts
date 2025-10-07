import { ChangeDetectionStrategy, Component, computed, HostListener, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Maybe } from '@dereekb/util';
import { FileArrayAcceptMatchConfig, fileArrayAcceptMatchFunction, FileArrayAcceptMatchResult } from './upload.accept';

export type DbxFileUploadAreaShape = 'rounded' | 'square';

export interface DbxFileUploadAreaFilesChangedEvent {
  readonly allFiles: FileList;
  readonly matchResult: FileArrayAcceptMatchResult;
}

@Component({
  selector: 'dbx-file-upload-area',
  template: `
    <div class="dbx-file-upload-area-content">
      <div class="dbx-file-upload-area-content-text">
        @if (icon() != null) {
          <mat-icon>{{ icon() }}</mat-icon>
        }
        @if (text() != null) {
          <span>{{ text() }}</span>
        }
      </div>
      <div class="dbx-file-upload-area-content-wrapped">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  host: {
    class: 'dbx-file-upload-area dbx-block',
    '[class]': '"dbx-file-upload-area-" + uploadAreaShape()',
    '[class.dbx-file-upload-area-drag-over]': 'dragOverStateSignal()'
  },
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFileUploadAreaComponent {
  readonly icon = input<Maybe<string>>();
  readonly text = input<Maybe<string>>();

  readonly uploadAreaShape = input<DbxFileUploadAreaShape>('rounded');
  readonly filesAccepted = input<FileArrayAcceptMatchConfig['accept']>([]);

  readonly filesChanged = output<DbxFileUploadAreaFilesChangedEvent>();

  readonly dragOverStateSignal = signal<boolean>(false);

  readonly filesAcceptedFunctionSignal = computed(() => fileArrayAcceptMatchFunction({ accept: this.filesAccepted() }));

  @HostListener('dragover', ['$event'])
  onDragOver(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.dragOverStateSignal.set(true);
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.dragOverStateSignal.set(false);
  }

  @HostListener('drop', ['$event'])
  onDrop(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.dragOverStateSignal.set(false);

    const allFiles = evt.dataTransfer?.files;

    if (allFiles) {
      const acceptedFiles = this.filesAcceptedFunctionSignal()(Array.from(allFiles));
      this.filesChanged.emit({ allFiles, matchResult: acceptedFiles });
    }
  }
}
