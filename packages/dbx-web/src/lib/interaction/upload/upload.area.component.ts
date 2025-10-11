import { ChangeDetectionStrategy, Component, computed, HostListener, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Maybe } from '@dereekb/util';
import { FileArrayAcceptMatchConfig, fileArrayAcceptMatchFunction } from './upload.accept';
import { NgTemplateOutlet } from '@angular/common';
import { AbstractDbxFileUploadComponent, DbxFileUploadFilesChangedEvent } from './abstract.upload.component';
import { provideDbxFileUploadActionCompatable } from './upload.action';

export type DbxFileUploadAreaFilesChangedEvent = DbxFileUploadFilesChangedEvent;

@Component({
  selector: 'dbx-file-upload-area',
  template: `
    @if (show()) {
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
          <ng-template [ngTemplateOutlet]="contentTemplate"></ng-template>
        </div>
      </div>
      @if (hintSignal()) {
        <div class="dbx-file-upload-area-content-hint dbx-hint dbx-small">{{ hintSignal() }}</div>
      }
    } @else {
      <ng-template [ngTemplateOutlet]="contentTemplate"></ng-template>
    }

    <!-- Content Template -->
    <ng-template #contentTemplate>
      <ng-content></ng-content>
    </ng-template>
  `,
  host: {
    class: 'dbx-file-upload-area dbx-block',
    '[class.dbx-file-upload-area-with-hint]': 'hintSignal()',
    '[class.dbx-file-upload-area-disabled]': 'disabledSignal()',
    '[class.dbx-file-upload-area-working]': 'isWorkingSignal()',
    '[class.dbx-file-upload-area-drag-over]': '!disabledSignal() && dragOverStateSignal()'
  },
  providers: provideDbxFileUploadActionCompatable(DbxFileUploadAreaComponent),
  imports: [MatIconModule, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFileUploadAreaComponent extends AbstractDbxFileUploadComponent {
  readonly icon = input<Maybe<string>>();
  readonly text = input<Maybe<string>>();
  readonly hint = input<Maybe<string | boolean>>();
  readonly show = input<boolean>(true);

  readonly hintSignal = computed(() => {
    const hint = this.hint();
    return typeof hint === 'string' ? hint : hint === true ? 'Drag to upload' : null;
  });

  readonly filesChanged = output<DbxFileUploadAreaFilesChangedEvent>();
  readonly areaClicked = output<void>();
  readonly areaDragActiveChanged = output<boolean>();

  readonly dragOverStateSignal = signal<boolean>(false);
  readonly filesAcceptedFunctionSignal = computed(() => fileArrayAcceptMatchFunction({ multiple: this.multipleSignal() ?? false, accept: this.acceptSignal() }));

  @HostListener('click', ['$event'])
  onClick(evt: MouseEvent) {
    evt.stopPropagation();

    if (!this.disabled()) {
      this.areaClicked.emit();
    }
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

    if (!this.disabled()) {
      const allFiles = evt.dataTransfer?.files;

      if (allFiles) {
        const matchResult = this.filesAcceptedFunctionSignal()(Array.from(allFiles));
        this.filesChanged.emit({ allFiles: matchResult.input, matchResult });
      }
    }
  }
}
