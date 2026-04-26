import { Component, ElementRef, input, computed, ChangeDetectionStrategy, viewChild, type Signal } from '@angular/core';
import { type ThemePalette } from '@angular/material/core';
import { type ProgressBarMode } from '@angular/material/progress-bar';
import { type ErrorInput, isDefinedAndNotFalse, type Maybe } from '@dereekb/util';
import { checkNgContentWrapperHasContent } from '@dereekb/dbx-core';
import { type ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { DbxErrorComponent } from '../error/error.component';
import { type DbxThemeColor } from '../layout/style/style';
import { DbxLoadingProgressComponent } from './loading-progress.component';
import { NgTemplateOutlet } from '@angular/common';
import { type DbxLoadingIsLoadingOrProgress, type DbxLoadingProgress } from './loading';

/**
 * Visual state of a {@link DbxBasicLoadingComponent}.
 *
 * - `none` — waiting for initial input (no loading or error yet)
 * - `loading` — spinner/progress bar is visible
 * - `content` — loading complete, projected content is shown
 * - `error` — an error occurred, error view is shown
 */
export type LoadingComponentState = 'none' | 'loading' | 'content' | 'error';

/**
 * Low-level loading component that renders a spinner or progress bar, error state, and projected content.
 *
 * Prefer using {@link DbxLoadingComponent} (`<dbx-loading>`) which wraps this component with
 * support for {@link LoadingContext} streams.
 *
 * @dbxWebComponent
 * @dbxWebSlug basic-loading
 * @dbxWebCategory feedback
 * @dbxWebRelated loading, loading-progress, error
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-basic-loading [loading]="true"><p>Content</p></dbx-basic-loading>
 * ```
 *
 * @example
 * ```html
 * <dbx-basic-loading [loading]="true" color="accent" text="Loading data...">
 *   <p>Content appears here when loading is false.</p>
 * </dbx-basic-loading>
 * ```
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
  readonly mode = input<Maybe<ProgressBarMode | ProgressSpinnerMode>>();
  readonly color = input<ThemePalette | DbxThemeColor>('primary');
  readonly text = input<Maybe<string>>();
  readonly linear = input<Maybe<boolean>>(false);

  readonly show = input<Maybe<boolean>>(true);
  readonly loading = input<Maybe<DbxLoadingIsLoadingOrProgress>>();
  readonly error = input<Maybe<ErrorInput>>();

  readonly loadingProgressSignal = computed(() => {
    const loading = this.loading();
    let result: Maybe<DbxLoadingProgress>;

    if (typeof loading === 'number') {
      result = loading;
    }

    return result;
  });

  readonly modeSignal: Signal<ProgressBarMode | ProgressSpinnerMode> = computed(() => {
    const mode = this.mode();
    const loadingProgress = this.loadingProgressSignal();

    let result: ProgressBarMode | ProgressSpinnerMode;

    if (!mode) {
      if (loadingProgress != null) {
        result = 'determinate';
      } else {
        result = 'indeterminate';
      }
    } else {
      result = mode;
    }

    return result;
  });

  readonly isLoadingSignal = computed(() => isDefinedAndNotFalse(this.loading()));

  readonly stateSignal = computed<LoadingComponentState>(() => {
    const loading = this.isLoadingSignal();
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
