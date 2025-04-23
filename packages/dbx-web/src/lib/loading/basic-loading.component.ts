import { Component, ElementRef, input, computed, ChangeDetectionStrategy, viewChild } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProgressBarMode } from '@angular/material/progress-bar';
import { ErrorInput, type Maybe } from '@dereekb/util';
import { checkNgContentWrapperHasContent } from '@dereekb/dbx-core';
import { ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { DbxErrorComponent } from '../error/error.component';
import { type DbxThemeColor } from '../layout/style/style';
import { DbxLoadingProgressComponent } from './loading-progress.component';
import { NgTemplateOutlet } from '@angular/common';

/**
 * DbxBasicLoadingComponent loading state.
 */
export type LoadingComponentState = 'none' | 'loading' | 'content' | 'error';

/**
 * Basic loading component.
 */
@Component({
  selector: 'dbx-basic-loading',
  templateUrl: './basic-loading.component.html',
  imports: [DbxErrorComponent, DbxLoadingProgressComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxBasicLoadingComponent {
  readonly customError = viewChild<string, Maybe<ElementRef>>('customError', { read: ElementRef });
  readonly customLoading = viewChild<string, Maybe<ElementRef>>('customLoading', { read: ElementRef });

  readonly diameter = input<Maybe<number>>();
  readonly mode = input<ProgressBarMode | ProgressSpinnerMode>('indeterminate');
  readonly color = input<ThemePalette | DbxThemeColor>('primary');
  readonly text = input<Maybe<string>>();
  readonly linear = input<Maybe<boolean>>(false);

  readonly show = input<Maybe<boolean>>(true);
  readonly loading = input<Maybe<boolean>>();
  readonly error = input<Maybe<ErrorInput>>();

  readonly stateSignal = computed<LoadingComponentState>(() => {
    const loading = this.loading();
    const error = this.error();
    const show = this.show() ?? true; // default to true if not defined

    let state: LoadingComponentState;

    if (error) {
      state = 'error';
    } else if (loading == null) {
      // If loading has not yet been defined and no error has occured, we're waiting for some input on loading or error.
      state = 'none';
    } else if (loading || !show) {
      state = 'loading';
    } else {
      state = 'content';
    }

    return state;
  });

  readonly hasNoCustomErrorSignal = computed(() => !checkNgContentWrapperHasContent(this.customError()));
  readonly hasNoCustomLoadingSignal = computed(() => !checkNgContentWrapperHasContent(this.customLoading()));
}
