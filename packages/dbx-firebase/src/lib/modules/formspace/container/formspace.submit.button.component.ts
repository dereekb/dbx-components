import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxActionModule, DbxButtonComponent, type DbxButtonStyle, DbxErrorComponent } from '@dereekb/dbx-web';
import { type FormSpaceSubmitBlocker, type FormSpaceTypeConfig, formSpaceFileSlotName } from '@dereekb/firebase';
import { type WorkUsingContext } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { FormSpaceDocumentStore } from '../store/formspace.document.store';

/**
 * What a submit button says while it cannot name what is missing — because no type registry was provided, so
 * the blockers were never resolved.
 */
export const DEFAULT_DBX_FIREBASE_FORM_SPACE_SUBMIT_INCOMPLETE_HINT = 'Finish every required step before submitting.';

/**
 * Joins names into a readable list: `A`, `A and B`, `A, B and C`.
 *
 * @param names - The names to join.
 * @returns The joined list.
 *
 * @__NO_SIDE_EFFECTS__
 */
function joinNames(names: string[]): string {
  let joined: string;

  if (names.length <= 1) {
    joined = names[0] ?? '';
  } else {
    joined = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }

  return joined;
}

/**
 * Input for {@link dbxFirebaseFormSpaceSubmitIncompleteHint}.
 */
export interface DbxFirebaseFormSpaceSubmitIncompleteHintInput {
  /**
   * The space's submit blockers, or undefined when they could not be resolved.
   */
  readonly blockers: Maybe<FormSpaceSubmitBlocker[]>;
  /**
   * The space's type config, which is what names a slot.
   */
  readonly config: Maybe<FormSpaceTypeConfig>;
}

/**
 * Returns the sentence a submit button shows while the space is incomplete, or undefined when it is not.
 *
 * NAMES the sections rather than saying "something is missing": the button sits at the bottom of a form the
 * user has scrolled past, and "finish every required step" leaves them to hunt for which. The names come
 * from the type config's own `name`, so they are the same words the sections above are labelled with.
 *
 * Falls back to {@link DEFAULT_DBX_FIREBASE_FORM_SPACE_SUBMIT_INCOMPLETE_HINT} when the blockers are unknown —
 * the button is disabled either way, and a disabled control with no explanation is worse than a vague one.
 *
 * @param input - The blockers and the type config that names their slots.
 * @returns The sentence, or undefined when nothing is blocking.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function dbxFirebaseFormSpaceSubmitIncompleteHint(input: DbxFirebaseFormSpaceSubmitIncompleteHintInput): Maybe<string> {
  const { blockers, config } = input;
  let hint: Maybe<string>;

  if (blockers == null || config == null) {
    hint = DEFAULT_DBX_FIREBASE_FORM_SPACE_SUBMIT_INCOMPLETE_HINT;
  } else if (blockers.length > 0) {
    const names = joinNames(blockers.map((x) => formSpaceFileSlotName(config, x.slot)));
    const pending = blockers.filter((x) => x.reason === 'pending_validation');

    // every blocker being a validation still in flight is the one case the user cannot act on: telling them
    // to go finish something would send them to a section they have already filled in correctly
    if (pending.length === blockers.length) {
      const noun = blockers.length === 1 ? 'file' : 'files';
      hint = `Still checking the ${noun} in ${names}.`;
    } else {
      hint = `Finish ${names} before submitting.`;
    }
  }

  return hint;
}

/**
 * Configuration for the {@link DbxFirebaseFormSpaceSubmitButtonComponent}.
 */
export interface DbxFirebaseFormSpaceSubmitButtonComponentConfig {
  /**
   * Text of the button. Defaults to "Submit".
   */
  readonly text?: Maybe<string>;
  readonly icon?: Maybe<string>;
  readonly buttonStyle?: Maybe<DbxButtonStyle>;
  /**
   * Whether the submission is processed immediately rather than waiting for the queue. Defaults to true.
   */
  readonly runImmediately?: Maybe<boolean>;
  /**
   * Whether the button is disabled until every required slot is filled and valid. Defaults to true.
   *
   * Setting it false does NOT widen what the server accepts — the submit transaction re-checks the same rule
   * and refuses — it only moves where the user finds that out. Worth it for a form whose blockers are hard
   * to explain in place, and wrong everywhere else.
   */
  readonly requireComplete?: Maybe<boolean>;
  /**
   * Line shown under the button while it is disabled for being incomplete.
   *
   * Defaults to true, which NAMES the sections that are holding it up. Pass a string to say something fixed
   * instead, or false to show nothing.
   */
  readonly incompleteHint?: Maybe<string | boolean>;
  /**
   * Disables the button on top of the space's own state.
   */
  readonly disabled?: Maybe<boolean>;
}

/**
 * Submits the surrounding FormSpace, enabled only once the space is complete.
 *
 * Reads the ambient {@link FormSpaceDocumentStore}, so it must sit inside whatever provides it.
 *
 * Enablement is `isSubmittable$` — still editable, and carrying no submit blockers — which is evaluated with
 * the same `formSpaceSubmitBlockers()` the server's submit transaction rejects on. The button is a COURTESY,
 * not a control: the server re-runs the whole check inside the lock, which is what actually stops an
 * incomplete submission and what makes a concurrent double-submit resolve to one winner.
 *
 * That courtesy needs the app's type registry, via `provideDbxFirebaseFormSpaceTypeConfigService()`. Without
 * it the space's completion is unknown, and the button stays disabled rather than offering a submit nothing
 * checked.
 *
 * @example
 * ```html
 * <dbx-firebase-formspace-submit-button text="Submit Form Space"></dbx-firebase-formspace-submit-button>
 * ```
 */
