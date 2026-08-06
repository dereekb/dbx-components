import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { combineLatest, map, type Observable, shareReplay, switchMap } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { DBX_PDF_MERGE_ENCRYPTED_NOT_EDITABLE_MESSAGE, pdfMergePageGroupKeyForSlotId, type PdfMergeEntryView, type PdfMergePageGroup } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergePageComponent } from './pdf.merge.page.component';

/**
 * Message shown for an entry that is not encrypted but still could not be parsed into pages.
 */
const UNREADABLE_PAGES_MESSAGE = 'Pages could not be read.';

/**
 * Renders the editor's page plan while page editing is enabled, one CDK drop list per group.
 *
 * Separate, unconnected drop lists are what confine reordering to a single slot: CDK will not let a drag cross into a list it is not connected to, so the rule needs no guard code. Bind {@link slotId} to render only that slot's group — used by {@link DbxPdfMergeEditorFileUploadComponent} to show its own pages inline. Leave it unbound to render every group.
 *
 * Entries that could not be expanded into pages (encrypted, or unparseable) are listed separately below the groups rather than silently omitted.
 */
@Component({
  selector: 'dbx-pdf-merge-page-list',
  template: `
    @if (groupsSignal(); as groups) {
      @if (groups.length === 0 && unexpandableSignal().length === 0) {
        <div class="dbx-list-empty-content dbx-hint dbx-p4">No pages yet.</div>
      } @else {
        @for (group of groups; track group.groupKey) {
          <div class="dbx-pdf-merge-page-group">
            @if (labelForGroup(group); as label) {
              <div class="dbx-pdf-merge-page-group-label dbx-hint dbx-small">{{ label }}</div>
            }
            <div class="dbx-pdf-merge-page-group-items" cdkDropList (cdkDropListDropped)="onDrop(group, $event)">
              @for (page of group.pages; track page.id) {
                <dbx-pdf-merge-page [page]="page"></dbx-pdf-merge-page>
              }
            </div>
          </div>
        }
      }
    }
    @for (entry of unexpandableSignal(); track entry.id) {
      <div class="dbx-pdf-merge-page-unexpandable">
        <mat-icon class="dbx-pdf-merge-page-unexpandable-icon">lock</mat-icon>
        <span class="dbx-pdf-merge-page-unexpandable-name dbx-text-truncate" [title]="entry.name">{{ entry.name }}</span>
        <span class="dbx-hint dbx-small">{{ messageForUnexpandable(entry) }}</span>
      </div>
    }
  `,
  host: {
    class: 'dbx-pdf-merge-page-list d-block'
  },
  imports: [CdkDropList, MatIconModule, DbxPdfMergePageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPdfMergePageListComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  /**
   * Renders only this slot's group when bound. Leave unbound to render every group.
   */
  readonly slotId = input<Maybe<string>>();
  /**
   * Whether to show each group's slot name above its pages. Defaults to `true` when rendering every group and `false` when scoped to one slot, where the slot already has its own heading.
   */
  readonly showGroupLabels = input<Maybe<boolean>>();

  private readonly _slotId$ = toObservable(this.slotId);

  readonly groups$: Observable<PdfMergePageGroup[]> = this._slotId$.pipe(
    switchMap((slotId) => {
      let groups$: Observable<PdfMergePageGroup[]>;

      if (slotId == null) {
        groups$ = this.store.pageGroups$;
      } else {
        const groupKey = pdfMergePageGroupKeyForSlotId(slotId);
        groups$ = this.store.pagesForSlotId$(slotId).pipe(map((pages) => (pages.length === 0 ? [] : [{ groupKey, slotId, pages }])));
      }

      return groups$;
    }),
    shareReplay(1)
  );

  readonly unexpandable$: Observable<PdfMergeEntryView[]> = combineLatest([this.store.unexpandableEntries$, this._slotId$]).pipe(
    map(([entries, slotId]) => (slotId == null ? entries : entries.filter((entry) => entry.slotId === slotId))),
    shareReplay(1)
  );

  readonly groupsSignal = toSignal(this.groups$, { initialValue: [] as PdfMergePageGroup[] });
  readonly unexpandableSignal = toSignal(this.unexpandable$, { initialValue: [] as PdfMergeEntryView[] });

  readonly showGroupLabelsSignal = computed(() => {
    const slotId = this.slotId();
    return this.showGroupLabels() ?? slotId == null;
  });

  labelForGroup(group: PdfMergePageGroup): Maybe<string> {
    return this.showGroupLabelsSignal() ? group.slotId : null;
  }

  messageForUnexpandable(entry: PdfMergeEntryView): string {
    return entry.encrypted ? DBX_PDF_MERGE_ENCRYPTED_NOT_EDITABLE_MESSAGE : UNREADABLE_PAGES_MESSAGE;
  }

  onDrop(group: PdfMergePageGroup, event: CdkDragDrop<unknown>): void {
    this.store.movePageWithinGroup({
      groupKey: group.groupKey,
      pageIds: group.pages.map((page) => page.id),
      previousIndex: event.previousIndex,
      currentIndex: event.currentIndex
    });
  }
}
