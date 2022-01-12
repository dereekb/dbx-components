import { Component, Input } from '@angular/core';
import { ThemePalette } from '@angular/material/core';
import { ProgressBarMode } from '@angular/material/progress-bar';
import { ProgressSpinnerMode } from '@angular/material/progress-spinner';

export const DEFAULT_LOADING_PROGRESS_DIAMETER = 96;

/**
 * Basic loading progress component.
 */
@Component({
  selector: 'dbx-loading-progress',
  template: `
  <div class="loading-progress-view">
    <mat-progress-spinner *ngIf="!linear" [diameter]="diameter || 96" [mode]="mode" [color]="color" [value]="value" style="margin: auto;"></mat-progress-spinner>
    <mat-progress-bar *ngIf="linear" [mode]="mode" [color]="color" [bufferValue]="bufferValue" [value]="value" style="margin: auto;"></mat-progress-bar>
    <div *ngIf="text" class="hint">{{ text }}</div>
  </div>
  `
})
export class AppLoadingProgressComponent {

  private _diameter;

  @Input()
  text: string;

  @Input()
  linear: boolean;

  @Input()
  mode: ProgressBarMode | ProgressSpinnerMode = 'indeterminate';

  @Input()
  color: ThemePalette = 'primary';

  @Input()
  value: number;

  @Input()
  bufferValue: number;

  @Input()
  get diameter(): number {
    return this._diameter;
  }

  set diameter(diameter: number) {
    this._diameter = diameter ?? DEFAULT_LOADING_PROGRESS_DIAMETER;
  }

}
