import { Component } from '@angular/core';
import { AbstractDbxSegueAnchorDirective } from '../../anchor/anchor.segue.directive';

/**
 * SegueAnchor implementation for Angular Router.
 */
@Component({
  templateUrl: './anchor.component.html'
})
export class DbxAngularRouterSegueAnchorComponent extends AbstractDbxSegueAnchorDirective { }
