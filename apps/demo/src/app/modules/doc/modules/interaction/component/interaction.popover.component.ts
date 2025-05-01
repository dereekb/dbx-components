import { Component, ElementRef, OnInit } from '@angular/core';
import { DbxPopoverKey, AbstractPopoverDirective, DbxPopoverService } from '@dereekb/dbx-web';
import { NgPopoverRef } from 'ng-overlay-container';
import { DbxPopoverContentComponent } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/popover/popover.content.component';
import { DbxPopoverHeaderComponent } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/popover/popover.header.component';
import { DbxButtonSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.spacer.directive';
import { DbxPopoverCloseButtonComponent } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/popover/popover.close.component';
import { DbxPopoverControlsDirective } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/popover/popover.controls.directive';
import { DbxBarDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/bar/bar.directive';
import { MatButton } from '@angular/material/button';
import { DbxSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/style/spacer.directive';
import { DbxPopoverScrollContentDirective } from '../../../../../../../../../packages/dbx-web/src/lib/interaction/popover/popover.scroll.content.directive';
import { DocInteractionExamplePopoverContentComponent } from './interaction.popover.content.component';

export const DEFAULT_INTERACTION_POPOVER_COMPOSER_POPOVER_KEY = 'popover';

export interface DocInteractionPopoverConfig {
  origin: ElementRef;
}

@Component({
    template: `
    <dbx-popover-content>
      <dbx-popover-header icon="home" header="Header">
        <span>Custom Content</span>
        <dbx-button-spacer></dbx-button-spacer>
        <dbx-popover-close-button></dbx-popover-close-button>
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
  `,
    standalone: true,
    imports: [DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxButtonSpacerDirective, DbxPopoverCloseButtonComponent, DbxPopoverControlsDirective, DbxBarDirective, MatButton, DbxSpacerDirective, DbxPopoverScrollContentDirective, DocInteractionExamplePopoverContentComponent]
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
