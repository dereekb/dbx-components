import type { ActionExamplePattern } from '../action-patterns.js';

export const ACTION_PATTERN_FORM_WITH_SECONDARY: ActionExamplePattern = {
  slug: 'form-with-secondary',
  name: 'Form submit with secondary action button',
  summary: 'Outer `dbxAction` + `dbxActionForm` drives a primary (Approve) button; a nested `<ng-container dbxAction>` with `dbxActionValue` provides an independent secondary (Deny / Cancel) button that fires a void handler.',
  usesActionSlugs: ['action', 'handler', 'value', 'button', 'error-handler'],
  snippets: {
    minimal: `<div dbxAction [dbxActionHandler]="handleApprove">
  <my-form dbxActionForm></my-form>
  <dbx-button text="Approve" dbxActionButton></dbx-button>
  <ng-container dbxAction dbxActionValue [dbxActionHandler]="handleDeny">
    <dbx-button text="Deny" dbxActionButton></dbx-button>
  </ng-container>
</div>`,
    brief: `<div dbxAction dbxActionSnackbarError [dbxActionHandler]="handleApprove">
  <my-form dbxActionForm [dbxFormSource]="data$"></my-form>
  <dbx-button [raised]="true" text="Approve" color="primary" dbxActionButton></dbx-button>
  <dbx-button-spacer></dbx-button-spacer>
  <ng-container dbxAction dbxActionSnackbarError dbxActionValue [dbxActionHandler]="handleDeny">
    <dbx-button [flat]="true" text="Deny" color="warn" dbxActionButton></dbx-button>
  </ng-container>
</div>`,
    full: `import { Component, signal } from '@angular/core';
import { type WorkUsingContext } from '@dereekb/rxjs';

type ConsentDecision = { readonly outcome: 'approved'; readonly value: ConsentFormValue } | { readonly outcome: 'denied' };

@Component({
  selector: 'app-consent-page',
  template: \`
    <!-- Outer context: form-driven Approve -->
    <div dbxAction dbxActionSnackbarError [dbxActionHandler]="handleApprove">
      <my-consent-form dbxActionForm [dbxFormSource]="defaults$"></my-consent-form>

      <div class="dbx-pt3">
        <dbx-button [raised]="true" text="Approve" color="primary" dbxActionButton></dbx-button>
        <dbx-button-spacer></dbx-button-spacer>

        <!-- Nested context: void Deny. dbxActionValue with no input -->
        <!-- supplies the empty payload that lets the button fire. -->
        <ng-container dbxAction dbxActionSnackbarError dbxActionValue [dbxActionHandler]="handleDeny">
          <dbx-button [flat]="true" text="Deny" color="warn" dbxActionButton></dbx-button>
        </ng-container>
      </div>
    </div>

    @let decision = lastDecisionSignal();
    @if (decision) {
      <div class="dbx-pt3">
        @if (decision.outcome === 'approved') {
          <span>Approved with: <strong>{{ decision.value | json }}</strong></span>
        } @else {
          <span>Denied.</span>
        }
      </div>
    }
  \`,
  standalone: true
})
export class ConsentPageComponent {
  readonly defaults$ = this.store.defaults$;
  readonly lastDecisionSignal = signal<ConsentDecision | undefined>(undefined);

  readonly handleApprove: WorkUsingContext<ConsentFormValue, ConsentResult> = (value, context) => {
    this.lastDecisionSignal.set({ outcome: 'approved', value });
    context.startWorkingWithLoadingStateObservable(this.store.approve(value));
  };

  readonly handleDeny: WorkUsingContext<void, ConsentResult> = (_, context) => {
    this.lastDecisionSignal.set({ outcome: 'denied' });
    context.startWorkingWithLoadingStateObservable(this.store.deny());
  };
}`
  },
  notes:
    'Two non-obvious mechanics: (1) Each `dbxAction` creates its own `ActionContextStore`. `dbxActionButton` and other child directives inject the **nearest ancestor** store via Angular DI, so the inner button picks up the inner context — not the outer. (2) `dbxActionValue` with no input emits the empty-string sentinel, which `filterMaybe()` lets through, so `readyValue("")` fires immediately when the secondary button triggers; that satisfies `dbxActionButton` without needing a form on the secondary path. Each context can carry its own `dbxActionSnackbarError` so success/error feedback stays scoped per button. This is the canonical OIDC consent shape used in `@dereekb/dbx-firebase` (`oauth.consent.view.component.ts`).'
};
