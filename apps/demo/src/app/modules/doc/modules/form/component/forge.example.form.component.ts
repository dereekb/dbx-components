import { Component, ChangeDetectionStrategy } from '@angular/core';
import { dbxForgeFormComponentProviders, AbstractConfigAsyncForgeFormDirective, DbxForgeFormComponentImportsModule, DbxFormValueChangeDirective } from '@dereekb/dbx-form';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type Maybe } from '@dereekb/util';
import { type Observable, map } from 'rxjs';
import { DbxContentBorderDirective } from '@dereekb/dbx-web';
import { JsonPipe } from '@angular/common';

/**
 * Forge equivalent of DocFormExampleComponent. Accepts a FormConfig input and
 * renders a forge dynamic form with a live JSON value preview.
 */
@Component({
  exportAs: 'forgeExampleForm',
  template: `
    <div>
      <dbx-forge (dbxFormValueChange)="value = $event"></dbx-forge>
      <p></p>
      <dbx-content-border style="white-space: break-spaces;">
        <p>> {{ value | json }}</p>
      </dbx-content-border>
    </div>
  `,
  selector: 'doc-forge-example-form',
  providers: dbxForgeFormComponentProviders(),
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule, DbxFormValueChangeDirective, DbxContentBorderDirective, JsonPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormForgeExampleComponent extends AbstractConfigAsyncForgeFormDirective<any, FormConfig> {
  value: any;
  readonly formConfig$: Observable<Maybe<FormConfig>> = this.currentConfig$.pipe(map((config: Maybe<FormConfig>) => config ?? undefined));
}
