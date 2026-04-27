import type { ActionExamplePattern } from '../action-patterns.js';

export const ACTION_PATTERN_DISABLED_BY_KEY: ActionExamplePattern = {
  slug: 'disabled-by-key',
  name: 'Toolbar with mutually disabled actions',
  summary: 'Two side-by-side buttons that share a parent action context and disable each other while one is working using independent disable keys.',
  usesActionSlugs: ['action', 'value', 'handler', 'disabled', 'context-map'],
  snippets: {
    minimal: `<div class="dbx-flex-bar">
  <ng-container dbxAction dbxActionValue [dbxActionHandler]="handlePublish">
    <dbx-button text="Publish" dbxActionButton></dbx-button>
  </ng-container>
  <ng-container dbxAction dbxActionValue [dbxActionHandler]="handleArchive">
    <dbx-button text="Archive" dbxActionButton></dbx-button>
  </ng-container>
</div>`,
    brief: `<div dbxActionContextMap class="dbx-flex-bar">
  <ng-container dbxAction [dbxActionMapSource]="'publish'"
                dbxActionValue [dbxActionHandler]="handlePublish"
                [dbxActionDisabled]="archiveBusy()">
    <dbx-button text="Publish" dbxActionButton></dbx-button>
  </ng-container>
  <ng-container dbxAction [dbxActionMapSource]="'archive'"
                dbxActionValue [dbxActionHandler]="handleArchive"
                [dbxActionDisabled]="publishBusy()">
    <dbx-button text="Archive" dbxActionButton></dbx-button>
  </ng-container>
</div>`,
    full: `import { Component, inject, signal } from '@angular/core';
import { type Work } from '@dereekb/rxjs';

@Component({
  selector: 'app-content-toolbar',
  template: \`
    <div dbxActionContextMap class="dbx-flex-bar">
      <ng-container
        dbxAction
        [dbxActionMapSource]="'publish'"
        dbxActionValue
        [dbxActionHandler]="handlePublish"
        [dbxActionDisabled]="archiveBusy()">
        <dbx-button [raised]="true" text="Publish" dbxActionButton></dbx-button>
      </ng-container>
      <ng-container
        dbxAction
        [dbxActionMapSource]="'archive'"
        dbxActionValue
        [dbxActionHandler]="handleArchive"
        [dbxActionDisabled]="publishBusy()">
        <dbx-button text="Archive" dbxActionButton></dbx-button>
      </ng-container>
    </div>
  \`,
  standalone: true
})
export class ContentToolbarComponent {
  private readonly store = inject(ArticleDocumentStore);
  readonly publishBusy = signal(false);
  readonly archiveBusy = signal(false);

  readonly handlePublish: Work<void, void> = (_v, ctx) => {
    this.publishBusy.set(true);
    ctx.startWorkingWithLoadingStateObservable(this.store.publish());
    ctx.successPair$.subscribe(() => this.publishBusy.set(false));
  };

  readonly handleArchive: Work<void, void> = (_v, ctx) => {
    this.archiveBusy.set(true);
    ctx.startWorkingWithLoadingStateObservable(this.store.archive());
    ctx.successPair$.subscribe(() => this.archiveBusy.set(false));
  };
}`
  },
  notes: 'Each `[dbxActionDisabled]` adds the `dbx_action_disabled` key on its action store. Multiple sources can disable the same action under different keys — only when ALL keys are released does the action re-enable. Use `[dbxActionContextMap]` + `[dbxActionMapSource]` when sibling actions need to look each other up by name.'
};
