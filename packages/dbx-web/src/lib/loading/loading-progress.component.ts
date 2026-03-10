import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { type ThemePalette } from '@angular/material/core';
import { MatProgressBar, type ProgressBarMode } from '@angular/material/progress-bar';
import { MatProgressSpinner, type ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { type Maybe } from '@dereekb/util';
import { type DbxThemeColor } from '../layout/style/style';
import { NgClass } from '@angular/common';
import { DbxColorDirective } from '../layout/style/style.color.directive';

/**
 * Default diameter in pixels for the progress spinner.
 */
export const DEFAULT_LOADING_PROGRESS_DIAMETER = 96;

/**
 * Renders a Material progress spinner or progress bar to indicate loading.
 *
 * Supports both linear (bar) and circular (spinner) modes with configurable
 * diameter, color, and optional hint text below the indicator.
 *
 * @example
 * ```html
 * <!-- Indeterminate spinner -->
 * <dbx-loading-progress></dbx-loading-progress>
 *
 * <!-- Determinate linear bar at 75% -->
 * <dbx-loading-progress [linear]="true" mode="determinate" [value]="75" text="Uploading..."></dbx-loading-progress>
 * ```
 */
@Component({
  selector: 'dbx-loading-progress',
  template: `
    <div [dbxColor]="color()" class="loading-progress-view">
      @switch (linear()) {
        @case (true) {
          <mat-progress-bar [mode]="bmode()" [bufferValue]="bufferValue()" [value]="value()" style="margin: auto;"></mat-progress-bar>
        }
        @default {
          <mat-progress-spinner [diameter]="diameterSignal()" [mode]="smode()" [value]="value()" style="margin: auto;"></mat-progress-spinner>
        }
      }
      @if (text()) {
        <div class="dbx-loading-progress-hint dbx-hint dbx-small" [ngClass]="{ 'text-center': !linear() }">{{ text() }}</div>
      }
    </div>
  `,
  imports: [MatProgressBar, MatProgressSpinner, NgClass, DbxColorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxLoadingProgressComponent {
  readonly defaultDiameter = DEFAULT_LOADING_PROGRESS_DIAMETER;

  readonly diameter = input<Maybe<number>>(this.defaultDiameter);

  readonly text = input<Maybe<string>>();
  readonly linear = input<Maybe<boolean>>();
  readonly mode = input<ProgressBarMode | ProgressSpinnerMode>('indeterminate');
  readonly color = input<ThemePalette | DbxThemeColor>('primary');
  readonly value = input<Maybe<number>>();
  readonly bufferValue = input<Maybe<number>>();

  readonly bmode = computed(() => this.mode() as ProgressBarMode);
  readonly smode = computed(() => this.mode() as ProgressSpinnerMode);

  readonly diameterSignal = computed(() => this.diameter() || this.defaultDiameter);
}
