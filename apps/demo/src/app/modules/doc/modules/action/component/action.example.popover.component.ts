import { DocActionFormExampleValue } from './action.example.form.component';
import { Component, ElementRef } from '@angular/core';
import { DbxPopoverKey, AbstractPopoverDirective, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { WorkUsingObservable } from '@dereekb/rxjs';
import { of } from 'rxjs';

export const DEFAULT_INTERACTION_POPOVER_COMPOSER_POPOVER_KEY = 'popover';

export interface DocInteractionPopoverConfig {
  origin: ElementRef;
}

@Component({
  template: `
    <dbx-popover-content>
      <dbx-popover-header icon="home" header="Header"></dbx-popover-header>
      <dbx-content-container style="margin-top: 12px">
        <dbx-action [dbxActionHandler]="handleSubmitForm">
          <doc-action-form-example-form dbxActionForm></doc-action-form-example-form>
          <dbx-button dbxActionButton text="Submit"></dbx-button>
        </dbx-action>
      </dbx-content-container>
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

  handleSubmitForm: WorkUsingObservable<DocActionFormExampleValue> = (value: DocActionFormExampleValue) => {
    this.returnAndClose(value);
    return of(true);
  };
}
