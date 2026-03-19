import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  template: `
    <p>Action Header</p>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionTableActionHeaderExampleComponent {}
