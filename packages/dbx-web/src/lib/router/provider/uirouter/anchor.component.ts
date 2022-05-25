import { Observable, filter } from 'rxjs';
import { Component } from '@angular/core';
import { AbstractDbxSegueAnchorDirective } from '../../layout/anchor/anchor.segue.directive';
import { TransitionOptions } from '@uirouter/core';

/**
 * SegueAnchor implementation for UIRouter.
 */
@Component({
  templateUrl: './anchor.component.html'
})
export class DbxUIRouterSegueAnchorComponent extends AbstractDbxSegueAnchorDirective {

  readonly uiRef$ = this.ref$.pipe(filter(x => typeof x === 'string')) as Observable<string | null>;
  readonly uiOptions$ = this.refOptions$ as Observable<TransitionOptions | null>;

}
