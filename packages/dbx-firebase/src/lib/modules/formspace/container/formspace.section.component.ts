import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type DbxColorInput } from '@dereekb/dbx-web';
import { type FormSpaceFileSlot, type FormSpaceSlotStatus, type FormSpaceSubmitBlocker } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { of, switchMap } from 'rxjs';
import { FormSpaceDocumentStore } from '../store/formspace.document.store';
import { DbxFirebaseFormSpaceStepBlockComponent } from './formspace.step.block.component';

/**
 * Configuration for the {@link DbxFirebaseFormSpaceSectionComponent}.
 */
export interface DbxFirebaseFormSpaceSectionComponentConfig {
  /**
   * The slot whose status decides whether this section is complete.
   *
   * Omit for a section no slot backs — a form the user fills in, a term they accept — and drive it with
   * {@link complete} instead.
   */
  readonly slot?: Maybe<FormSpaceFileSlot>;
  readonly step?: Maybe<number>;
  readonly header?: Maybe<string>;
  readonly hint?: Maybe<string>;
  /**
   * Overrides the derived completion.
   *
   * Takes precedence over {@link slot}, so a section can be held incomplete for a reason the space does not
   * model — an unsaved form beside an uploaded file, say.
   */
  readonly complete?: Maybe<boolean>;
  /**
   * Whether the section shows a line explaining what is holding it up. Defaults to true.
   */
  readonly showBlockerHint?: Maybe<boolean>;
  /**
   * Whether a FOLDER slot's header carries its occupancy, as `Header (2 / 4)`. Defaults to true.
   *
   * A one-file slot has no count worth showing: it is either filled or it is not, and the step's own
   * checkmark already says which.
   */
  readonly showCount?: Maybe<boolean>;
  readonly completeIcon?: Maybe<string>;
  readonly completeColor?: Maybe<DbxColorInput>;
  readonly icon?: Maybe<string>;
  readonly color?: Maybe<DbxColorInput>;
  readonly center?: Maybe<boolean>;
}

/**
 * Returns the sentence a section shows for the first thing holding it up, or undefined when nothing is.
 *
 * The FIRST blocker rather than all of them: `formSpaceSubmitBlockers` reports at most one per slot, and a
 * section is one slot.
 *
 * @param status - The slot's status.
 * @returns The sentence, or undefined.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function dbxFirebaseFormSpaceSectionBlockerHint(status: Maybe<FormSpaceSlotStatus>): Maybe<string> {
  let hint: Maybe<string>;
  const blocker: Maybe<FormSpaceSubmitBlocker> = status?.blockers[0];

  if (blocker != null && status != null) {
    switch (blocker.reason) {
      case 'missing_files': {
        // a one-file slot reads as a thing rather than a count: "1 more file is required" for an empty
        // required cover is a sentence about arithmetic, not about the cover
        if (status.minFiles === 1) {
          hint = 'A file is required here.';
        } else {
          const remaining = status.minFiles - status.files.length;
          const noun = remaining === 1 ? 'file is' : 'files are';
          hint = `${remaining} more ${noun} required here.`;
        }

        break;
      }
      case 'invalid_file':
        hint = 'A file here was rejected. Remove it to continue.';
        break;
      case 'pending_validation':
        hint = 'Still checking a file here.';
        break;
    }
  }

  return hint;
}

/**
 * One numbered step of a FormSpace: its header, whatever it contains, and a checkmark once the space says
 * its requirement is met.
 *
 * Reads the ambient {@link FormSpaceDocumentStore}, so it must sit inside whatever provides it — the page
 * component's own `providers`, or a `dbxFirebaseFormSpaceDocument` directive.
 *
 * Given a `slot`, the completion is DERIVED from the same `formSpaceSubmitBlockers()` the server's submit
 * transaction rejects on, so a section showing a check is a section the server would not object to. That
 * requires the app to have registered its type registry with `provideDbxFirebaseFormSpaceTypeConfigService()`;
 * without it the status is unknown and the section stays incomplete rather than claiming a check it never
 * verified.
 *
 * A section with no slot takes `complete` directly, which is how a JSON form or an acknowledgement gets a
 * step of its own.
 *
 * @example
 * ```html
 * <dbx-firebase-formspace-section [step]="1" [slot]="coverSlot" header="Cover File" hint="One file.">
 *   <dbx-firebase-formspace-slot-upload [slot]="coverSlot"></dbx-firebase-formspace-slot-upload>
 * </dbx-firebase-formspace-section>
 * ```
 */
