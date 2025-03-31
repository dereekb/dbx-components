import { BehaviorSubject, Observable } from 'rxjs';
import { OnDestroy, Component, Input, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProgressBarMode } from '@angular/material/progress-bar';
import { LoadingContext, LoadingContextEvent, switchMapLoadingContextStream } from '@dereekb/rxjs';
import { ErrorInput, type Maybe } from '@dereekb/util';
import { DbxThemeColor } from '../layout/style/style';
import { toSignal } from '@angular/core/rxjs-interop';
import { DbxBasicLoadingComponent } from './basic-loading.component';

/**
 * State of a DbxLoadingComponent.
 */
export interface DbxLoadingComponentState {
  readonly loading: boolean;
  readonly error: Maybe<ErrorInput>;
}

/**
 * Loading View component that provides content sections for loading, error, and an error action.
 */
@Component({
  selector: 'dbx-loading',
  template: `
    <dbx-basic-loading [show]="show()" [color]="color()" [text]="text()" [mode]="mode()" [linear]="linear()" [diameter]="diameter()" [error]="stateSignal().error" [loading]="stateSignal().loading">
      <ng-content loading select="[loading]"></ng-content>
      @if (linear() && padding() && stateSignal().loading) {
        <div class="dbx-loading-linear-done-padding"></div>
      }
      <ng-content></ng-content>
      <ng-content error select="[error]"></ng-content>
      <ng-content errorAction select="[errorAction]"></ng-content>
    </dbx-basic-loading>
  `,
  imports: [DbxBasicLoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxLoadingComponent implements OnDestroy {
  private readonly _context = new BehaviorSubject<Maybe<LoadingContext>>(undefined);
  readonly contextStream$: Observable<LoadingContextEvent> = this._context.pipe(switchMapLoadingContextStream());

  readonly contextStreamSignal = toSignal(this.contextStream$);

  readonly loading = input<Maybe<boolean>>();
  readonly error = input<Maybe<ErrorInput>>();

  readonly stateSignal = computed<DbxLoadingComponentState>(() => {
    let loadingState = this.contextStreamSignal() as DbxLoadingComponentState | undefined;

    if (loadingState == null) {
      loadingState = {
        loading: this.loading() ?? false,
        error: this.error()
      };
    }

    return loadingState;
  });

  readonly show = input<Maybe<boolean>>();
  readonly text = input<Maybe<string>>();
  readonly mode = input<ProgressBarMode>('indeterminate');
  readonly color = input<ThemePalette | DbxThemeColor>('primary');
  readonly diameter = input<Maybe<number>>();
  readonly linear = input<Maybe<boolean>>();

  /**
   * Whether or not to add padding to the linear presentation when linear is complete. This prevents the linear bar from pushing content around.
   */
  readonly padding = input<Maybe<boolean>>();

  ngOnDestroy() {
    this._context.complete();
  }

  @Input()
  get context(): Maybe<LoadingContext> {
    return this._context.value;
  }

  set context(context: Maybe<LoadingContext>) {
    this._context.next(context);
  }
}
