import { Component, Inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { ReadableErrorWithCode } from '@dereekb/util';
import { JsonPipe } from '@angular/common';

export const CUSTOM_ERROR_WIDGET_TEST_ERROR_CODE = 'CUSTOM_ERROR_WIDGET_TEST_ERROR';

@Component({
    template: `
    <p class="mat-header">Custom widget content</p>
    <div>Error Data: {{ data | json }}</div>
  `,
    standalone: true,
    imports: [JsonPipe]
})
export class DocInteractionCustomErrorWidgetComponent {
  constructor(@Inject(DBX_INJECTION_COMPONENT_DATA) readonly data: ReadableErrorWithCode) {}
}
