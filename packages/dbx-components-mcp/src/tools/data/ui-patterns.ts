/**
 * Curated dbx-web UI compositions used by the `dbx_ui_examples` tool.
 *
 * Each entry shows how to compose multiple dbx-web building blocks into a
 * complete, copy-paste-ready snippet. The per-component registry already
 * covers single-component docs via `dbx_ui_lookup` — UI_PATTERNS is
 * deliberately about MULTI-component compositions that answer "how do I lay
 * out a ___ with dbx-web?"
 *
 * Snippet shape mirrors `tools/data/patterns.ts` (form examples) so the
 * examples tool can stay symmetric across domains.
 */

export type UiExampleDepth = 'minimal' | 'brief' | 'full';

export interface UiExamplePattern {
  /** Slug used as the pattern key and in `dbx_ui_examples pattern="..."` calls. */
  readonly slug: string;
  /** Short display name. */
  readonly name: string;
  /** One-sentence description of what the pattern builds. */
  readonly summary: string;
  /** UI registry slugs this pattern composes from. Useful for cross-linking. */
  readonly usesUiSlugs: readonly string[];
  /** Code snippets at increasing levels of detail. */
  readonly snippets: {
    readonly minimal: string;
    readonly brief: string;
    readonly full: string;
  };
  /** Optional supplementary notes appended to `full` depth. */
  readonly notes?: string;
}

