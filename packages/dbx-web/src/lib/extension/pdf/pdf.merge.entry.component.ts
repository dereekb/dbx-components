import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CdkDrag, CdkDragHandle, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { type PdfMergeEntry } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';

const PDF_ICON = 'picture_as_pdf';
const IMAGE_ICON = 'image';
const ERROR_ICON = 'error';

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * 1024;

function formatPdfMergeEntrySize(size: number): string {
  let result: string;

  if (size >= MEGABYTE) {
    result = `${(size / MEGABYTE).toFixed(1)} MB`;
  } else if (size >= KILOBYTE) {
    result = `${(size / KILOBYTE).toFixed(1)} KB`;
  } else {
    result = `${size} B`;
  }

  return result;
}

/**
 * Single row inside the {@link DbxPdfMergeListComponent}: shows the file's icon, name, formatted size, status, drag handle, and a remove button. The component's template is itself a `cdkDrag` element so each row can be reordered inside the parent's `cdkDropList`.
 */
@Component({
  selector: 'dbx-pdf-merge-entry',
  template: `
    <div class="dbx-pdf-merge-entry-row" cdkDrag cdkDragLockAxis="y">
      <ng-template cdkDragPlaceholder>
        <div class="dbx-pdf-merge-entry-placeholder"></div>
      </ng-template>
      <button mat-icon-button type="button" cdkDragHandle class="dbx-pdf-merge-entry-handle" aria-label="Drag to reorder">
        <mat-icon>drag_indicator</mat-icon>
      </button>
      <mat-icon class="dbx-pdf-merge-entry-icon" [class.dbx-warn]="isErrorSignal()">{{ iconSignal() }}</mat-icon>
      <div class="dbx-pdf-merge-entry-info dbx-flex-fill-0">
        <div class="dbx-pdf-merge-entry-name dbx-text-truncate" [title]="entry().name">{{ entry().name }}</div>
        <div class="dbx-pdf-merge-entry-meta dbx-hint dbx-small">
          <span>{{ sizeSignal() }}</span>
          @if (statusLabelSignal(); as label) {
            <span class="dbx-pdf-merge-entry-status" [class.dbx-warn]="isErrorSignal()">{{ label }}</span>
          }
        </div>
      </div>
      @if (isValidatingSignal()) {
        <mat-progress-spinner mode="indeterminate" diameter="20"></mat-progress-spinner>
      }
      <button mat-icon-button type="button" class="dbx-pdf-merge-entry-remove" (click)="onRemove()" aria-label="Remove file">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  host: {
    class: 'dbx-pdf-merge-entry d-block',
    '[class.dbx-pdf-merge-entry--error]': 'isErrorSignal()',
    '[class.dbx-pdf-merge-entry--validating]': 'isValidatingSignal()'
  },
  imports: [CdkDrag, CdkDragHandle, CdkDragPlaceholder, MatIconModule, MatButtonModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPdfMergeEntryComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly entry = input.required<PdfMergeEntry>();

  readonly iconSignal = computed(() => {
    const entry = this.entry();
    let icon: string;

    if (entry.status === 'error') {
      icon = ERROR_ICON;
    } else if (entry.kind === 'pdf') {
      icon = PDF_ICON;
    } else {
      icon = IMAGE_ICON;
    }

    return icon;
  });

  readonly sizeSignal = computed(() => formatPdfMergeEntrySize(this.entry().size));

  readonly isValidatingSignal = computed(() => this.entry().status === 'validating');
  readonly isErrorSignal = computed(() => this.entry().status === 'error');

  readonly statusLabelSignal = computed(() => {
    const entry = this.entry();
    let label: string | null;

    if (entry.status === 'validating') {
      label = 'Checking…';
    } else if (entry.status === 'error') {
      label = entry.errorMessage ?? 'Cannot merge';
    } else {
      label = null;
    }

    return label;
  });

  onRemove(): void {
    this.store.removeEntry(this.entry().id);
  }
}
