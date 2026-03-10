import { ChangeDetectionStrategy, Component, computed, input, output, inject, signal } from '@angular/core';
import { type Maybe, type ErrorInput, toReadableError, type ReadableError, isDefaultReadableError, type Configurable } from '@dereekb/util';
import { DbxErrorPopoverComponent } from './error.popover.component';
import { DbxInjectionComponent, type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type DbxErrorViewButtonEvent, DbxErrorViewComponent } from './error.view.component';
import { DbxErrorWidgetService } from './error.widget.service';
import { DbxPopoverService } from '../interaction/popover/popover.service';
import { type NgPopoverRef } from 'ng-overlay-container';

/**
 * Determines how the error component renders its content.
 *
 * - `'none'` - No error to display.
 * - `'default'` - Uses the built-in error view with icon and message.
 * - `'custom'` - Uses a dynamically injected custom error widget component.
 */
type DbxErrorComponentViewType = 'none' | 'default' | 'custom';

/**
 * Internal state used by {@link DbxErrorComponent} to track the current error display configuration.
 */
interface DbxErrorComponentState {
  readonly viewType: DbxErrorComponentViewType;
  readonly isDefaultError?: Maybe<boolean>;
  readonly message?: Maybe<string>;
  readonly rawError?: Maybe<ErrorInput>;
  readonly error?: Maybe<ReadableError>;
  readonly customView?: Maybe<DbxInjectionComponentConfig>;
}

/**
 * Root error component that displays content related to an error.
 *
 * Converts an {@link ErrorInput} into a {@link ReadableError} and renders either a default error view
 * with an icon and message, or a custom error widget registered via {@link DbxErrorWidgetService}.
 * Clicking the error icon opens a popover with detailed error information.
 *
 * @example
 * ```html
 * <dbx-error [error]="myError"></dbx-error>
 *
 * <!-- Icon-only mode, no message text -->
 * <dbx-error [error]="myError" [iconOnly]="true"></dbx-error>
 * ```
 */
@Component({
  selector: 'dbx-error',
  template: `
    @switch (viewTypeSignal()) {
      @case ('default') {
        <dbx-error-view icon="error" [message]="messageSignal()" [buttonDisabled]="isDefaultErrorSignal()" (buttonClick)="openErrorPopover($event)"></dbx-error-view>
      }
      @case ('custom') {
        <dbx-injection [config]="customViewSignal()"></dbx-injection>
      }
    }
  `,
  standalone: true,
  imports: [DbxErrorViewComponent, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxErrorComponent {
  private readonly popoverService = inject(DbxPopoverService);
  private readonly dbxErrorWidgetService = inject(DbxErrorWidgetService);

  readonly popoverOpened = output<NgPopoverRef>();

  readonly error = input<Maybe<ErrorInput>>();
  readonly iconOnly = input<Maybe<boolean>>(false);

  private readonly _errorOverrideSignal = signal<Maybe<ErrorInput>>(undefined);
  readonly errorSignal = computed(() => this._errorOverrideSignal() ?? this.error());

  readonly state = computed<DbxErrorComponentState>(() => {
    const rawError = this.errorSignal();
    const iconOnly = this.iconOnly();

    if (rawError != null) {
      const error = toReadableError(rawError);
      const isDefaultError = iconOnly ? false : isDefaultReadableError(error);

      let state: DbxErrorComponentState = {
        viewType: 'default',
        rawError,
        error,
        message: (error as ReadableError)?.message || 'An error occurred.',
        isDefaultError
      };

      if (iconOnly) {
        delete (state as Configurable<DbxErrorComponentState>).message;
      } else {
        const entry = this.dbxErrorWidgetService.getErrorWidgetEntry(error.code);
        const componentClass = entry?.errorComponentClass;

        if (componentClass != null) {
          state = {
            ...state,
            viewType: 'custom',
            customView: {
              componentClass,
              data: error
            }
          };
        }
      }

      return state;
    } else {
      return { viewType: 'none' };
    }
  });

  readonly viewTypeSignal = computed(() => this.state().viewType);
  readonly isDefaultErrorSignal = computed(() => this.state().isDefaultError);
  readonly messageSignal = computed(() => this.state().message);
  readonly customViewSignal = computed(() => this.state().customView);

  setError(error: Maybe<ErrorInput>) {
    this._errorOverrideSignal.set(error);
  }

  openErrorPopover(event: DbxErrorViewButtonEvent) {
    const error = this.state().error;

    if (error != null) {
      const popoverRef = DbxErrorPopoverComponent.openPopover(this.popoverService, {
        origin: event.origin,
        error
      });

      this.popoverOpened.emit(popoverRef);
    }
  }
}
