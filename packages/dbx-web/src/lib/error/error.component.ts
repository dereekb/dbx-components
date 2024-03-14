import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { Maybe, ErrorInput, toReadableError, ReadableError, ReadableErrorWithCode, isDefaultReadableError } from '@dereekb/util';
import { DbxPopoverService } from '../interaction/popover/popover.service';
import { DbxErrorPopoverComponent } from './error.popover.component';
import { BehaviorSubject, map, shareReplay } from 'rxjs';
import { AbstractSubscriptionDirective, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxErrorViewButtonEvent } from './error.view.component';
import { DbxErrorWidgetService } from './error.widget.service';

type DbxReadableErrorComponentViewType = 'none' | 'default' | 'custom';

interface DbxReadableErrorComponentState {
  readonly viewType: DbxReadableErrorComponentViewType;
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
    <ng-container [ngSwitch]="viewType">
      <ng-container *ngSwitchCase="'default'">
        <dbx-error-view icon="error" [message]="message" [buttonDisabled]="isDefaultError" (buttonClick)="openErrorPopover($event)"></dbx-error-view>
      </ng-container>
      <ng-container *ngSwitchCase="'custom'">
        <dbx-injection [config]="customView"></dbx-injection>
      </ng-container>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxReadableErrorComponent extends AbstractSubscriptionDirective {
  private _state: DbxReadableErrorComponentState = {
    viewType: 'none'
  };

  private _inputError = new BehaviorSubject<Maybe<ErrorInput>>(undefined);

  readonly state$ = this._inputError.pipe(
    map((rawError) => {
      let state: DbxReadableErrorComponentState;

      if (rawError != null) {
        const error = toReadableError(rawError);
        const isDefaultError = isDefaultReadableError(error);

        state = {
          viewType: 'default',
          rawError,
          error,
          message: (error as ReadableError)?.message || 'An error occured.',
          isDefaultError
        };

        if (error) {
          let customView: Maybe<DbxInjectionComponentConfig>;
          const entry = this.dbxErrorWidgetService.getErrorWidgetEntry(error.code);
          const componentClass = entry?.errorComponentClass;

          if (componentClass != null) {
            customView = {
              componentClass,
              data: error
            };
          }

          // apply custom view
          if (customView) {
            state = {
              ...state,
              viewType: 'custom',
              customView
            };
          }
        }
      } else {
        state = {
          viewType: 'none'
        };
      }

      return state;
    }),
    shareReplay(1)
  );

  constructor(readonly popoverService: DbxPopoverService, readonly dbxErrorWidgetService: DbxErrorWidgetService, readonly cdRef: ChangeDetectorRef) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.state$.subscribe((state) => {
      this._state = state;
      this.cdRef.markForCheck();
    });
  }

  protected get viewType() {
    return this._state.viewType;
  }

  protected get isDefaultError() {
    return this._state.isDefaultError;
  }

  protected get message(): Maybe<string> {
    return this._state.message;
  }

  protected get customView(): Maybe<DbxInjectionComponentConfig> {
    return this._state.customView;
  }

  @Input()
  get error() {
    return this._state.rawError;
  }

  set error(error: Maybe<ErrorInput>) {
    this._inputError.next(error);
  }

  protected openErrorPopover(event: DbxErrorViewButtonEvent) {
    const error = this._state.error;

    if (error != null) {
      DbxErrorPopoverComponent.openPopover(this.popoverService, {
        origin: event.origin,
        error
      });
    }
  }
}
