import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  template: `
    <div class="dbx-small dbx-hint">Summary Row Header</div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionTableSummaryRowHeaderExampleComponent {}
