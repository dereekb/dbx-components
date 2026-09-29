import { Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { type ListLoadingState, successResult } from '@dereekb/rxjs';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';
import { DbxColorDirective, DbxIconTileComponent, DbxListEmptyContentComponent, DbxListTitleGroupDirective } from '@dereekb/dbx-web';
import { DocTodoGroupItemListComponent } from '../component/todo.group.item.list.component';
import { makeTodoGroupItemValues, TODO_GROUP_ITEM_LIST_GROUP_DELEGATE, type TodoGroupItemValue } from '../component/todo.group.item.list';

const DEFAULT_TODO_GROUP_COURSES_IN_PROGRESS = 3;

/**
 * Grouped "To Do" panel built on the `.dbx-list-detail-item` To Do recipe.
 *
 * `[dbxListTitleGroup]` splits the rows into an "Action needed" section and a "Suggestions" section, with the delegate's
 * `sortGroupsByData` keeping "Action needed" first. The rows carry no background: an "Action needed" row is set apart by
 * its colored icon tile alone (the expired waiver is `warn`, the rest notice), and a "Suggestions" row has a grey tile.
 * The wrapper host adds `dbx-list-no-hover-effects`, so the rows have no hover state layer, and the built-in chevron is
 * the only trailing affordance.
 *
 * The view keys each row by its content (id + title + detail + chip) rather than its id. An item component keeps the
 * item it was created with while its key stays the same, so an id-only key would leave a stale detail line on screen
 * when a count changes; the "Finish a course" button shows the row updating.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug list-detail-item-grouped-todo
 * @dbxDocsUiExampleCategory list
 * @dbxDocsUiExampleSummary Grouped To Do list: .dbx-list-detail-item rows split into titled sections by dbxListTitleGroup, urgent rows set apart by a colored icon tile instead of a background, no hover effects, the built-in chevron, content-derived row keys so changed text re-renders, and an empty state.
 * @dbxDocsUiExampleRelated dbx-list, dbx-list-detail-item, dbx-list-no-hover-effects, dbx-list-title-group-header, dbx-list-empty-content, dbx-chip, dbx-icon-tile, dbx-color
 * @dbxDocsUiExampleUses {@link DocTodoGroupItemListComponent} list
 * @dbxDocsUiExampleUses {@link DocTodoGroupItemListViewComponent} view
 * @dbxDocsUiExampleUses {@link DocTodoGroupItemListViewItemComponent} item
 * @dbxDocsUiExampleUses {@link TodoGroupItemValue} data
 */
@Component({
  selector: 'doc-list-detail-item-grouped-todo-example',
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, MatButtonModule, MatCardModule, DbxColorDirective, DbxIconTileComponent, DbxListEmptyContentComponent, DbxListTitleGroupDirective, DocTodoGroupItemListComponent],
  template: `
    <dbx-docs-ui-example header=".dbx-list-detail-item Grouped To Do List" hint="The To Do recipe split into titled sections, with urgent rows marked by their icon tile color and no hover effects.">
      <dbx-docs-ui-example-info>
        <p>
          The same row recipe as the To Do list above, grouped by
          <code>[dbxListTitleGroup]</code>
          . The delegate maps each item to its section with
          <code>groupValueForItem</code>
          , gives each section its title with
          <code>dataForGroupValue</code>
          , and orders the sections with
          <code>sortGroupsByData</code>
          . The default
          <code>dbx-list-title-group-header</code>
          renders each title.
        </p>
        <p>
          The rows carry no background. An "Action needed" row is set apart by its tonal
          <code>dbx-icon-tile</code>
          alone: the expired waiver's tile is
          <code>warn</code>
          and the rest are
          <code>notice</code>
          , while the "Suggestions" rows keep a grey tile.
        </p>
        <p>
          The wrapper host adds
          <code>dbx-list-no-hover-effects</code>
          , so hovering a row doesn't add a state layer. The whole row stays the click target, and the view's
          <code>metaConfig</code>
          chevron is the only trailing affordance.
        </p>
        <p>
          The view keys each row by its content (id, title, detail and chip) instead of its id. An item component keeps the item it was created with while its key stays the same, so an id-only key would leave the old text on screen when a count changes. Use
          <strong>Finish a course</strong>
          to watch the "Courses in progress" row update, then disappear.
        </p>
        <p>
          Last clicked:
          <code>{{ clickedIdSignal() ?? '(none)' }}</code>
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div class="dbx-button-wrap-group dbx-mb3">
          <button mat-stroked-button (click)="finishCourse()" [disabled]="coursesInProgressSignal() === 0">Finish a course</button>
          <button mat-stroked-button (click)="reset()">Reset</button>
          <button mat-stroked-button (click)="showEmptySignal.set(!showEmptySignal())">{{ showEmptySignal() ? 'Show to dos' : 'All caught up' }}</button>
        </div>
        <mat-card appearance="outlined" style="max-width: 560px">
          <mat-card-content>
            <h3 class="dbx-text-headline-small dbx-m0">To Do</h3>
            @if (countLabelSignal(); as countLabel) {
              <p class="dbx-hint dbx-mb3">{{ countLabel }}</p>
            }
            <doc-todo-group-item-list [dbxListTitleGroup]="groupDelegate" [state]="stateSignal()">
              <dbx-list-empty-content empty>
                <div class="dbx-flex-column dbx-flex-center dbx-text-center dbx-pv4">
                  <dbx-icon-tile class="dbx-mb3" icon="task_alt" [round]="true" dbxColor="primary" [dbxColorTone]="18"></dbx-icon-tile>
                  <div class="dbx-text-title-medium">You're all caught up</div>
                  <div class="dbx-hint">No action items right now. We'll let you know if something needs your attention.</div>
                </div>
              </dbx-list-empty-content>
            </doc-todo-group-item-list>
          </mat-card-content>
        </mat-card>
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocListDetailItemGroupedTodoExampleComponent {
  readonly groupDelegate = TODO_GROUP_ITEM_LIST_GROUP_DELEGATE;

  readonly clickedIdSignal = signal<string | undefined>(undefined);
  readonly coursesInProgressSignal = signal(DEFAULT_TODO_GROUP_COURSES_IN_PROGRESS);
  readonly showEmptySignal = signal(false);

  private readonly _valuesSignal = computed(() => {
    const showEmpty = this.showEmptySignal();
    const coursesInProgress = this.coursesInProgressSignal();
    return showEmpty ? [] : makeTodoGroupItemValues({ coursesInProgress, onClick: (id) => this.clickedIdSignal.set(id) });
  });
  readonly stateSignal = computed<ListLoadingState<TodoGroupItemValue>>(() => successResult(this._valuesSignal()));
  readonly countLabelSignal = computed(() => {
    const count = this._valuesSignal().length;
    return count > 0 ? `${count} left` : undefined;
  });

  finishCourse(): void {
    this.coursesInProgressSignal.update((x) => Math.max(0, x - 1));
  }

  reset(): void {
    this.coursesInProgressSignal.set(DEFAULT_TODO_GROUP_COURSES_IN_PROGRESS);
    this.showEmptySignal.set(false);
  }
}
