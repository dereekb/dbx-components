import { Component } from "@angular/core";
import { ProvideFormlyContext, AbstractSyncFormlyFormDirective } from "@dereekb/dbx-form";
import { GuestbookEntry } from "@dereekb/demo-firebase";
import { FormlyFieldConfig } from "@ngx-formly/core";
import { guestbookEntryFields } from "./guestbook.entry.form";

export type DemoGuestbookEntryFormValue = Pick<GuestbookEntry, 'message' | 'signed' | 'published'>

@Component({
  template: `<dbx-formly></dbx-formly>`,
  selector: 'demo-guestbook-entry-form',
  providers: [ProvideFormlyContext()]
})
export class DemoGuestbookEntryFormComponent extends AbstractSyncFormlyFormDirective<DemoGuestbookEntryFormValue> {

  readonly fields: FormlyFieldConfig[] = guestbookEntryFields();

}
