import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonToggleModule, type MatButtonToggleChange } from '@angular/material/button-toggle';
import { AbstractDbxLayoutBoxesItemDirective } from '@dereekb/dbx-form';
import { type DocFormLayoutBoxData, type DocFormLayoutBoxKind } from './layoutboxes.example';

/**
 * Demo row component for the layout boxes field: edits one box's kind and label.
 */
@Component({
  selector: 'doc-form-layout-boxes-item',
  template: `
    @if (readonlySignal()) {
      <span class="doc-form-layout-boxes-item-text">{{ dataSignal().kind }}{{ dataSignal().label ? ': ' + dataSignal().label : '' }}</span>
    } @else {
      <div class="doc-form-layout-boxes-item">
        <mat-button-toggle-group hideSingleSelectionIndicator [value]="dataSignal().kind" (change)="onKindChange($event)" aria-label="Kind">
          <mat-button-toggle value="person">Person</mat-button-toggle>
          <mat-button-toggle value="thing">Thing</mat-button-toggle>
        </mat-button-toggle-group>
        <input class="doc-form-layout-boxes-item-label" placeholder="Label" aria-label="Label" [value]="dataSignal().label ?? ''" (input)="onLabelInput($event)" />
      </div>
    }
  `,
  styles: `
    .doc-form-layout-boxes-item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--dbx-padding-2);
    }
    .doc-form-layout-boxes-item-label {
      flex: 1 1 120px;
      min-width: 0;
      font: var(--mat-sys-body-medium);
      padding: var(--dbx-padding-1) var(--dbx-padding-2);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-extra-small);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
    }
  `,
  imports: [MatButtonToggleModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormLayoutBoxesItemComponent extends AbstractDbxLayoutBoxesItemDirective<DocFormLayoutBoxData> {
  onKindChange(event: MatButtonToggleChange): void {
    this.setData({ ...this.dataSignal(), kind: event.value as DocFormLayoutBoxKind });
  }

  onLabelInput(event: Event): void {
    this.setData({ ...this.dataSignal(), label: (event.target as HTMLInputElement).value });
  }
}
