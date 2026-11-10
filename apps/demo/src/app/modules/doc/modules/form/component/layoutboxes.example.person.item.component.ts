import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AbstractDbxLayoutBoxesItemDirective } from '@dereekb/dbx-form';
import { DbxButtonComponent } from '@dereekb/dbx-web';
import { type DocFormLayoutBoxData } from './layoutboxes.example';

/**
 * Demo row component for person boxes: a free-text name, and a button that turns the box into a thing.
 *
 * Turning the box into a thing changes the config the row function picks, so the row swaps to the thing component.
 */
@Component({
  selector: 'doc-form-layout-boxes-person-item',
  template: `
    @if (readonlySignal()) {
      <span>{{ dataSignal().label ?? 'Unnamed person' }}</span>
    } @else {
      <div class="doc-form-layout-boxes-person-item">
        <mat-icon class="doc-form-layout-boxes-person-item-icon">person</mat-icon>
        <input class="doc-form-layout-boxes-person-item-name" placeholder="Name" aria-label="Name" [value]="dataSignal().label ?? ''" (input)="onNameInput($event)" />
        <dbx-button stroked icon="category" text="Make thing" (buttonClick)="makeThing()"></dbx-button>
      </div>
    }
  `,
  styles: `
    .doc-form-layout-boxes-person-item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--dbx-padding-2);
    }
    .doc-form-layout-boxes-person-item-icon {
      color: var(--mat-sys-primary);
    }
    .doc-form-layout-boxes-person-item-name {
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
  imports: [MatIconModule, DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormLayoutBoxesPersonItemComponent extends AbstractDbxLayoutBoxesItemDirective<DocFormLayoutBoxData> {
  onNameInput(event: Event): void {
    this.setData({ ...this.dataSignal(), label: (event.target as HTMLInputElement).value });
  }

  makeThing(): void {
    this.setData({ kind: 'thing' });
  }
}
