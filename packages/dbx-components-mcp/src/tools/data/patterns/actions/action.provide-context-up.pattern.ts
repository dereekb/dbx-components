import type { ActionExamplePattern } from '../action-patterns.js';

export const ACTION_PATTERN_PROVIDE_CONTEXT_UP: ActionExamplePattern = {
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
};
