import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatProgressBar, type ProgressBarMode } from '@angular/material/progress-bar';
import { MatProgressSpinner, type ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { type Maybe } from '@dereekb/util';
import { NgClass } from '@angular/common';

/**
 * Default diameter in pixels for the progress spinner.
 */
export const DEFAULT_LOADING_PROGRESS_DIAMETER = 96;

/**
 * Renders a Material progress spinner or progress bar to indicate loading.
 *
 * Supports both linear (bar) and circular (spinner) modes with configurable
 * diameter and optional hint text below the indicator. To color the indicator,
 * apply `[dbxColor]` directly on the host — its `dbx-loading-progress.dbx-color`
 * SCSS maps the indicator color to the supplied token. Without `[dbxColor]` the
 * indicator uses the Material default color.
 *
 * @dbxWebComponent
 * @dbxWebSlug loading-progress
 * @dbxWebCategory feedback
 * @dbxWebRelated loading, basic-loading
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-loading-progress></dbx-loading-progress>
 * ```
 *
 * @example
 * ```html
 * <dbx-loading-progress mode="bar" dbxColor="accent"></dbx-loading-progress>
 * ```
 */
@Component({
  selector: 'dbx-loading-progress',
  template: `
    <div class="loading-progress-view" role="status" [attr.aria-label]="text() || 'Loading'">
      <span class="loading-progress-view-indicator">
        @switch (linear()) {
          @case (true) {
            <mat-progress-bar [mode]="bmodeSignal()" [bufferValue]="bufferValue()" [value]="value()" style="margin: auto;"></mat-progress-bar>
          }
          @default {
            <mat-progress-spinner [diameter]="diameterSignal()" [mode]="smodeSignal()" [value]="value()" style="margin: auto;"></mat-progress-spinner>
          }
        }
      </span>
      @if (text()) {
        <div class="dbx-loading-progress-hint dbx-hint dbx-small" [ngClass]="{ 'text-center': !linear() }" aria-hidden="true">{{ text() }}</div>
      }
    </div>
  `,
  imports: [MatProgressBar, MatProgressSpinner, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxLoadingProgressComponent {
  readonly defaultDiameter = DEFAULT_LOADING_PROGRESS_DIAMETER;

  readonly diameter = input<Maybe<number>>(this.defaultDiameter);

  readonly text = input<Maybe<string>>();
  readonly linear = input<Maybe<boolean>>();
  readonly mode = input<ProgressBarMode | ProgressSpinnerMode>('indeterminate');
  readonly value = input<Maybe<number>>();
  readonly bufferValue = input<Maybe<number>>();

  readonly bmodeSignal = computed(() => this.mode());
  readonly smodeSignal = computed(() => this.mode() as ProgressSpinnerMode);

  readonly diameterSignal = computed(() => this.diameter() || this.defaultDiameter);
}
