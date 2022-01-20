import { Component } from '@angular/core';
import { AbstractDbNgxSegueAnchorDirective } from '../../anchor/anchor.segue.directive';

/**
 * SegueAnchor implementation for Angular Router.
 */
@Component({
  templateUrl: './anchor.component.html'
})
export class DbNgxAngularRouterSegueAnchorComponent extends AbstractDbNgxSegueAnchorDirective { }
