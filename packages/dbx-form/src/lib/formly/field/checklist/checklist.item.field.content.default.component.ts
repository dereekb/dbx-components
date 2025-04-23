import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ChecklistItemDisplayContent, ChecklistItemFieldDisplayComponent } from './checklist.item';
import { NgIf } from '@angular/common';
import { type Maybe } from '@dereekb/util';

// MARK: Default
@Component({
  template: `
    @if (displayContentSignal()) {
      <div class="dbx-default-checklist-item-field">
        @if (displayContentSignal()?.label) {
          <div class="item-label">{{ displayContentSignal()?.label }}</div>
        }
        @if (displayContentSignal()?.sublabel) {
          <div class="item-sublabel">{{ displayContentSignal()?.sublabel }}</div>
        }
        @if (displayContentSignal()?.description) {
          <div class="dbx-hint item-description">{{ displayContentSignal()?.description }}</div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [NgIf]
})
export class DbxDefaultChecklistItemFieldDisplayComponent<T = unknown> implements ChecklistItemFieldDisplayComponent<T> {
  readonly _displayContentSignal = signal<Maybe<ChecklistItemDisplayContent<T>>>(undefined);
  readonly displayContentSignal = this._displayContentSignal.asReadonly();

  setDisplayContent(displayContent: ChecklistItemDisplayContent<T>): void {
    this._displayContentSignal.set(displayContent);
  }
}