@Component({
  selector: 'dbx-firebase-formspace-submit-button',
  template: `
    <!-- the ACTION is what is disabled, not just the button: dbxActionButton pushes the action's own
         isDisabled$ onto the button, and DbxButton resolves that ahead of its [disabled] input, so a button
         disabled only by the input is re-enabled the moment the action reports itself idle -->
    <div dbxAction dbxActionValue [dbxActionDisabled]="disabledSignal()" [dbxActionHandler]="handleSubmitFormSpace">
      <dbx-button dbxActionButton [buttonStyle]="buttonStyleSignal()" [text]="textSignal()" [icon]="iconSignal()"></dbx-button>
      <dbx-error dbxActionError></dbx-error>
    </div>
    @if (incompleteHintSignal(); as incompleteHint) {
      <div class="dbx-firebase-formspace-submit-button-hint dbx-hint">{{ incompleteHint }}</div>
    }
  `,
  host: {
    // the same top gap the slot upload's drop area takes, so a submit step is not flush against the hint
    // above it wherever it is dropped
    class: 'dbx-firebase-formspace-submit-button d-block dbx-pt3'
  },
  imports: [DbxActionModule, DbxButtonComponent, DbxErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFirebaseFormSpaceSubmitButtonComponent {
  readonly formSpaceDocumentStore = inject(FormSpaceDocumentStore);

  readonly config = input<Maybe<DbxFirebaseFormSpaceSubmitButtonComponentConfig>>();

  readonly text = input<Maybe<string>>();
  readonly icon = input<Maybe<string>>();
  readonly buttonStyle = input<Maybe<DbxButtonStyle>>();
  readonly runImmediately = input<Maybe<boolean>>();
  readonly requireComplete = input<Maybe<boolean>>();
  readonly incompleteHint = input<Maybe<string | boolean>>();
  readonly disabled = input<Maybe<boolean>>();

  readonly isEditableSignal = toSignal(this.formSpaceDocumentStore.isEditable$, { initialValue: false });
  readonly isCompleteSignal = toSignal(this.formSpaceDocumentStore.isComplete$, { initialValue: false });
  readonly submitBlockersSignal = toSignal(this.formSpaceDocumentStore.submitBlockers$);
  readonly formSpaceTypeConfigSignal = toSignal(this.formSpaceDocumentStore.formSpaceTypeConfig$);

  readonly textSignal = computed(() => {
    const config = this.config();
    return this.text() ?? config?.text ?? 'Submit';
  });
  readonly iconSignal = computed(() => {
    const config = this.config();
    return this.icon() ?? config?.icon;
  });
  readonly buttonStyleSignal = computed<DbxButtonStyle>(() => {
    const config = this.config();
    return this.buttonStyle() ?? config?.buttonStyle ?? { type: 'raised', color: 'primary' };
  });
  readonly runImmediatelySignal = computed(() => {
    const config = this.config();
    return this.runImmediately() ?? config?.runImmediately ?? true;
  });
  readonly requireCompleteSignal = computed(() => {
    const config = this.config();
    return this.requireComplete() ?? config?.requireComplete ?? true;
  });
  readonly disabledSignal = computed(() => {
    const config = this.config();
    const isEditable = this.isEditableSignal();
    const isComplete = this.isCompleteSignal();
    const requireComplete = this.requireCompleteSignal();
    const disabled = (this.disabled() ?? config?.disabled) === true;
    return disabled || !isEditable || (requireComplete && !isComplete);
  });

  /**
   * The line under the button, shown only while INCOMPLETENESS is what is holding it up.
   *
   * A space that is already submitted, or one the caller disabled itself, is not waiting on the user to
   * finish anything — telling them to would be an instruction they cannot act on.
   */
  readonly incompleteHintSignal = computed<Maybe<string>>(() => {
    const config = this.config();
    const isEditable = this.isEditableSignal();
    const isComplete = this.isCompleteSignal();
    const requireComplete = this.requireCompleteSignal();
    const blockers = this.submitBlockersSignal();
    const formSpaceTypeConfig = this.formSpaceTypeConfigSignal();
    const incompleteHint = this.incompleteHint() ?? config?.incompleteHint ?? true;
    const isBlockedByIncompleteness = isEditable && requireComplete && !isComplete;

    let hint: Maybe<string>;

    if (isBlockedByIncompleteness && incompleteHint !== false) {
      hint = incompleteHint === true ? dbxFirebaseFormSpaceSubmitIncompleteHint({ blockers, config: formSpaceTypeConfig }) : incompleteHint;
    }

    return hint;
  });

  readonly handleSubmitFormSpace: WorkUsingContext = (_, context) => {
    context.startWorkingWithLoadingStateObservable(this.formSpaceDocumentStore.submitFormSpace({ runImmediately: this.runImmediatelySignal() }));
  };
}
