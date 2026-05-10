import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { delay, of, tap } from 'rxjs';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxActionButtonDirective } from '@dereekb/dbx-core';
import { DbxButtonComponent, DbxButtonSpacerDirective, DbxActionSnackbarErrorDirective } from '@dereekb/dbx-web';
import { DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent } from '@dereekb/dbx-web/docs';
import { DbxActionFormDirective } from '@dereekb/dbx-form';
import { DocActionFormWithSecondaryFormComponent, type DocActionFormWithSecondaryFormValue } from './action.form-with-secondary.form.component';

type DocActionFormWithSecondaryDecision = { readonly outcome: 'approved'; readonly value: DocActionFormWithSecondaryFormValue } | { readonly outcome: 'denied' };

/**
 * Form-driven action with a secondary "deny / cancel" action button.
 *
 * The outer `[dbxAction]` hosts the primary work via `dbxActionForm` — the
 * form's value drives the Approve button. The Deny button lives inside a
 * nested `<ng-container dbxAction>` so it picks up its own action context via
 * Angular DI's nearest-ancestor lookup; `dbxActionValue` (no input) supplies
 * the empty payload that lets `dbxActionButton` fire the void handler.
 *
 * Each context has its own `dbxActionSnackbarError` so success / error
 * feedback for Approve and Deny are independent.
 *
 * Mirrors the OIDC consent pattern in
 * `packages/dbx-firebase/oidc/src/lib/interaction/components/oauth.consent.view.component.ts`.
 *
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug action-form-with-secondary
 * @dbxDocsUiExampleCategory action
 * @dbxDocsUiExampleSummary Form-driven primary action (dbxActionForm + Approve) plus a nested ng-container dbxAction with dbxActionValue for a void Deny / Cancel button.
 * @dbxDocsUiExampleRelated dbxActionForm, dbxActionValue, ng-container dbxAction, dbxActionButton, dbxActionSnackbarError
 * @dbxDocsUiExampleUses {@link DocActionFormWithSecondaryFormComponent} form
 * @dbxDocsUiExampleUses {@link DocActionFormWithSecondaryFormValue} formValue
 */
@Component({
  selector: 'doc-action-form-with-secondary-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DbxDocsUiExampleComponent, DbxDocsUiExampleInfoComponent, DbxDocsUiExampleContentComponent, DbxActionDirective, DbxActionHandlerDirective, DbxActionValueDirective, DbxActionButtonDirective, DbxActionSnackbarErrorDirective, DbxActionFormDirective, DbxButtonComponent, DbxButtonSpacerDirective, DocActionFormWithSecondaryFormComponent],
  template: `
    <dbx-docs-ui-example header="Form Action With Secondary Button" hint="dbxActionForm + Approve, plus a nested dbxAction context for Deny.">
      <dbx-docs-ui-example-info>
        <p>
          The
          <strong>outer</strong>
          <code>[dbxAction]</code>
          hosts the primary work. A child component carries the
          <code>dbxActionForm</code>
          directive so the form's value (and validity / modified state) drives the
          <code>Approve</code>
          button.
        </p>
        <p>
          The
          <strong>secondary</strong>
          button (
          <code>Deny</code>
          ) lives inside a nested
          <code>&lt;ng-container dbxAction&gt;</code>
          . Angular DI looks up the nearest ancestor
          <code>dbxAction</code>
          for each
          <code>dbxActionButton</code>
          , so the inner button picks up the inner context, not the outer.
          <code>dbxActionValue</code>
          with no input supplies the empty payload that lets the button fire a void handler immediately.
        </p>
        <p>
          Each context has its own
          <code>dbxActionSnackbarError</code>
          , so Approve / Deny feedback is independent.
        </p>
      </dbx-docs-ui-example-info>
      <dbx-docs-ui-example-content>
        <div dbxAction dbxActionSnackbarError [dbxActionHandler]="approveHandler">
          <doc-action-form-with-secondary-form dbxActionForm></doc-action-form-with-secondary-form>
          <div class="dbx-pt3">
            <dbx-button dbxActionButton text="Approve" [raised]="true" color="primary"></dbx-button>
            <dbx-button-spacer></dbx-button-spacer>
            <ng-container dbxAction dbxActionSnackbarError dbxActionValue [dbxActionHandler]="denyHandler">
              <dbx-button dbxActionButton text="Deny" [flat]="true" color="warn"></dbx-button>
            </ng-container>
          </div>
        </div>
        @let decision = lastDecisionSignal();
        @if (decision) {
          <div class="dbx-pt3">
            @if (decision.outcome === 'approved') {
              <span>
                Approved with reason:
                <strong>{{ decision.value.reason }}</strong>
              </span>
            } @else {
              <span>Denied.</span>
            }
          </div>
        }
      </dbx-docs-ui-example-content>
    </dbx-docs-ui-example>
  `
})
export class DocActionFormWithSecondaryExampleComponent {
  readonly lastDecisionSignal = signal<DocActionFormWithSecondaryDecision | undefined>(undefined);

  readonly approveHandler: WorkUsingObservable<DocActionFormWithSecondaryFormValue> = (value) =>
    of(true).pipe(
      delay(600),
      tap(() => this.lastDecisionSignal.set({ outcome: 'approved', value }))
    );
  readonly denyHandler: WorkUsingObservable<unknown> = () =>
    of(true).pipe(
      delay(300),
      tap(() => this.lastDecisionSignal.set({ outcome: 'denied' }))
    );
}
