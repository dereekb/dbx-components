import { Component } from '@angular/core';
import { AbstractDbxSegueAnchorDirective } from '../../layout/anchor/anchor.segue.directive';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { AsyncPipe } from '@angular/common';

/**
 * SegueAnchor implementation for Angular Router.
 */
@Component({
  templateUrl: './anchor.component.html',
  imports: [DbxInjectionComponent, AsyncPipe],
  standalone: true
})
export class DbxAngularRouterSegueAnchorComponent extends AbstractDbxSegueAnchorDirective {}
