import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type DbxColorInput, DbxStepBlockComponent } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';

/**
 * Icon shown in place of the step number once a step is complete.
 */
export const DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COMPLETE_ICON = 'check';

/**
 * Badge color of a complete step.
 */
export const DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COMPLETE_COLOR: DbxColorInput = 'success';

/**
 * Badge color of a step that is not complete yet.
 */
export const DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COLOR: DbxColorInput = 'primary';

/**
 * Configuration for the {@link DbxFirebaseFormSpaceStepBlockComponent}.
 */
export interface DbxFirebaseFormSpaceStepBlockComponentConfig {
  /**
   * The step's position in the form, shown in the badge until the step completes.
   */
  readonly step?: Maybe<number>;
  readonly header?: Maybe<string>;
  readonly hint?: Maybe<string>;
  /**
   * Whether the step's requirement is met. Defaults to false.
   */
  readonly complete?: Maybe<boolean>;
  /**
   * Icon shown in the badge once {@link complete}.
   * Defaults to {@link DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COMPLETE_ICON}.
   */
  readonly completeIcon?: Maybe<string>;
  /**
   * Badge color once {@link complete}.
   * Defaults to {@link DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COMPLETE_COLOR}.
   */
  readonly completeColor?: Maybe<DbxColorInput>;
  /**
   * Icon shown in the badge while the step is INCOMPLETE. Defaults to none, which shows {@link step}.
   */
  readonly icon?: Maybe<string>;
  /**
   * Badge color while the step is incomplete.
   * Defaults to {@link DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COLOR}.
   */
  readonly color?: Maybe<DbxColorInput>;
  readonly center?: Maybe<boolean>;
}

/**
 * A {@link DbxStepBlockComponent} whose badge flips from its step number to a checkmark once the step's
 * requirement is met.
 *
 * PRESENTATION ONLY — it knows nothing about FormSpaces and takes `complete` as a plain boolean, so the same
 * block labels a step whose completion no model can answer (a form the user has filled in, a term they
 * accepted) as readily as one a slot's file count decides. `dbx-firebase-formspace-section` is the wiring
 * that derives that boolean from the surrounding space.
 *
 * @example
 * ```html
 * <dbx-firebase-formspace-step-block [step]="1" [complete]="hasCoverFile()" header="Cover File" hint="One file.">
 *   <p>Whatever the step contains.</p>
 * </dbx-firebase-formspace-step-block>
 * ```
 */
@Component({
  selector: 'dbx-firebase-formspace-step-block',
  template: `
    <dbx-step-block [step]="stepSignal()" [icon]="badgeIconSignal()" [color]="badgeColorSignal()" [header]="headerSignal()" [hint]="hintSignal()" [center]="centerSignal()">
      <span header><ng-content select="[header]"></ng-content></span>
      <ng-content></ng-content>
    </dbx-step-block>
  `,
  host: {
    class: 'dbx-firebase-formspace-step-block d-block',
    '[class.dbx-firebase-formspace-step-block-complete]': 'completeSignal()'
  },
  imports: [DbxStepBlockComponent],
  standalone: true
})
export class DbxFirebaseFormSpaceStepBlockComponent {
  readonly config = input<Maybe<DbxFirebaseFormSpaceStepBlockComponentConfig>>();

  readonly step = input<Maybe<number>>();
  readonly header = input<Maybe<string>>();
  readonly hint = input<Maybe<string>>();
  readonly complete = input<Maybe<boolean>>();
  readonly completeIcon = input<Maybe<string>>();
  readonly completeColor = input<Maybe<DbxColorInput>>();
  readonly icon = input<Maybe<string>>();
  readonly color = input<Maybe<DbxColorInput>>();
  readonly center = input<Maybe<boolean>>();

  readonly stepSignal = computed(() => {
    const config = this.config();
    return this.step() ?? config?.step;
  });
  readonly headerSignal = computed(() => {
    const config = this.config();
    return this.header() ?? config?.header;
  });
  readonly hintSignal = computed(() => {
    const config = this.config();
    return this.hint() ?? config?.hint;
  });
  readonly completeSignal = computed(() => {
    const config = this.config();
    return (this.complete() ?? config?.complete) === true;
  });
  readonly completeIconSignal = computed(() => {
    const config = this.config();
    return this.completeIcon() ?? config?.completeIcon ?? DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COMPLETE_ICON;
  });
  readonly completeColorSignal = computed(() => {
    const config = this.config();
    return this.completeColor() ?? config?.completeColor ?? DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COMPLETE_COLOR;
  });
  readonly iconSignal = computed(() => {
    const config = this.config();
    return this.icon() ?? config?.icon;
  });
  readonly colorSignal = computed(() => {
    const config = this.config();
    return this.color() ?? config?.color ?? DEFAULT_DBX_FIREBASE_FORM_SPACE_STEP_BLOCK_COLOR;
  });
  readonly centerSignal = computed(() => {
    const config = this.config();
    return this.center() ?? config?.center ?? false;
  });

  /**
   * The badge's icon.
   *
   * A complete step SUPERSEDES its own number: the number is a position in a list of things still to do, and
   * once the step is done the useful thing to say is that it is done.
   */
  readonly badgeIconSignal = computed(() => {
    const complete = this.completeSignal();
    const completeIcon = this.completeIconSignal();
    const icon = this.iconSignal();
    return complete ? completeIcon : icon;
  });

  readonly badgeColorSignal = computed(() => {
    const complete = this.completeSignal();
    const completeColor = this.completeColorSignal();
    const color = this.colorSignal();
    return complete ? completeColor : color;
  });
}
