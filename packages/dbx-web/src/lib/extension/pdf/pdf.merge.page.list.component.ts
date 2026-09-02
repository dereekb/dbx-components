import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { combineLatest, map, type Observable, shareReplay, switchMap } from 'rxjs';
import { type Maybe } from '@dereekb/util';
import { DBX_PDF_MERGE_ENCRYPTED_NOT_EDITABLE_MESSAGE, DBX_PDF_MERGE_IGNORED_ENTRY_MESSAGE, pdfMergePageGroupKeyForSlotId, type PdfMergeEntryView, type PdfMergePageGroup } from './pdf.merge';
import { DbxPdfMergeEditorStore } from './pdf.merge.editor.store';
import { DbxPdfMergePageComponent } from './pdf.merge.page.component';
import { formatPdfMergeEntrySize } from './pdf.merge.utility';

/**
 * Message shown for an entry that is not encrypted but still could not be parsed into pages.
 */
const UNREADABLE_PAGES_MESSAGE = 'Pages could not be read.';

const IGNORED_ICON = 'block';
const ENCRYPTED_ICON = 'lock';
const UNREADABLE_ICON = 'error';

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
      <div class="dbx-pdf-merge-page-unexpandable" [class.dbx-pdf-merge-page-unexpandable--ignored]="entry.ignored">
        <mat-icon class="dbx-pdf-merge-page-unexpandable-icon">{{ iconForUnexpandable(entry) }}</mat-icon>
        <div class="dbx-pdf-merge-page-unexpandable-info dbx-flex-fill-0">
          <div class="dbx-pdf-merge-page-unexpandable-name dbx-text-truncate" [title]="entry.name">{{ entry.name }}</div>
          <div class="dbx-pdf-merge-page-unexpandable-meta dbx-hint dbx-small">
            <span>{{ sizeForUnexpandable(entry) }}</span>
            <span>{{ messageForUnexpandable(entry) }}</span>
          </div>
        </div>
        <button mat-icon-button type="button" class="dbx-pdf-merge-page-unexpandable-remove" (click)="onRemove(entry)" [attr.aria-label]="'Remove ' + entry.name">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    }
  `,
  host: {
    class: 'dbx-pdf-merge-page-list d-block'
  },
  imports: [CdkDropList, MatIconModule, MatButtonModule, DbxPdfMergePageComponent]
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

  /**
   * Explains why the entry has no pages in the list. The `ignored` check comes first: an ignored encrypted entry is out of the merge because something else is the focus target, which is the more actionable of the two facts.
   *
   * @param entry - Entry contributing no pages.
   * @returns Message for the row.
   */
  messageForUnexpandable(entry: PdfMergeEntryView): string {
    let message: string;

    if (entry.ignored) {
      message = DBX_PDF_MERGE_IGNORED_ENTRY_MESSAGE;
    } else if (entry.encrypted) {
      message = DBX_PDF_MERGE_ENCRYPTED_NOT_EDITABLE_MESSAGE;
    } else {
      message = UNREADABLE_PAGES_MESSAGE;
    }

    return message;
  }

  iconForUnexpandable(entry: PdfMergeEntryView): string {
    let icon: string;

    if (entry.ignored) {
      icon = IGNORED_ICON;
    } else if (entry.encrypted) {
      icon = ENCRYPTED_ICON;
    } else {
      icon = UNREADABLE_ICON;
    }

    return icon;
  }

  sizeForUnexpandable(entry: PdfMergeEntryView): string {
    return formatPdfMergeEntrySize(entry.size);
  }

  onRemove(entry: PdfMergeEntryView): void {
    this.store.removeEntry(entry.id);
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
