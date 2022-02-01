import { Component } from '@angular/core';
import { AbstractDbxSegueAnchorDirective } from '../../layout/anchor/anchor.segue.directive';

/**
 * SegueAnchor implementation for UIRouter.
 */
@Component({
  templateUrl: './anchor.component.html'
})
export class DbxUIRouterSegueAnchorComponent extends AbstractDbxSegueAnchorDirective { }