@Component({
  selector: 'dbx-firebase-formspace-section',
  template: `
    <dbx-firebase-formspace-step-block [step]="stepSignal()" [header]="stepHeaderSignal()" [hint]="hintSignal()" [complete]="completeSignal()" [completeIcon]="completeIconSignal()" [completeColor]="completeColorSignal()" [icon]="iconSignal()" [color]="colorSignal()" [center]="centerSignal()">
      <span header><ng-content select="[header]"></ng-content></span>
      @if (blockerHintSignal(); as blockerHint) {
        <div class="dbx-firebase-formspace-section-blocker dbx-hint" [class.dbx-warn]="blockerIsWarningSignal()">{{ blockerHint }}</div>
      }
      <ng-content></ng-content>
    </dbx-firebase-formspace-step-block>
  `,
  host: {
    class: 'dbx-firebase-formspace-section d-block'
  },
  imports: [DbxFirebaseFormSpaceStepBlockComponent],
  standalone: true
})
export class DbxFirebaseFormSpaceSectionComponent {
  readonly formSpaceDocumentStore = inject(FormSpaceDocumentStore);

  readonly config = input<Maybe<DbxFirebaseFormSpaceSectionComponentConfig>>();

  readonly slot = input<Maybe<FormSpaceFileSlot>>();
  readonly step = input<Maybe<number>>();
  readonly header = input<Maybe<string>>();
  readonly hint = input<Maybe<string>>();
  readonly complete = input<Maybe<boolean>>();
  readonly showBlockerHint = input<Maybe<boolean>>();
  readonly showCount = input<Maybe<boolean>>();
  readonly completeIcon = input<Maybe<string>>();
  readonly completeColor = input<Maybe<DbxColorInput>>();
  readonly icon = input<Maybe<string>>();
  readonly color = input<Maybe<DbxColorInput>>();
  readonly center = input<Maybe<boolean>>();

  readonly slotSignal = computed(() => {
    const config = this.config();
    return this.slot() ?? config?.slot;
  });
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
  readonly showBlockerHintSignal = computed(() => {
    const config = this.config();
    return this.showBlockerHint() ?? config?.showBlockerHint ?? true;
  });
  readonly showCountSignal = computed(() => {
    const config = this.config();
    return this.showCount() ?? config?.showCount ?? true;
  });
  readonly completeIconSignal = computed(() => {
    const config = this.config();
    return this.completeIcon() ?? config?.completeIcon;
  });
  readonly completeColorSignal = computed(() => {
    const config = this.config();
    return this.completeColor() ?? config?.completeColor;
  });
  readonly iconSignal = computed(() => {
    const config = this.config();
    return this.icon() ?? config?.icon;
  });
  readonly colorSignal = computed(() => {
    const config = this.config();
    return this.color() ?? config?.color;
  });
  readonly centerSignal = computed(() => {
    const config = this.config();
    return this.center() ?? config?.center ?? false;
  });

  readonly slot$ = toObservable(this.slotSignal);

  /**
   * What the section's slot holds, or undefined for a section with no slot — or when no type registry was
   * provided for the space's type.
   */
  readonly slotStatus$ = this.slot$.pipe(switchMap((slot) => (slot == null ? of(undefined as Maybe<FormSpaceSlotStatus>) : this.formSpaceDocumentStore.slotStatus$(slot))));

  readonly slotStatusSignal = toSignal(this.slotStatus$);

  /**
   * Whether the section is done.
   *
   * An explicit `complete` wins over the derived one: it is the only way to express a requirement the space
   * does not model, and a section that stated one should not have it quietly overruled by a file count.
   */
  readonly completeSignal = computed(() => {
    const config = this.config();
    const slotStatus = this.slotStatusSignal();
    const complete = this.complete() ?? config?.complete;
    return complete ?? slotStatus?.complete ?? false;
  });

  /**
   * The header, carrying a folder slot's occupancy.
   *
   * The count lives HERE rather than on the slot upload inside the section, because a section that names the
   * step is the thing the count belongs to — printing it in both places names the slot twice.
   */
  readonly stepHeaderSignal = computed(() => {
    const header = this.headerSignal();
    const status = this.slotStatusSignal();
    const showCount = this.showCountSignal();
    return status != null && header != null && showCount && status.maxFiles > 1 ? `${header} (${status.files.length} / ${status.maxFiles})` : header;
  });

  readonly blockerHintSignal = computed(() => {
    const showBlockerHint = this.showBlockerHintSignal();
    const status = this.slotStatusSignal();
    return showBlockerHint ? dbxFirebaseFormSpaceSectionBlockerHint(status) : undefined;
  });

  /**
   * Whether the blocker needs the user to undo something rather than to carry on.
   *
   * Only a REJECTED file does: an unfilled required slot is the normal state of a form the user is still
   * working through, and painting it as a warning makes an untouched form look broken.
   */
  readonly blockerIsWarningSignal = computed(() => this.slotStatusSignal()?.blockers[0]?.reason === 'invalid_file');
}
