import type { ActionExamplePattern } from '../action-patterns.js';

export const ACTION_PATTERN_AUTO_TRIGGER_ON_MODIFY: ActionExamplePattern = {
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
};
