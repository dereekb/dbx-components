/**
 * Curated dbx-core action wirings used by the `dbx_action_examples` tool.
 *
 * Each entry shows how to compose multiple action directives (root + value
 * provider + trigger + handler + optional feedback) into a complete, working
 * snippet. The per-directive registry already surfaces single-directive docs
 * via `dbx_action_lookup` — patterns deliberately answer "how do I assemble
 * the directive stack to do X?"
 */

export type ActionExampleDepth = 'minimal' | 'brief' | 'full';

export interface ActionExamplePattern {
  /** Slug used as the pattern key and in `dbx_action_examples pattern="..."` calls. */
  readonly slug: string;
  /** Short display name. */
  readonly name: string;
  /** One-sentence description of what the pattern wires. */
  readonly summary: string;
  /** Action registry slugs the pattern composes from. */
  readonly usesActionSlugs: readonly string[];
  /** Code snippets at increasing levels of detail. */
  readonly snippets: {
    readonly minimal: string;
    readonly brief: string;
    readonly full: string;
  };
  /** Optional supplementary notes appended at full depth. */
  readonly notes?: string;
}

export const ACTION_EXAMPLE_PATTERNS: readonly ActionExamplePattern[] = [
  {
    slug: 'button-confirm-delete',
    name: 'Button + confirm + delete',
    summary: 'Standalone button that fires an async delete after a popover confirmation, with snackbar feedback on success/error.',
    usesActionSlugs: ['action', 'value', 'handler', 'error-handler'],
    snippets: {
      minimal: `<ng-container dbxAction dbxActionValue [dbxActionHandler]="handleDelete">
  <dbx-button text="Delete" dbxActionButton></dbx-button>
</ng-container>`,
      brief: `<!-- The host component supplies handleDelete: Work<void, void>. -->
<ng-container dbxAction dbxActionValue dbxActionSnackbarError [dbxActionHandler]="handleDelete">
  <dbx-button [raised]="true" color="warn" text="Delete" dbxActionButton></dbx-button>
</ng-container>`,
      full: `import { Component, inject } from '@angular/core';
import { type Work } from '@dereekb/rxjs';

@Component({
  selector: 'app-delete-account-button',
  template: \`
    <ng-container
      dbxAction
      dbxActionValue
      dbxActionSnackbarError
      [dbxActionHandler]="handleDelete">
      <dbx-button
        [raised]="true"
        color="warn"
        text="Delete account"
        icon="delete"
        dbxActionButton></dbx-button>
    </ng-container>
  \`,
  standalone: true
})
export class DeleteAccountButtonComponent {
  private readonly accountStore = inject(AccountDocumentStore);

  readonly handleDelete: Work<void, void> = (_value, context) => {
    context.startWorkingWithLoadingStateObservable(this.accountStore.deleteAccount());
  };
}`
    },
    notes: 'No form means we still need a value provider — `dbxActionValue` (with no expression) is what unblocks the TRIGGERED → VALUE_READY transition. Forgetting it is the most common reason an action button "does nothing".'
  },
  {
    slug: 'form-submit',
    name: 'Form submit with snackbar',
    summary: 'A `<form>` with `dbxActionForm` providing the value, a save button as the trigger, snackbar + error feedback.',
    usesActionSlugs: ['action', 'handler', 'error-handler'],
    snippets: {
      minimal: `<form dbxAction [dbxActionHandler]="handleSave">
  <my-form dbxActionForm [dbxFormSource]="data$"></my-form>
  <dbx-button text="Save" dbxActionButton></dbx-button>
</form>`,
      brief: `<form dbxAction dbxActionSnackbar dbxActionSnackbarDefault="save" [dbxActionHandler]="handleSave">
  <my-form dbxActionForm [dbxFormSource]="data$"></my-form>
  <dbx-button [raised]="true" text="Save" dbxActionButton></dbx-button>
  <dbx-error dbxActionError></dbx-error>
</form>`,
      full: `import { Component, inject } from '@angular/core';
import { type WorkUsingContext } from '@dereekb/rxjs';

@Component({
  selector: 'app-edit-profile-page',
  template: \`
    <form
      dbxAction
      dbxActionSnackbar
      dbxActionSnackbarDefault="save"
      [dbxActionHandler]="handleSave">
      <my-profile-form dbxActionForm [dbxFormSource]="profile$"></my-profile-form>
      <dbx-button [raised]="true" text="Save" dbxActionButton></dbx-button>
      <dbx-error dbxActionError></dbx-error>
    </form>
  \`,
  standalone: true
})
export class EditProfilePageComponent {
  private readonly profileStore = inject(ProfileDocumentStore);
  readonly profile$ = this.profileStore.data$;

  readonly handleSave: WorkUsingContext<ProfileFormValue, ProfileResult> = (value, context) => {
    context.startWorkingWithLoadingStateObservable(this.profileStore.updateProfile(value));
  };
}`
    },
    notes: "`dbxActionForm` lives in `@dereekb/dbx-form` — it is the value provider in this composition. The form's `dbxFormSource` seeds the initial value and the form's modification status feeds `isModified` on the action store."
  },
  {
    slug: 'auto-trigger-on-modify',
    name: 'Auto-save on form modification',
    summary: 'Auto-trigger fires whenever the form is modified, with a fast preset and an explicit limit so a buggy form cannot loop indefinitely.',
    usesActionSlugs: ['action', 'auto-trigger', 'auto-modify', 'enforce-modified', 'handler'],
    snippets: {
      minimal: `<div dbxAction>
  <ng-container dbxActionAutoTrigger useFastTriggerPreset></ng-container>
  <my-form dbxActionForm [dbxFormSource]="data$"></my-form>
</div>`,
      brief: `<div dbxAction dbxActionEnforceModified [dbxActionHandler]="handleSave">
  <ng-container dbxActionAutoTrigger useFastTriggerPreset [triggerLimit]="50"></ng-container>
  <my-form dbxActionForm [dbxFormSource]="data$"></my-form>
</div>`,
      full: `import { Component, inject } from '@angular/core';
import { type Work } from '@dereekb/rxjs';

@Component({
  selector: 'app-settings-autosave',
  template: \`
    <div
      dbxAction
      dbxActionEnforceModified
      [dbxActionHandler]="handleSave"
      dbxActionSnackbarError>
      <ng-container
        dbxActionAutoTrigger
        useFastTriggerPreset
        [triggerLimit]="50"></ng-container>

      <my-settings-form
        dbxActionForm
        [dbxFormSource]="settings$"></my-settings-form>
    </div>
  \`,
  standalone: true
})
export class SettingsAutosaveComponent {
  private readonly store = inject(SettingsDocumentStore);
  readonly settings$ = this.store.data$;

  readonly handleSave: Work<SettingsValue, void> = (value) => this.store.updateSettings(value);
}`
    },
    notes: 'Pair `dbxActionAutoTrigger` with `dbxActionEnforceModified` so the auto-trigger only fires when something actually changed. Add `dbxActionAutoModify` if you want a kept-modified behavior (e.g. polling-style refresh) — be careful, it can cause loops without `triggerLimit`.'
  },
  {
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
  },
  {
    slug: 'value-getter-on-trigger',
    name: 'Lazy value getter on trigger',
    summary: 'Capture the form value lazily at the moment of trigger (rather than continuously) and short-circuit the action when nothing has changed.',
    usesActionSlugs: ['action', 'value-getter', 'handler', 'enforce-modified'],
    snippets: {
      minimal: `<div dbxAction
     [dbxActionValueGetter]="getCurrentValue"
     [dbxActionHandler]="handleSave">
  <button dbxActionButton>Save</button>
</div>`,
      brief: `<div dbxAction
     dbxActionEnforceModified
     [dbxActionValueGetter]="getCurrentValue"
     [dbxActionValueGetterIsEqual]="isUnchanged"
     [dbxActionHandler]="handleSave">
  <my-form #form></my-form>
  <dbx-button text="Save" dbxActionButton></dbx-button>
</div>`,
      full: `import { Component, inject, viewChild } from '@angular/core';
import { type Work } from '@dereekb/rxjs';
import { type IsEqualFunction } from '@dereekb/rxjs';

@Component({
  selector: 'app-tag-editor',
  template: \`
    <div
      dbxAction
      dbxActionEnforceModified
      [dbxActionValueGetter]="getCurrentValue"
      [dbxActionValueGetterIsEqual]="isSame"
      [dbxActionHandler]="handleSave">
      <my-tag-form #form></my-tag-form>
      <dbx-button text="Save" dbxActionButton></dbx-button>
    </div>
  \`,
  standalone: true
})
export class TagEditorComponent {
  private readonly store = inject(TagCollectionStore);
  readonly form = viewChild.required<MyTagFormComponent>('form');

  readonly getCurrentValue = (): TagFormValue => this.form().snapshot();
  readonly isSame: IsEqualFunction = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  readonly handleSave: Work<TagFormValue, void> = (value) => this.store.saveTags(value);
}`
    },
    notes: 'Prefer `[dbxActionValueGetter]` over `[dbxActionValue]` when computing the value is expensive (deep clones, reads from a store snapshot) or only meaningful at trigger time. The `IsEqualFunction` lets the directive skip `readyValue()` when the snapshot matches the previous one — useful in autosave loops.'
  },
  {
    slug: 'provide-context-up',
    name: 'Forwarded context across components',
    summary: 'Parent component creates an action context (or a programmatic source) that a deep child consumes via `[dbxActionSource]`.',
    usesActionSlugs: ['source', 'action', 'value', 'handler'],
    snippets: {
      minimal: `<div [dbxActionSource]="myActionSource">
  <child-component></child-component>
</div>`,
      brief: `<!-- Parent template -->
<div [dbxActionSource]="actionSource()">
  <child-button></child-button>
</div>

<!-- Child template (child-button.html) -->
<dbx-button text="Submit" dbxActionButton></dbx-button>`,
      full: `// Parent component creates a programmatic action source and exposes it.
import { Component, signal } from '@angular/core';
import { DbxActionContextMachine } from '@dereekb/dbx-core';

@Component({
  selector: 'app-parent',
  template: \`
    <div [dbxActionSource]="actionSource()">
      <child-component></child-component>
    </div>
  \`,
  standalone: true
})
export class ParentComponent {
  readonly machine = new DbxActionContextMachine<MyValue, MyResult>();
  readonly actionSource = signal(this.machine);

  ngOnInit(): void {
    this.machine.setHandlerFunction((value, ctx) => {
      ctx.startWorkingWithLoadingStateObservable(this.api.save(value));
    });
  }
}

// Child consumes the inherited context via dbxAction.
@Component({
  selector: 'child-component',
  template: \`
    <ng-container dbxAction dbxActionValue="hello">
      <dbx-button [raised]="true" text="Submit" dbxActionButton></dbx-button>
    </ng-container>
  \`,
  standalone: true
})
export class ChildComponent {}`
    },
    notes: 'Place `[dbxActionSource]` on an ancestor element and any descendant `dbxAction` will reuse that store instead of spinning up a new one. Useful for splitting "what triggers" from "what defines the work" across component boundaries.'
  }
];

/**
 * Looks up an action example pattern by its slug.
 */
export function getActionExamplePattern(slug: string): ActionExamplePattern | undefined {
  const lowered = slug.trim().toLowerCase();
  const result = ACTION_EXAMPLE_PATTERNS.find((p) => p.slug === lowered);
  return result;
}
