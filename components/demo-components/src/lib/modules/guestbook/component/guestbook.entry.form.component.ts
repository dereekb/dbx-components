import { Component } from '@angular/core';
import { AbstractSyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, DbxForgeFormComponentImportsModule, dbxForgeFormComponentProviders } from '@dereekb/dbx-form';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type GuestbookEntry } from 'demo-firebase';
import { guestbookEntryFields } from './guestbook.entry.form';

export type DemoGuestbookEntryFormValue = Pick<GuestbookEntry, 'message' | 'signed' | 'published'>;

@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  selector: 'demo-guestbook-entry-form',
  providers: dbxForgeFormComponentProviders(),
  standalone: true,
  imports: [DbxForgeFormComponentImportsModule]
})
export class DemoGuestbookEntryFormComponent extends AbstractSyncForgeFormDirective<DemoGuestbookEntryFormValue> {
  readonly formConfig: FormConfig = { fields: guestbookEntryFields() };
}
