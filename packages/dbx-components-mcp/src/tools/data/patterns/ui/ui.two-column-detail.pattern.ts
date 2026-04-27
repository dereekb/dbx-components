import type { UiExamplePattern } from '../ui-patterns.js';

export const UI_PATTERN_TWO_COLUMN_DETAIL: UiExamplePattern = {
  slug: 'two-column-detail',
  name: 'Two-column master/detail',
  summary: 'A list on the left, detail on the right — the canonical master/detail layout, hides the left column at narrow viewports.',
  usesUiSlugs: ['two-column', 'two-column-right', 'list', 'section-page'],
  snippets: {
    minimal: `<dbx-two-column>
  <dbx-list left [state$]="items$" [config]="listConfig"></dbx-list>
  <dbx-two-column-right right header="Detail">
    <p>Selected item</p>
  </dbx-two-column-right>
</dbx-two-column>`,
    brief: `<dbx-section-page header="Members" scroll="body">
  <dbx-two-column [inSectionPage]="true">
    <dbx-list left [state$]="members$" [config]="listConfig"></dbx-list>
    <dbx-two-column-right right [header]="(selected$ | async)?.name">
      <button nav mat-icon-button><mat-icon>edit</mat-icon></button>
      <ui-view></ui-view>
    </dbx-two-column-right>
  </dbx-two-column>
</dbx-section-page>`,
    full: `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Observable } from 'rxjs';
import { ListLoadingState } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { DbxSectionPageComponent, DbxTwoColumnComponent, DbxTwoColumnRightComponent, DbxListComponent } from '@dereekb/dbx-web';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface Member {
  readonly id: string;
  readonly name: string;
}

@Component({
  selector: 'app-members-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, DbxSectionPageComponent, DbxTwoColumnComponent, DbxTwoColumnRightComponent, DbxListComponent],
  template: \`
    <dbx-section-page header="Members" icon="group" scroll="body">
      <dbx-two-column [inSectionPage]="true">
        <dbx-list left [state$]="members$" [config]="listConfig"></dbx-list>
        <dbx-two-column-right right [header]="(selected$ | async)?.name">
          <button nav mat-icon-button><mat-icon>edit</mat-icon></button>
          <ui-view></ui-view>
        </dbx-two-column-right>
      </dbx-two-column>
    </dbx-section-page>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPageComponent {
  readonly members$: Observable<ListLoadingState<Member>> = /* ... */ null!;
  readonly selected$: Observable<Maybe<Member>> = /* ... */ null!;
  readonly listConfig = /* DbxValueListViewConfig<Member, ...> */ null!;
}`
  },
  notes: 'The right column is driven by UIRouter — select a row to navigate to a child state, and the back button on `dbx-two-column-right` closes the detail.'
};
