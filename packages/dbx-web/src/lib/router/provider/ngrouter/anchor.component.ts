import { Component } from '@angular/core';
import { AbstractDbxSegueAnchorDirective } from '../../layout/anchor/anchor.segue.directive';
import { DbxInjectionComponent } from '@dereekb/dbx-core';

/**
 * SegueAnchor implementation for Angular Router.
 */
@Component({
  templateUrl: './anchor.component.html',
  imports: [DbxInjectionComponent],
  standalone: true
})
export class DbxAngularRouterSegueAnchorComponent extends AbstractDbxSegueAnchorDirective {}
