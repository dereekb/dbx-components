import { Component } from '@angular/core';
import { AbstractDbNgxSegueAnchorDirective } from '../../anchor/anchor.segue.directive';

/**
 * SegueAnchor implementation for UIRouter.
 */
@Component({
  templateUrl: './anchor.component.html'
})
export class DbNgxUIRouterSegueAnchorComponent extends AbstractDbNgxSegueAnchorDirective { }
