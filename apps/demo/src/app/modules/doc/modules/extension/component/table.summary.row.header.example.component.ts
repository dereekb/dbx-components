import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  template: `
    <div class="dbx-small dbx-hint">Summary Row Header</div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionTableSummaryRowHeaderExampleComponent {}
