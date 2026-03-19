import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AbstractDbxSearchableFieldDisplayDirective } from '@dereekb/dbx-form';

@Component({
  template: `
    <div class="dbx-primary-bg">
      <span class="dbx-chip-label">{{ displayValue.label }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormExamplePrimarySearchableFieldDisplayComponent<T> extends AbstractDbxSearchableFieldDisplayDirective<T> {}

@Component({
  template: `
    <div class="dbx-accent-bg">
      <span class="dbx-chip-label">{{ displayValue.label }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormExampleAccentSearchableFieldDisplayComponent<T> extends AbstractDbxSearchableFieldDisplayDirective<T> {}

@Component({
  template: `
    <div class="dbx-warn-bg">
      <span class="dbx-chip-label">{{ displayValue.label }}</span>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormExampleWarnSearchableFieldDisplayComponent<T> extends AbstractDbxSearchableFieldDisplayDirective<T> {}
