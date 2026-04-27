import type { ActionExamplePattern } from '../action-patterns.js';

export const ACTION_PATTERN_VALUE_GETTER_ON_TRIGGER: ActionExamplePattern = {
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
};
