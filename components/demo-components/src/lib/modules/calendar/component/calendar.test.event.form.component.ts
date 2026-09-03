import { Component } from '@angular/core';
import { AbstractSyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, DbxForgeFormComponentImportsModule, dbxForgeFormComponentProviders } from '@dereekb/dbx-form';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type ProfileCreateTestCalendarEventParams } from 'demo-firebase';
import { demoCalendarTestEventFields } from './calendar.test.event.form';

export type DemoCalendarTestEventFormValue = Pick<ProfileCreateTestCalendarEventParams, 'name' | 'startsAt' | 'durationMinutes' | 'recurrenceRule'>;

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'demo-calendar-test-event-form',
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule]
})
export class DemoCalendarTestEventFormComponent extends AbstractSyncForgeFormDirective<DemoCalendarTestEventFormValue> {
  readonly formConfig: FormConfig = { fields: demoCalendarTestEventFields() };
}
