import type { UiExamplePattern } from '../ui-patterns.js';

export const UI_PATTERN_LIST_PAGE: UiExamplePattern = {
  slug: 'list-page',
  name: 'List page (master view)',
  summary: 'A full-page list backed by a LoadingState observable, with a top toolbar and empty-state slot.',
  usesUiSlugs: ['section-page', 'list', 'list-empty-content', 'pagebar', 'button'],
  snippets: {
    minimal: `<dbx-section-page header="Items">
  <dbx-list [state$]="items$" [config]="listConfig">
    <dbx-list-empty-content><p>No items yet.</p></dbx-list-empty-content>
  </dbx-list>
</dbx-section-page>`,
    brief: `<dbx-section-page header="Items" icon="list" scroll="body">
  <dbx-pagebar>
    <span class="spacer"></span>
    <dbx-button text="Add" icon="add" raised color="primary" [dbxAction]="createAction"></dbx-button>
  </dbx-pagebar>

  <dbx-list [state$]="items$" [config]="listConfig" [loadMore]="loadMore">
    <dbx-list-empty-content>
      <p>No items yet — click "Add" to get started.</p>
    </dbx-list-empty-content>
  </dbx-list>
</dbx-section-page>`,
    full: `import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ListLoadingState } from '@dereekb/rxjs';
import { DbxSectionPageComponent, DbxListComponent, DbxListEmptyContentComponent, DbxPagebarComponent, DbxButtonComponent } from '@dereekb/dbx-web';
import { DbxActionDirective } from '@dereekb/dbx-core';

interface Item {
  readonly id: string;
  readonly name: string;
}

@Component({
  selector: 'app-items-page',
  standalone: true,
  imports: [DbxSectionPageComponent, DbxListComponent, DbxListEmptyContentComponent, DbxPagebarComponent, DbxButtonComponent, DbxActionDirective],
  template: \`
    <dbx-section-page header="Items" icon="list" scroll="body">
      <dbx-pagebar>
        <span class="spacer"></span>
        <dbx-button text="Add" icon="add" raised color="primary" [dbxAction]="createAction"></dbx-button>
      </dbx-pagebar>

      <dbx-list [state$]="items$" [config]="listConfig" [loadMore]="loadMore">
        <dbx-list-empty-content>
          <p>No items yet — click "Add" to get started.</p>
        </dbx-list-empty-content>
      </dbx-list>
    </dbx-section-page>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemsPageComponent {
  readonly items$: Observable<ListLoadingState<Item>> = /* ... */ null!;
  readonly listConfig = /* DbxValueListViewConfig<Item, ...> */ null!;
  readonly createAction = /* ... */ null;

  loadMore = (): void => { /* fetch next page */ };
}`
  },
  notes: 'Use `dbx-two-column` to add a detail pane on the right; bind selection to drive the right column.'
};
