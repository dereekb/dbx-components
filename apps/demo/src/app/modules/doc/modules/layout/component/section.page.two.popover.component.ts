import { Component, type ElementRef, ChangeDetectionStrategy } from '@angular/core';
import { type DbxPopoverKey, AbstractPopoverDirective, type DbxPopoverService, DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverCloseButtonComponent, DbxPopoverScrollContentDirective } from '@dereekb/dbx-web';
import { type NgPopoverRef } from 'ng-overlay-container';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export const DOC_LAYOUT_SECTIONPAGETWO_POPOVER_KEY = 'doc-layout-sectionpagetwo-popover';

export interface DocLayoutSectionPageTwoPopoverConfig {
  origin: ElementRef;
}

@Component({
  template: `
    <dbx-popover-content>
      <dbx-popover-header icon="info" header="Example Popover">
        <dbx-popover-close-button></dbx-popover-close-button>
      </dbx-popover-header>
      <dbx-popover-scroll-content>
        <p class="dbx-hint">Example popover content.</p>
      </dbx-popover-scroll-content>
    </dbx-popover-content>
  `,
  standalone: true,
  imports: [DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverCloseButtonComponent, DbxPopoverScrollContentDirective, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocLayoutSectionPageTwoPopoverComponent extends AbstractPopoverDirective<void> {
  static openPopover(popoverService: DbxPopoverService, { origin }: DocLayoutSectionPageTwoPopoverConfig, popoverKey?: DbxPopoverKey): NgPopoverRef<unknown, void> {
    return popoverService.open({
      key: popoverKey ?? DOC_LAYOUT_SECTIONPAGETWO_POPOVER_KEY,
      origin,
      componentClass: DocLayoutSectionPageTwoPopoverComponent
    });
  }
}
