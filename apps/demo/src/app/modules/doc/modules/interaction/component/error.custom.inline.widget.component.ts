import { Component, Inject } from '@angular/core';
import { DBX_INJECTION_COMPONENT_DATA } from '@dereekb/dbx-core';
import { ReadableErrorWithCode } from '@dereekb/util';

export const CUSTOM_DBX_ERROR_TEST_ERROR_CODE = 'CUSTOM_DBX_ERROR_TEST_ERROR';

@Component({
    template: `
    <h3>Custom inline error widget content</h3>
    <p class="mat-header">Custom inline error widget content</p>
  `,
    standalone: true
})
export class DocInteractionCustomInlineErrorWidgetComponent {
  constructor(@Inject(DBX_INJECTION_COMPONENT_DATA) readonly data: ReadableErrorWithCode) {}
}
