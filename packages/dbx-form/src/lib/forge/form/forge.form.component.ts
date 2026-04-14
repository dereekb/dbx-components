import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { FormConfig } from '@ng-forge/dynamic-forms';
import { Observable, map } from 'rxjs';
import { DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule } from './forge.component.template';
import { AbstractConfigAsyncForgeFormDirective } from './forge.directive';
import { DbxForgeFormContext } from './forge.context';

/**
 * A basic forge form that takes in the config and passes it off as form-config.
 *
 * Useful for tests.
 */
@Component({
  selector: 'dbx-forge-form',
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeAsyncConfigFormComponent<O = unknown, C extends FormConfig = FormConfig> extends AbstractConfigAsyncForgeFormDirective<O, C> {
  readonly formConfig$: Observable<Maybe<FormConfig>> = this.currentConfig$;
}
