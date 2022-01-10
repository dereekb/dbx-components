import { Component, Input, ChangeDetectorRef, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { MatProgressBar, ProgressBarMode } from '@angular/material/progress-bar';
import { AbstractSubscriptionDirective } from '../utility';
import { LoadingContext } from './loading';

@Component({
  selector: 'app-loading',
  template: `
  <dbngx-basic-loading [show]="show" [color]="color" [text]="text" [mode]="mode" [linear]="linear" [diameter]="diameter" [error]="error" [waitFor]="loading">
    <ng-content loading select="[loading]"></ng-content>
    <ng-content></ng-content>
    <ng-content error select="[error]"></ng-content>
    <ng-content errorAction select="[errorAction]"></ng-content>
  </dbngx-basic-loading>
  `
})
export class AppLoadingComponent extends AbstractSubscriptionDirective {

  @Input()
  show: boolean;

  @Input()
  text: string;

  @Input()
  mode: ProgressBarMode = 'indeterminate';

  @Input()
  color: ThemePalette = 'primary';

  @Input()
  diameter?: number;

  @Input()
  linear: boolean;

  private _loading: boolean;
  private _error: any;

  constructor(private ngZone: NgZone) {
    super();
  }

  @Input()
  get loading(): boolean {
    return this._loading;
  }

  set loading(loading: boolean) {
    this._loading = loading;
  }

  @Input()
  get error(): any {
    return this._error;
  }

  set error(error: any) {
    this._error = error;
  }

  /**
   * Sets a LoadingContext that is watched for the loading state.
   */
  @Input()
  set context(context: LoadingContext) {
    let subscription;

    if (context) {
      subscription = context.stream$.subscribe((x) => {
        this.ngZone.run(() => {
          this._loading = x.isLoading;
          this._error = x.error;
        });
      });
    }

    this.sub = subscription;
  }

}