export const UI_PATTERNS: readonly UiExamplePattern[] = [
  {
    slug: 'settings-section',
    name: 'Settings section',
    summary: 'A dbx-section with header, form body, and a save button bar at the bottom.',
    usesUiSlugs: ['section', 'bar', 'button', 'button-spacer'],
    snippets: {
      minimal: `<dbx-section header="Account">
  <p>Body</p>
  <dbx-bar>
    <dbx-button text="Save" raised color="primary" [dbxAction]="saveAction"></dbx-button>
  </dbx-bar>
</dbx-section>`,
      brief: `<dbx-section header="Account" icon="person" hint="Update your profile and security settings">
  <!-- Form body -->
  <ng-container [formGroup]="form">
    <mat-form-field>
      <input matInput placeholder="Name" formControlName="name" />
    </mat-form-field>
  </ng-container>

  <dbx-bar>
    <dbx-button text="Save changes" raised color="primary" [dbxAction]="saveAction"></dbx-button>
    <dbx-button-spacer></dbx-button-spacer>
    <dbx-button text="Cancel" stroked (btnClick)="cancel()"></dbx-button>
  </dbx-bar>
</dbx-section>`,
      full: `import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DbxSectionComponent, DbxBarDirective, DbxButtonComponent, DbxButtonSpacerDirective } from '@dereekb/dbx-web';
import { DbxActionDirective } from '@dereekb/dbx-core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [DbxSectionComponent, DbxBarDirective, DbxButtonComponent, DbxButtonSpacerDirective, DbxActionDirective, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: \`
    <dbx-section header="Account" icon="person" hint="Update your profile">
      <ng-container [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>
      </ng-container>

      <dbx-bar>
        <dbx-button text="Save changes" raised color="primary" [dbxAction]="saveAction"></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>
        <dbx-button text="Cancel" stroked (btnClick)="cancel()"></dbx-button>
      </dbx-bar>
    </dbx-section>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountSettingsComponent {
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.group({ name: [''] });
  readonly saveAction = /* ... */ null;

  cancel(): void { /* ... */ }
}`
    },
    notes: 'Wrap multiple sections in a `dbx-content-container` for consistent page padding. Use `dbx-subsection` to nest related groups under a single `dbx-section`.'
  },
  {
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
  },
  {
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
  },
  {
    slug: 'card-with-action',
    name: 'Card with destructive action',
    summary: 'A dbx-card-box with a confirm-protected delete button — the canonical pattern for "danger zone" UI.',
    usesUiSlugs: ['card-box', 'bar', 'button', 'action-confirm'],
    snippets: {
      minimal: `<dbx-card-box header="Danger zone">
  <p>Deleting this account is permanent.</p>
  <dbx-button text="Delete" color="warn" [dbxAction]="deleteAction" [dbxActionConfirm]="confirmConfig"></dbx-button>
</dbx-card-box>`,
      brief: `<dbx-card-box header="Danger zone" icon="warning">
  <p>Deleting your account is permanent and cannot be undone.</p>
  <dbx-bar>
    <span class="spacer"></span>
    <dbx-button
      text="Delete account"
      icon="delete"
      stroked
      color="warn"
      [dbxAction]="deleteAccountAction"
      [dbxActionConfirm]="{ header: 'Delete account?', prompt: 'This cannot be undone.', confirmText: 'Delete' }">
    </dbx-button>
  </dbx-bar>
</dbx-card-box>`,
      full: `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DbxCardBoxComponent, DbxBarDirective, DbxButtonComponent, DbxActionConfirmDirective } from '@dereekb/dbx-web';
import { DbxActionDirective } from '@dereekb/dbx-core';
import { DbxActionConfirmConfig } from '@dereekb/dbx-web';

@Component({
  selector: 'app-danger-zone',
  standalone: true,
  imports: [DbxCardBoxComponent, DbxBarDirective, DbxButtonComponent, DbxActionDirective, DbxActionConfirmDirective],
  template: \`
    <dbx-card-box header="Danger zone" icon="warning">
      <p>Deleting your account is permanent and cannot be undone.</p>
      <dbx-bar>
        <span class="spacer"></span>
        <dbx-button
          text="Delete account"
          icon="delete"
          stroked
          color="warn"
          [dbxAction]="deleteAccountAction"
          [dbxActionConfirm]="confirmConfig">
        </dbx-button>
      </dbx-bar>
    </dbx-card-box>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DangerZoneComponent {
  readonly deleteAccountAction = /* DbxActionContextStoreSourceInstance<...> */ null;
  readonly confirmConfig: DbxActionConfirmConfig = {
    header: 'Delete account?',
    prompt: 'This cannot be undone.',
    confirmText: 'Delete'
  };
}`
    },
    notes: 'Wire `[dbxActionSnackbar]` alongside `[dbxActionConfirm]` to surface success/error toasts after the confirm fires.'
  },
  {
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
  },
  {
    slug: 'sidenav-app-shell',
    name: 'Sidenav app shell',
    summary: 'Top-level app shell with a left sidenav and content area driven by UIRouter.',
    usesUiSlugs: ['sidenav-page', 'sidenav', 'content-page'],
    snippets: {
      minimal: `<dbx-sidenav-page>
  <dbx-sidenav [anchors]="navAnchors"></dbx-sidenav>
  <ui-view></ui-view>
</dbx-sidenav-page>`,
      brief: `<dbx-sidenav-page>
  <dbx-sidenav [anchors]="navAnchors"></dbx-sidenav>
  <div dbxContentPage>
    <ui-view></ui-view>
  </div>
</dbx-sidenav-page>`,
      full: `import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ClickableAnchor } from '@dereekb/dbx-core';
import { DbxSidenavPageComponent, DbxSidenavComponent, DbxContentPageDirective } from '@dereekb/dbx-web';
import { UIRouterModule } from '@uirouter/angular';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [DbxSidenavPageComponent, DbxSidenavComponent, DbxContentPageDirective, UIRouterModule],
  template: \`
    <dbx-sidenav-page>
      <dbx-sidenav [anchors]="navAnchors"></dbx-sidenav>
      <div dbxContentPage>
        <ui-view></ui-view>
      </div>
    </dbx-sidenav-page>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  readonly navAnchors: ClickableAnchor[] = [
    { ref: 'app.home', icon: 'home', title: 'Home' },
    { ref: 'app.members', icon: 'group', title: 'Members' },
    { ref: 'app.settings', icon: 'settings', title: 'Settings' }
  ];
}`
    },
    notes: 'Pair with `dbx-navbar` for top-level horizontal nav. See the `dbx__guide__app-states` skill for state tree scaffolding.'
  }
];

/**
 * Looks up a UI example pattern by its slug.
 */
export function getUiExamplePattern(slug: string): UiExamplePattern | undefined {
  const lowered = slug.trim().toLowerCase();
  const result = UI_PATTERNS.find((p) => p.slug === lowered);
  return result;
}
