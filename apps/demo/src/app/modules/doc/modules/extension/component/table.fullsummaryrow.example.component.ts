import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  template: `
    <div class="dbx-small dbx-hint">Full Summary Row</div>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionTableFullSummaryRowExampleComponent {}
