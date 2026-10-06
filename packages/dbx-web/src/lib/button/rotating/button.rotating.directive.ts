import { LiveAnnouncer } from '@angular/cdk/a11y';
import { computed, Directive, effect, inject, input, model, untracked } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { DbxButtonComponent } from '../button.component';
import { type DbxRotatingButtonConfig, dbxRotatingButtonAriaLabel, dbxRotatingButtonStateIndex, nextDbxRotatingButtonState } from './button.rotating';

/**
 * Turns a `dbx-button` into a rotating / multi-state button. Each click moves to the next configured state, and the
 * state's icon, text, style and aria-label are set on the button.
 *
 * Use {@link dbxTristateRotatingButtonConfig} for a three-state / 3-phase (default/on/off) toggle. The directive sets the
 * button's `icon`, `text`, `buttonStyle` and `ariaLabel`, so configure those through the config rather than on the button.
 *
 * The button stops click propagation by default, so a rotating button works inside clickable list rows.
 *
 * @dbxWebComponent
 * @dbxWebSlug rotating-button
 * @dbxWebCategory button
 * @dbxWebKind directive
 * @dbxWebRelated button, icon-button
 * @dbxWebMinimalExample ```html
 * <dbx-button iconOnly [dbxRotatingButton]="tristateConfig" [(dbxRotatingButtonValue)]="emailEnabled"></dbx-button>
 * ```
 *
 * @example
 * ```ts
 * readonly tristateConfig = dbxTristateRotatingButtonConfig({ label: 'Text', defaultValue: false });
 * ```
 *
 * @example
 * ```html
 * <dbx-button stroked [dbxRotatingButton]="{ label: 'Sort', states: [{ value: 'asc', display: { icon: 'arrow_upward', text: 'Ascending' } }, { value: 'desc', display: { icon: 'arrow_downward', text: 'Descending' } }] }" [(dbxRotatingButtonValue)]="sort"></dbx-button>
 * ```
 */
@Directive({
  selector: '[dbxRotatingButton]',
  exportAs: 'dbxRotatingButton'
})
export class DbxRotatingButtonDirective<T = unknown> {
  readonly dbxButton = inject(DbxButtonComponent, { host: true });
  private readonly _liveAnnouncer = inject(LiveAnnouncer);

  readonly dbxRotatingButton = input<Maybe<DbxRotatingButtonConfig<T>>>();

  /**
   * The current value. Two-way bindable with `[(dbxRotatingButtonValue)]`.
   */
  readonly dbxRotatingButtonValue = model<Maybe<T>>();

  /**
   * Index of the state matching the current value, or -1 if none match.
   */
  readonly stateIndexSignal = computed(() => {
    const dbxRotatingButtonValue = this.dbxRotatingButtonValue();
    const config = this.dbxRotatingButton();
    return config ? dbxRotatingButtonStateIndex(config, dbxRotatingButtonValue) : -1;
  });

  /**
   * The current state. Falls back to the first state when the value matches no state.
   */
  readonly stateSignal = computed(() => {
    const states = this.dbxRotatingButton()?.states;
    const index = this.stateIndexSignal();
    return states?.[index === -1 ? 0 : index];
  });

  readonly ariaLabelSignal = computed(() => dbxRotatingButtonAriaLabel(this.dbxRotatingButton()?.label, this.stateSignal()));

  constructor() {
    effect(() => {
      const config = this.dbxRotatingButton();
      const state = this.stateSignal();
      const ariaLabel = this.ariaLabelSignal();

      untracked(() => {
        const button = this.dbxButton;
        const baseStyle = config?.style;
        const stateStyle = state?.style;

        button.icon.set(state?.display?.icon);
        button.text.set(state?.display?.text);
        button.buttonStyle.set(baseStyle || stateStyle ? { ...baseStyle, ...stateStyle } : undefined);
        button.ariaLabel.set(ariaLabel);
      });
    });

    cleanSubscription(this.dbxButton.clicked$.subscribe(() => this.rotate()));
  }

  /**
   * Moves to the next state, emits its value, and announces the change.
   */
  rotate(): void {
    const config = this.dbxRotatingButton();
    const nextState = config ? nextDbxRotatingButtonState(config, this.dbxRotatingButtonValue()) : undefined;

    if (config && nextState) {
      this.dbxRotatingButtonValue.set(nextState.value);

      const announcement = dbxRotatingButtonAriaLabel(config.label, nextState);

      if (config.announceChanges !== false && announcement) {
        void this._liveAnnouncer.announce(announcement);
      }
    }
  }
}
