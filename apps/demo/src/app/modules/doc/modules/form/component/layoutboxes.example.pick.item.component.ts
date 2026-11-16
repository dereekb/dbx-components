import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { AbstractDbxLayoutBoxesItemDirective } from '@dereekb/dbx-form';
import { type DocFormLayoutBoxData } from './layoutboxes.example';

/**
 * Shared context for {@link DocFormLayoutBoxesPickItemComponent}, passed once as the row config's `data`.
 */
export interface DocFormLayoutBoxesPickItemData {
  /**
   * The labels every row can pick from.
   */
  readonly labels: string[];
}

/**
 * The labels the shared context example offers.
 */
export const DOC_FORM_LAYOUT_BOXES_PICK_LABELS: string[] = ['Ada', 'Grace', 'Alan', 'Lamp', 'Chair', 'Plant'];

/**
 * The labels thing boxes pick from in the row component per box example.
 */
export const DOC_FORM_LAYOUT_BOXES_THING_LABELS: string[] = ['Lamp', 'Chair', 'Plant', 'Table'];

/**
 * Demo row component that picks its box's label from a list shared by every row through `DBX_INJECTION_COMPONENT_DATA`.
 */
@Component({
  selector: 'doc-form-layout-boxes-pick-item',
  template: `
    @if (readonlySignal()) {
      <span>{{ dataSignal().label ?? 'No label' }}</span>
    } @else {
      <select class="doc-form-layout-boxes-pick-item" aria-label="Label" (change)="onLabelChange($event)">
        <option value="" [selected]="!dataSignal().label">No label</option>
        @for (label of pickData.labels; track label) {
          <option [value]="label" [selected]="label === dataSignal().label">{{ label }}</option>
        }
      </select>
    }
  `,
  styles: `
    .doc-form-layout-boxes-pick-item {
      width: 100%;
      font: var(--mat-sys-body-medium);
      padding: var(--dbx-padding-1) var(--dbx-padding-2);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-extra-small);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormLayoutBoxesPickItemComponent extends AbstractDbxLayoutBoxesItemDirective<DocFormLayoutBoxData> {
  readonly pickData = inject<DocFormLayoutBoxesPickItemData>(DBX_INJECTION_COMPONENT_DATA);

  onLabelChange(event: Event): void {
    const label = (event.target as HTMLSelectElement).value;
    this.setData({ ...this.dataSignal(), label: label || undefined });
  }
}
