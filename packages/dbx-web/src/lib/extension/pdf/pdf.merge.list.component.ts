import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { type CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergeEntryComponent } from './pdf.merge.entry.component';

/**
 * Renders the staged entries inside a CDK drop list. Each row is a {@link DbxPdfMergeEntryComponent} that hosts its own `cdkDrag`, so reordering events bubble up here as `cdkDropListDropped` and forward to the store's `moveEntry` updater.
 */
@Component({
  selector: 'dbx-pdf-merge-list',
  template: `
    @if (entries$ | async; as entries) {
      @if (entries.length === 0) {
        <div class="dbx-list-empty-content dbx-hint dbx-p4">No files added yet.</div>
      } @else {
        <div class="dbx-pdf-merge-list-items" cdkDropList (cdkDropListDropped)="onDrop($event)">
          @for (entry of entries; track entry.id) {
            <dbx-pdf-merge-entry [entry]="entry"></dbx-pdf-merge-entry>
          }
        </div>
      }
    }
  `,
  host: {
    class: 'dbx-pdf-merge-list'
  },
  imports: [AsyncPipe, CdkDropList, DbxPdfMergeEntryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPdfMergeListComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly entries$ = this.store.entries$;

  onDrop(event: CdkDragDrop<unknown>): void {
    this.store.moveEntry({ previousIndex: event.previousIndex, currentIndex: event.currentIndex });
  }
}
