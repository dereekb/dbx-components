import { ChangeDetectionStrategy, Component, computed, input, output, inject, signal } from '@angular/core';
import { Maybe, ErrorInput, toReadableError, ReadableError, isDefaultReadableError, Configurable } from '@dereekb/util';
import { DbxPopoverService } from '../interaction/popover/popover.service';
import { DbxErrorPopoverComponent } from './error.popover.component';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxErrorViewButtonEvent, DbxErrorViewComponent } from './error.view.component';
import { DbxErrorWidgetService } from './error.widget.service';
import { NgPopoverRef } from 'ng-overlay-container';

type DbxErrorComponentViewType = 'none' | 'default' | 'custom';

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
