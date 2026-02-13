import { Component, computed, ElementRef, viewChild } from '@angular/core';
import { AbstractDbxSegueAnchorDirective } from '../../layout/anchor/anchor.segue.directive';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { overrideClickElementEffect } from '../../../util/click';

/**
 * SegueAnchor implementation for Angular Router.
 */
@Component({
  templateUrl: './anchor.component.html',
  imports: [DbxInjectionComponent],
  standalone: true
})
export class DbxAngularRouterSegueAnchorComponent extends AbstractDbxSegueAnchorDirective {
  readonly anchorElement = viewChild.required<string, ElementRef<HTMLElement>>('anchor', { read: ElementRef });
  readonly injectionElement = viewChild.required<string, ElementRef<HTMLElement>>('injection', { read: ElementRef });
  readonly anchorDisabledSignal = computed(() => this.anchorSignal()?.disabled ?? false);

  protected readonly _overrideClickElementEffect = overrideClickElementEffect({
    clickTarget: this.anchorElement,
    childClickTarget: this.injectionElement,
    disabledSignal: this.anchorDisabledSignal
  });
}
