import { Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { type ListLoadingState, successResult } from '@dereekb/rxjs';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';
import { DbxColorDirective, DbxIconTileComponent, DbxListEmptyContentComponent } from '@dereekb/dbx-web';
import { DocScheduleDayItemListComponent } from '../component/schedule.day.item.list.component';
import { makeScheduleDayItemValues, type ScheduleDayItemValue } from '../component/schedule.day.item.list';
import { DocTodoItemListComponent } from '../component/todo.item.list.component';
import { makeTodoItemValues, type TodoItemPresentation, type TodoItemValue } from '../component/todo.item.list';

interface TodoPresentationOption {
  readonly presentation: TodoItemPresentation;
  readonly label: string;
}

const TODO_PRESENTATION_OPTIONS: readonly TodoPresentationOption[] = [
  { presentation: 'urgent', label: 'Urgent highlight' },
  { presentation: 'standard', label: 'Standard' },
  { presentation: 'empty', label: 'All caught up' }
];

/**
 * Member-dashboard "Your Schedule" + "To Do" panels built from one shared row
 * utility. Both lists render `.dbx-list-detail-item` rows — a bold
 * `.item-title` followed by `.item-line` rows — and differ only in their
 * leading and trailing slots.
 *
 * The schedule list is hover-free and button-only: its wrapper host applies
 * `dbx-list-no-hover-effects` + `dbx-list-card-items-list`, and its view
 * strips each item's `anchor` so the row never becomes a click target (and the
 * list drops the ripple). Each row leads with a full-height
 * `.item-leading-block` date column painted by `[dbxColor]` + `.dbx-color-bg`,
 * and trails with an `.item-trailing-divided` button wrapped in `<dbx-anchor>`.
 * Days that don't follow the previous row are set apart by a "…"
 * `.dbx-list-detail-item-gap` marker: the view config's `separatorConfig`
 * pairs a separator component with a `showSeparator(previous, next)` function,
 * and the list injects the component (via `dbx-injection`) between any two
 * rows the function approves. The component reads both rows from
 * `DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR`.
 *
 * The to do list keeps the default hover + ripple and the whole row is the
 * click target (the view keeps `anchor`). The view's `metaConfig` adds the
 * built-in `DbxListViewMetaIconComponent` chevron in place of a trailing slot,
 * and `.dbx-list-detail-item-highlight` washes an urgent row — painting the
 * hosting list row via `:has()` so the wash spans the meta chevron too. The empty presentation projects `<dbx-list-empty-content empty>`.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug list-detail-item-schedule-todo
 * @dbxDocsUiExampleCategory list
 * @dbxDocsUiExampleSummary Shared .dbx-list-detail-item row (bold title + lines between leading/trailing slots) rendering a hover-free, button-only Schedule list with a full-height date block and "…" separatorConfig gap markers between non-consecutive days, and a row-clickable To Do list with the built-in chevron, an urgent highlight, and an empty state.
 * @dbxDocsUiExampleRelated dbx-list, dbx-list-detail-item, dbx-list-no-hover-effects, dbx-list-card-items-list, dbx-list-empty-content, dbx-list-detail-item-gap, dbx-anchor, dbx-button, dbx-chip, dbx-icon-tile, dbx-color
 * @dbxDocsUiExampleUses {@link DocScheduleDayItemListComponent} list
 * @dbxDocsUiExampleUses {@link DocScheduleDayItemListViewComponent} view
 * @dbxDocsUiExampleUses {@link DocScheduleDayItemListViewItemComponent} item
 * @dbxDocsUiExampleUses {@link DocScheduleDayGapComponent} separator
 * @dbxDocsUiExampleUses {@link ScheduleDayItemValue} data
 * @dbxDocsUiExampleUses {@link DocTodoItemListComponent} list
 * @dbxDocsUiExampleUses {@link DocTodoItemListViewComponent} view
 * @dbxDocsUiExampleUses {@link DocTodoItemListViewItemComponent} item
 * @dbxDocsUiExampleUses {@link TodoItemValue} data
 */
@Component({
  selector: 'doc-list-detail-item-example',
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, MatButtonModule, MatCardModule, FlexLayoutModule, DbxColorDirective, DbxIconTileComponent, DbxListEmptyContentComponent, DocScheduleDayItemListComponent, DocTodoItemListComponent],
  styles: [
    `
      .doc-list-detail-item-list {
        display: block;
        --dbx-list-content-max-height: 440px;
      }
    `
  ],
  template: `
    <dbx-docs-ui-example header=".dbx-list-detail-item Schedule + To Do Lists" hint="One shared row utility — bold title + lines between leading/trailing slots — powering a hover-free, button-only schedule list and a row-clickable to do list.">
      <dbx-docs-ui-example-info>
        <p>
          Both panels render
          <code>.dbx-list-detail-item</code>
          rows: an
          <code>.item-content</code>
          column of one bold
          <code>.item-title</code>
          followed by any number of
          <code>.item-line</code>
          rows (a leading
          <code>&lt;mat-icon&gt;</code>
          is sized for you), framed by an
          <code>.item-leading</code>
          and an
          <code>.item-trailing</code>
          slot. The row pads itself, so each view sets
          <code>dbx-list-item-p0</code>
          on its host.
        </p>
        <p>
          <strong>Your Schedule</strong>
          is hover-free and button-only. The wrapper host applies
          <code>dbx-list-no-hover-effects dbx-list-card-items-list</code>
          , and the view's
          <code>mapValuesToItemValues</code>
          drops
          <code>anchor</code>
          so the row is never a click target and the list turns its ripple off — only the
          <code>&lt;dbx-anchor&gt;</code>
          -wrapped button inside the
          <code>.item-trailing-divided</code>
          slot reacts. The date column is an
          <code>.item-leading-block</code>
          that bleeds to the row's edges, painted by
          <code>[dbxColor]</code>
          +
          <code>[dbxColorTone]</code>
          +
          <code>.dbx-color-bg</code>
          .
        </p>
        <p>
          When a day doesn't follow the previous one, a "…"
          <code>.dbx-list-detail-item-gap</code>
          marker sits between them. The view config sets a
          <code>separatorConfig</code>
          : a separator component plus a
          <code>showSeparator(previous, next)</code>
          function that returns true when the next day isn't the following calendar day. The list calls it for each pair of neighbouring rows (and once before the first and after the last row, with the missing side undefined), and injects the component through
          <code>dbx-injection</code>
          wherever it returns true. The component reads both rows from
          <code>DBX_VALUE_LIST_VIEW_ITEM_SEPARATOR</code>
          to label the gap. Separators sit outside the list rows, so the marker picks up no row hover, ripple or card styling, and its icon column shares the date block's width so it lines up underneath.
        </p>
        <p>
          <strong>To Do</strong>
          keeps the default hover and ripple, and the whole row is the click target (the view keeps
          <code>anchor</code>
          ). The view's
          <code>metaConfig: DbxListViewMetaIconComponent.metaConfig('chevron_right')</code>
          adds the built-in chevron, so the rows need no
          <code>.item-trailing</code>
          slot. The urgent row adds
          <code>.dbx-list-detail-item-highlight</code>
          , which paints the hosting list row through
          <code>:has()</code>
          so the wash also covers the chevron (tune it with
          <code>--dbx-list-detail-item-highlight-color</code>
          /
          <code>--dbx-list-detail-item-highlight-tone</code>
          ). With no items the list shows its projected
          <code>&lt;dbx-list-empty-content empty&gt;</code>
          .
        </p>
        <p>
          Both lists size to their rows and cap their height with
          <code>--dbx-list-content-max-height</code>
          set on the wrapper host, so
          <code>.dbx-list-content</code>
          — the list's own scroll container — scrolls past the limit instead of the card growing (and a paged list's load-more keeps working).
        </p>
        <p>
          Last clicked:
          <code>{{ clickedKey() ?? '(none)' }}</code>
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-button-wrap-group dbx-mb3">
          @for (option of todoPresentationOptions; track option.presentation) {
            <button mat-stroked-button (click)="todoPresentationSignal.set(option.presentation)" [disabled]="todoPresentationSignal() === option.presentation">{{ option.label }}</button>
          }
        </div>
        <div gdColumns="7fr 5fr" gdColumns.lt-md="1fr" gdGap="var(--dbx-padding-3)">
          <mat-card appearance="outlined">
            <mat-card-content>
              <h3 class="dbx-text-headline-small dbx-m0">Your Schedule</h3>
              <p class="dbx-hint dbx-mb3">{{ bookedCount }} upcoming weekdays booked</p>
              <doc-schedule-day-item-list class="doc-list-detail-item-list" [state]="scheduleState"></doc-schedule-day-item-list>
            </mat-card-content>
          </mat-card>
          <mat-card appearance="outlined">
            <mat-card-content>
              <h3 class="dbx-text-headline-small dbx-m0">To Do</h3>
              @if (todoCountLabelSignal(); as todoCountLabel) {
                <p class="dbx-hint dbx-mb3">{{ todoCountLabel }}</p>
              }
              <doc-todo-item-list class="doc-list-detail-item-list" [state]="todoStateSignal()">
                <dbx-list-empty-content empty>
                  <div class="dbx-flex-column dbx-flex-center dbx-text-center dbx-pv4">
                    <dbx-icon-tile class="dbx-mb3" icon="task_alt" [round]="true" dbxColor="primary" [dbxColorTone]="18"></dbx-icon-tile>
                    <div class="dbx-text-title-medium">You're all caught up</div>
                    <div class="dbx-hint">No action items right now. We'll let you know if something needs your attention.</div>
                  </div>
                </dbx-list-empty-content>
              </doc-todo-item-list>
            </mat-card-content>
          </mat-card>
        </div>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocListDetailItemExampleComponent {
  readonly clickedKey = signal<string | undefined>(undefined);

  readonly todoPresentationOptions = TODO_PRESENTATION_OPTIONS;
  readonly todoPresentationSignal = signal<TodoItemPresentation>('urgent');

  private readonly _scheduleValues = makeScheduleDayItemValues((key) => this.clickedKey.set(`schedule:${key}`));
  readonly scheduleState: ListLoadingState<ScheduleDayItemValue> = successResult(this._scheduleValues);
  readonly bookedCount = this._scheduleValues.filter((x) => x.state === 'booked').length;

  private readonly _todoValuesSignal = computed(() => makeTodoItemValues(this.todoPresentationSignal(), (key) => this.clickedKey.set(`todo:${key}`)));
  readonly todoStateSignal = computed<ListLoadingState<TodoItemValue>>(() => successResult(this._todoValuesSignal()));
  readonly todoCountLabelSignal = computed(() => {
    const count = this._todoValuesSignal().length;
    return count > 0 ? `${count} to dos` : undefined;
  });
}
