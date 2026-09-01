import { Component } from '@angular/core';
import { AbstractSyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, DbxForgeFormComponentImportsModule, dbxForgeFormComponentProviders } from '@dereekb/dbx-form';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type DemoTestFormSpaceData } from 'demo-firebase';
import { demoTestFormSpaceFields } from './formspace.test.form';

/**
 * The "test information" a {@link DEMO_TEST_FORM_SPACE_TYPE} space parks in its `d` field.
 *
 * The whole object, not a patch: `formSpace.update:_` REPLACES `d` rather than merging into it, because the
 * client owns the form and a merge would make clearing a field impossible to express.
 */
export type DemoTestFormSpaceFormValue = DemoTestFormSpaceData;

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'demo-test-formspace-form',
  providers: dbxForgeFormComponentProviders(),
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule]
})
export class DemoTestFormSpaceFormComponent extends AbstractSyncForgeFormDirective<DemoTestFormSpaceFormValue> {
  readonly formConfig: FormConfig = { fields: demoTestFormSpaceFields() };
}
