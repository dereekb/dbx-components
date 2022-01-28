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
    <ng-container [ngSwitch]="linear">
      <mat-progress-bar *ngSwitchCase="true" [mode]="mode" [color]="color" [bufferValue]="bufferValue" [value]="value" style="margin: auto;"></mat-progress-bar>
      <mat-progress-spinner *ngSwitchDefault [diameter]="diameter || 96" [mode]="mode" [color]="color" [value]="value" style="margin: auto;"></mat-progress-spinner>
    </ng-container>
    <div *ngIf="text" class="hint">{{ text }}</div>
  </div>
  `
})
export class DbNgxLoadingProgressComponent {

  private _diameter: number = DEFAULT_LOADING_PROGRESS_DIAMETER;

  @Input()
  text?: string;

  @Input()
  linear?: boolean;

  @Input()
  mode: ProgressBarMode | ProgressSpinnerMode = 'indeterminate';

  @Input()
  color: ThemePalette = 'primary';

  @Input()
  value?: number;

  @Input()
  bufferValue?: number;

  @Input()
  get diameter(): number {
    return this._diameter;
  }

  set diameter(diameter: number) {
    this._diameter = diameter ?? DEFAULT_LOADING_PROGRESS_DIAMETER;
  }

}
