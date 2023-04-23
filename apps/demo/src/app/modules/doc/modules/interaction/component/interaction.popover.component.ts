import { Component, ElementRef, OnInit } from '@angular/core';
import { DbxPopoverKey, AbstractPopoverDirective, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';

export const DEFAULT_INTERACTION_POPOVER_COMPOSER_POPOVER_KEY = 'popover';

export interface DocInteractionPopoverConfig {
  origin: ElementRef;
}

@Component({
  template: `
    <dbx-popover-content>
      <dbx-popover-header icon="home" header="Header">
        <span>Custom Content</span>
      </dbx-popover-header>
      <dbx-popover-controls>
        <dbx-bar color="warn">
          <button mat-raised-button>Button</button>
          <dbx-spacer></dbx-spacer>
          <button mat-raised-button>Button</button>
        </dbx-bar>
      </dbx-popover-controls>
      <dbx-popover-scroll-content>
        <dbx-interaction-example-popover-content (return)="returnAndClose($event)" (close)="close()"></dbx-interaction-example-popover-content>
        <p class="dbx-hint">Configured to return "{{ onCloseValue }}" when closed via a backdrop click.</p>
      </dbx-popover-scroll-content>
    </dbx-popover-content>
  `
})
export class DocInteractionExamplePopoverComponent extends AbstractPopoverDirective<number> implements OnInit {
  readonly onCloseValue = 12345;

  static openPopover(popoverService: DbxPopoverService, { origin }: DocInteractionPopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef<any, number> {
    return popoverService.open({
      key: popoverKey ?? DEFAULT_INTERACTION_POPOVER_COMPOSER_POPOVER_KEY,
      origin,
      componentClass: DocInteractionExamplePopoverComponent
    });
  }

  ngOnInit(): void {
    this.popover.getClosingValueFn = (_, type) => {
      if (type === 'backdropClick') {
        return this.onCloseValue;
      } else {
        return undefined;
      }
    };
  }
}
