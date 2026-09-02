import { Component, computed, inject, input } from '@angular/core';
import { CdkDrag, CdkDragHandle, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import type { Maybe } from '@dereekb/util';
import { type PdfMergePageRotation, type PdfMergePageView } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxChipDirective } from '../../layout/text/text.chip.directive';

const PDF_ICON = 'picture_as_pdf';
const IMAGE_ICON = 'image';

/**
 * Degrees added by one press of the rotate control.
 */
const ROTATION_STEP_DEGREES = 90;

/**
 * PDF points per inch. PDF page dimensions are expressed in points; inches read better on a scanned document.
 */
const POINTS_PER_INCH = 72;

const ROTATION_VALUES: readonly PdfMergePageRotation[] = [0, 90, 180, 270];

/**
 * Single page row inside a {@link DbxPdfMergePageListComponent} group: shows which source file and page it came from, its dimensions and rotation, and controls to rotate it, mark it for removal, and drag it to a new position.
 *
 * The template's root element is itself a `cdkDrag`, matching {@link DbxPdfMergeEntryComponent}, so rows reorder inside their group's drop list.
 */
@Component({
  selector: 'dbx-pdf-merge-page',
  template: `
    <div class="dbx-pdf-merge-page-row" cdkDrag cdkDragLockAxis="y">
      <ng-template cdkDragPlaceholder>
        <div class="dbx-pdf-merge-page-placeholder"></div>
      </ng-template>
      <button mat-icon-button type="button" cdkDragHandle class="dbx-pdf-merge-page-handle" aria-label="Drag to reorder page">
        <mat-icon>drag_indicator</mat-icon>
      </button>
      <mat-icon class="dbx-pdf-merge-page-icon">{{ iconSignal() }}</mat-icon>
      <div class="dbx-pdf-merge-page-info dbx-flex-fill-0">
        <div class="dbx-pdf-merge-page-name dbx-text-truncate" [title]="page().sourceName">{{ page().sourceName }}</div>
        <div class="dbx-pdf-merge-page-meta dbx-hint dbx-small">
          <span class="dbx-pdf-merge-page-position">{{ positionLabelSignal() }}</span>
          @if (dimensionsLabelSignal(); as dimensions) {
            <span class="dbx-pdf-merge-page-dimensions">{{ dimensions }}</span>
          }
          @if (rotationLabelSignal(); as rotation) {
            <dbx-chip class="dbx-pdf-merge-page-rotation-chip" [small]="true">
              <mat-icon class="dbx-pdf-merge-page-rotation-icon">rotate_right</mat-icon>
              <span>{{ rotation }}</span>
            </dbx-chip>
          }
          @if (removedSignal()) {
            <span class="dbx-pdf-merge-page-removed-label dbx-warn">Will be removed</span>
          }
        </div>
      </div>
      <button mat-icon-button type="button" class="dbx-pdf-merge-page-rotate" [disabled]="removedSignal()" (click)="onRotate()" aria-label="Rotate page 90 degrees">
        <mat-icon>rotate_right</mat-icon>
      </button>
      <button mat-icon-button type="button" class="dbx-pdf-merge-page-remove" (click)="onToggleRemoved()" [attr.aria-label]="removeLabelSignal()">
        <mat-icon>{{ removedSignal() ? 'undo' : 'close' }}</mat-icon>
      </button>
    </div>
  `,
  host: {
    class: 'dbx-pdf-merge-page d-block',
    '[class.dbx-pdf-merge-page--removed]': 'removedSignal()'
  },
  imports: [CdkDrag, CdkDragHandle, CdkDragPlaceholder, MatIconModule, MatButtonModule, DbxChipDirective]
})
export class DbxPdfMergePageComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly page = input.required<PdfMergePageView>();

  readonly removedSignal = computed(() => this.page().removed);
  readonly iconSignal = computed(() => (this.page().kind === 'pdf' ? PDF_ICON : IMAGE_ICON));
  readonly removeLabelSignal = computed(() => (this.removedSignal() ? 'Restore page' : 'Mark page for removal'));

  readonly positionLabelSignal = computed(() => {
    const page = this.page();
    let label: string;

    if (page.kind === 'image') {
      label = 'Image';
    } else {
      label = `Page ${page.sourceIndex + 1} of ${page.sourcePageCount}`;
    }

    return label;
  });

  readonly dimensionsLabelSignal = computed<Maybe<string>>(() => {
    const { kind, meta } = this.page();
    let label: Maybe<string>;

    if (meta.width <= 0 || meta.height <= 0) {
      label = null;
    } else if (kind === 'image') {
      label = `${Math.round(meta.width)} × ${Math.round(meta.height)} px`;
    } else {
      label = `${(meta.width / POINTS_PER_INCH).toFixed(1)} × ${(meta.height / POINTS_PER_INCH).toFixed(1)} in`;
    }

    return label;
  });

  readonly rotationLabelSignal = computed<Maybe<string>>(() => {
    const rotation = this.page().rotation;
    return rotation === 0 ? null : `${rotation}°`;
  });

  onRotate(): void {
    const page = this.page();
    const next = ROTATION_VALUES[((page.rotation + ROTATION_STEP_DEGREES) / ROTATION_STEP_DEGREES) % ROTATION_VALUES.length];
    this.store.setPageRotation({ pageId: page.id, rotation: next });
  }

  onToggleRemoved(): void {
    const page = this.page();
    this.store.setPageRemoved({ pageId: page.id, removed: !page.removed });
  }
}
