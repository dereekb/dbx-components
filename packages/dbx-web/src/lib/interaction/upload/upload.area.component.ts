import { ChangeDetectionStrategy, Component, computed, HostListener, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Maybe } from '@dereekb/util';
import { FileArrayAcceptMatchConfig, fileArrayAcceptMatchFunction, FileArrayAcceptMatchResult } from './upload.accept';

export interface DbxFileUploadAreaFilesChangedEvent {
  readonly allFiles: File[];
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
    @if (hintSignal()) {
      <div class="dbx-file-upload-area-content-hint dbx-hint dbx-small">{{ hintSignal() }}</div>
    }
  `,
  host: {
    class: 'dbx-file-upload-area dbx-block',
    '[class.dbx-file-upload-area-with-hint]': 'hintSignal()',
    '[class.dbx-file-upload-area-drag-over]': 'dragOverStateSignal()'
  },
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFileUploadAreaComponent {
  readonly icon = input<Maybe<string>>();
  readonly text = input<Maybe<string>>();
  readonly hint = input<Maybe<string | boolean>>();

  readonly hintSignal = computed(() => {
    const hint = this.hint();
    return typeof hint === 'string' ? hint : hint === true ? 'Drag to upload' : null;
  });

  readonly multiple = input<boolean, Maybe<boolean | ''>>(false, { transform: (x) => x === '' || Boolean(x) });
  readonly accept = input<FileArrayAcceptMatchConfig['accept']>([]);
  readonly filesChanged = output<DbxFileUploadAreaFilesChangedEvent>();
  readonly areaClicked = output<void>();
  readonly areaDragActiveChanged = output<boolean>();

  readonly dragOverStateSignal = signal<boolean>(false);
  readonly filesAcceptedFunctionSignal = computed(() => fileArrayAcceptMatchFunction({ multiple: this.multiple(), accept: this.accept() }));

  @HostListener('click', ['$event'])
  onClick(evt: MouseEvent) {
    evt.stopPropagation();
    this.areaClicked.emit();
  }

  @HostListener('dragover', ['$event'])
  onDragOver(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.dragOverStateSignal.set(true);
    this.areaDragActiveChanged.emit(true);
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.dragOverStateSignal.set(false);
    this.areaDragActiveChanged.emit(false);
  }

  @HostListener('drop', ['$event'])
  onDrop(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.dragOverStateSignal.set(false);

    const allFiles = evt.dataTransfer?.files;

    if (allFiles) {
      const matchResult = this.filesAcceptedFunctionSignal()(Array.from(allFiles));
      this.filesChanged.emit({ allFiles: matchResult.input, matchResult });
    }
  }
}
