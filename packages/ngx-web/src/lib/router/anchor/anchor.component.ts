import { Input, Component, ContentChild } from '@angular/core';
import { AbstractAnchorDirective } from './anchor.directive';

/**
 * Component that renders an anchor element depending on the input.
 */
@Component({
  selector: 'app-anchor',
  templateUrl: './anchor.component.html',
  styleUrls: ['./anchor.scss']
})
export class AppAnchorComponent extends AbstractAnchorDirective {

  @Input()
  public block?: boolean;

  // TODO: Add usage and tests for DbNgxInjectedComponentInstance<T>

  get anchorBlockClass(): string {
    return this.block ? 'anchor-block' : '';
  }

}
