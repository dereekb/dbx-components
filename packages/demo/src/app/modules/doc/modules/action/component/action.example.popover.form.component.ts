import { DocActionFormExampleValue } from './action.example.form.component';
import { Component, ElementRef } from '@angular/core';
import { DbxPopoverKey, AbstractPopoverDirective, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { HandleActionFunction } from '@dereekb/dbx-core';
import { of } from 'rxjs';

export const DEFAULT_INTERACTION_POPOVER_COMPOSER_POPOVER_KEY = 'popover';

export interface DocInteractionPopoverConfig {
  origin: ElementRef;
}

@Component({
  template: `
  <dbx-popover-content>
    <dbx-popover-header icon="home" header="Header"></dbx-popover-header>
    <dbx-action [dbxActionHandler]="handleSubmitForm">
      <doc-action-form-example-form dbxActionForm></doc-action-form-example-form>
      <dbx-button dbxActionButton text="Submit"></dbx-button>
    </dbx-action>
  </dbx-popover-content>
  `
})
export class DocActionExamplePopoverComponent extends AbstractPopoverDirective<DocActionFormExampleValue> {

  static openPopover(popoverService: DbxPopoverService, { origin }: DocInteractionPopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef<any, DocActionFormExampleValue> {
    return popoverService.open({
      key: popoverKey ?? DEFAULT_INTERACTION_POPOVER_COMPOSER_POPOVER_KEY,
      origin,
      componentClass: DocActionExamplePopoverComponent
    });
  }

  handleSubmitForm: HandleActionFunction<DocActionFormExampleValue> = (value: DocActionFormExampleValue) => {
    this.returnAndClose(value);
    return of(true);
  }

}
