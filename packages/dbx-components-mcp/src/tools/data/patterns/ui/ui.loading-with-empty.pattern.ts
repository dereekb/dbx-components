import type { UiExamplePattern } from '../ui-patterns.js';

export const UI_PATTERN_LOADING_WITH_EMPTY: UiExamplePattern = {
  slug: 'loading-with-empty',
  name: 'Loading + empty state wrap',
  summary: 'A `dbx-loading` wrapping a list with a custom empty state — the standard "react to a LoadingState" pattern.',
  usesUiSlugs: ['loading', 'list', 'list-empty-content', 'intro-action-section'],
  snippets: {
    minimal: `<dbx-loading [state]="state$ | async">
  <dbx-list [state$]="state$" [config]="listConfig">
    <dbx-list-empty-content><p>No items.</p></dbx-list-empty-content>
  </dbx-list>
</dbx-loading>`,
    brief: `<dbx-loading [state]="state$ | async" text="Loading items...">
  <dbx-intro-action-section
    hint="No items yet — add one to get started."
    action="Add Item"
    [showIntro]="(itemCount$ | async) === 0"
    (showAction)="createItem()">
    <dbx-list [state$]="state$" [config]="listConfig"></dbx-list>
  </dbx-intro-action-section>
</dbx-loading>`,
    full: `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ListLoadingState } from '@dereekb/rxjs';
import { CommonModule } from '@angular/common';
import { DbxLoadingComponent, DbxListComponent, DbxListEmptyContentComponent, DbxIntroActionSectionComponent } from '@dereekb/dbx-web';

interface Item {
  readonly id: string;
}

@Component({
  selector: 'app-items-loaded',
  standalone: true,
  imports: [CommonModule, DbxLoadingComponent, DbxListComponent, DbxListEmptyContentComponent, DbxIntroActionSectionComponent],
  template: \`
    <dbx-loading [state]="state$ | async" text="Loading items...">
      <dbx-intro-action-section
        hint="No items yet — add one to get started."
        action="Add Item"
        [showIntro]="(itemCount$ | async) === 0"
        (showAction)="createItem()">
        <dbx-list [state$]="state$" [config]="listConfig">
          <dbx-list-empty-content>
            <p>No matching items.</p>
          </dbx-list-empty-content>
        </dbx-list>
      </dbx-intro-action-section>
    </dbx-loading>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemsLoadedComponent {
  readonly state$: Observable<ListLoadingState<Item>> = /* ... */ null!;
  readonly itemCount$: Observable<number> = this.state$.pipe(map((s) => s.value?.length ?? 0));
  readonly listConfig = /* ... */ null!;

  createItem(): void { /* ... */ }
}`
  },
  notes: '`dbx-loading` already renders a `dbx-error` for failed loading states — drop in `<dbx-error>` only when handling errors outside the loading wrapper.'
};
