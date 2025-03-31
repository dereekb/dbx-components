import { ChangeDetectionStrategy, Component, computed, input, Input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { MatProgressBar, ProgressBarMode } from '@angular/material/progress-bar';
import { MatProgressSpinner, ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { type Maybe } from '@dereekb/util';
import { DbxThemeColor } from '../layout/style/style';
import { NgClass } from '@angular/common';

export const DEFAULT_LOADING_PROGRESS_DIAMETER = 96;

/**
 * Basic loading progress component.
 */
@Component({
  selector: 'dbx-loading-progress',
  template: `
    <div class="loading-progress-view">
      @switch (linear()) {
        @case (true) {
          <mat-progress-bar [mode]="bmode()" [color]="color()" [bufferValue]="bufferValue()" [value]="value()" style="margin: auto;"></mat-progress-bar>
        }
        @case (false) {
          <mat-progress-spinner [diameter]="diameter() || 96" [mode]="smode()" [color]="color()" [value]="value()" style="margin: auto;"></mat-progress-spinner>
        }
      }
      @if (text()) {
        <div class="dbx-loading-progress-hint dbx-hint dbx-small" [ngClass]="{ 'text-center': !linear() }">{{ text() }}</div>
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
  readonly color = input<ThemePalette | DbxThemeColor>('primary');
  readonly value = input<Maybe<number>>();
  readonly bufferValue = input<Maybe<number>>();

  readonly bmode = computed(() => this.mode() as ProgressBarMode);
  readonly smode = computed(() => this.mode() as ProgressSpinnerMode);
}
