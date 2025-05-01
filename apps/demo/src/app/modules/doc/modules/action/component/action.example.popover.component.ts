import { DocActionFormExampleValue, DocActionFormExampleFormComponent } from './action.example.form.component';
import { Component, ElementRef } from '@angular/core';
import { DbxPopoverKey, AbstractPopoverDirective, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { WorkUsingObservable } from '@dereekb/rxjs';
import { of } from 'rxjs';
import { DbxPopoverContentComponent } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/popover/popover.content.component';
import { DbxPopoverHeaderComponent } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/popover/popover.header.component';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DbxActionDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/context/action.directive';
import { DbxActionHandlerDirective } from '../../../../../../../../../packages/dbx-core/src/lib/action/directive/state/action.handler.directive';
import { DbxActionFormDirective } from '../../../../../../../../../packages/dbx-form/src/lib/form/action/form.action.directive';
import { DbxButtonComponent } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.component';
import { DbxActionButtonDirective } from '../../../../../../../../../packages/dbx-core/src/lib/button/action/action.button.directive';

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
  `,
    standalone: true,
    imports: [DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxContentContainerDirective, DbxActionDirective, DbxActionHandlerDirective, DocActionFormExampleFormComponent, DbxActionFormDirective, DbxButtonComponent, DbxActionButtonDirective]
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
