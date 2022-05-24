import {
  Component, Input
} from '@angular/core';
import { ChecklistItemDisplayContent, ChecklistItemFieldDisplayComponent } from './checklist.item';

// MARK: Default
@Component({
  template: `
    <div *ngIf="displayContent" class="dbx-default-checklist-item-field">
      <div *ngIf="label" class="item-label">{{ label }}</div>
      <div *ngIf="sublabel" class="item-sublabel">{{ sublabel }}</div>
      <div *ngIf="description" class="dbx-hint item-description">{{ description }}</div>
    </div>
  `
})
export class DbxDefaultChecklistItemFieldDisplayComponent<T = unknown> implements ChecklistItemFieldDisplayComponent<T> {

  @Input()
  displayContent!: ChecklistItemDisplayContent<T>;

  get label() {
    return this.displayContent?.label;
  }

  get sublabel() {
    return this.displayContent?.sublabel;
  }

  get description() {
    return this.displayContent?.description;
  }

}
