import { Component, Input, OnChanges, ViewChild, ChangeDetectorRef, AfterViewInit, ElementRef, AfterContentChecked, ChangeDetectionStrategy } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProgressBarMode } from '@angular/material/progress-bar';
import { ErrorInput } from '../error';
import { safeDetectChanges, checkNgContentWrapperHasContent } from '../util/view';

/**
 * DbNgxBasicLoadingComponent loading state.
 */
export enum LoadingComponentState {

  Loading = 0,

  Content = 1,

  Error = 2

}

/**
 * Basic loading component.
 */
@Component({
  selector: 'dbngx-basic-loading',
  templateUrl: './basic-loading.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbNgxBasicLoadingComponent implements OnChanges, AfterViewInit {

  private _show = true;

  @Input()
  text?: string;

  @Input()
  diameter?: number;

  @Input()
  mode: ProgressBarMode = 'indeterminate';

  @Input()
  color: ThemePalette = 'primary';

  @Input()
  linear = false;

  @Input()
  error?: ErrorInput;

  @ViewChild('customError')
  customErrorContent?: ElementRef;

  @ViewChild('customLoading')
  customLoadingContent?: ElementRef;

  private _loading: boolean = false;
  private _state: LoadingComponentState = LoadingComponentState.Loading;

  constructor(private _cdRef: ChangeDetectorRef) { }

  ngAfterViewInit(): void {
    this._tryUpdateState();
    safeDetectChanges(this._cdRef);
  }

  ngOnChanges(): void {
    this._detectStateChanges();
  }

  get isLoading(): boolean {
    return this._loading;
  }

  get show(): boolean {
    return this._show;
  }

  @Input()
  set show(show: boolean | undefined) {
    this._show = show ?? true;
  }

  @Input()
  set waitFor(object: any) {
    this._loading = Boolean(object);
  }

  public get hasCustomError(): boolean {
    return checkNgContentWrapperHasContent(this.customErrorContent);
  }

  public get hasCustomLoading(): boolean {
    return checkNgContentWrapperHasContent(this.customLoadingContent);
  }

  public get state(): LoadingComponentState {
    return this._state;
  }

  private _detectStateChanges(): void {
    if (this._tryUpdateState()) {
      safeDetectChanges(this._cdRef);
    }
  }

  private _tryUpdateState(): boolean {
    const state = this._calculateNewState();

    if (this._state !== state) {
      this._state = state;
      return true;
    } else {
      return false;
    }
  }

  private _calculateNewState(): LoadingComponentState {
    let state = LoadingComponentState.Error;

    if (!this.error) {
      if (!this.isLoading && this.show) {
        state = LoadingComponentState.Content;
      } else {
        state = LoadingComponentState.Loading;
      }
    }

    return state;
  }

}
