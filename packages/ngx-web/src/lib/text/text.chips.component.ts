import { Component, Input, OnInit } from '@angular/core';

export interface TextChip<T = any> {
  text: string;
  tooltip?: string;
  color?: 'primary' | 'accent';
  data?: T;
}

@Component({
  selector: 'dbx-text-chips',
  template: `
  <mat-chip-list *ngIf="chips" [multiple]="false" (chipSelectionChanges)="onSelectionChange($event)">
    <mat-chip *ngFor="let chip of chips" selected [color]="chip.color" [matTooltip]="chip.tooltip" matTooltipPosition="above">
      {{chip.text}}
    </mat-chip>
  </mat-chip-list>
  `,
  styleUrls: ['./text.scss']
})
export class DbNgxTextChipsComponent<T = any> {

  @Input()
  chips: TextChip<T>[];

  onSelectionChange(x): void {
    console.log('Selection changed: ', x);
  }

}
