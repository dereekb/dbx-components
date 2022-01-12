import { Directive, OnInit, OnDestroy, Input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { SubscriptionObject } from '../../subscription';
import { StateService, UIRouterGlobals } from '@uirouter/core';
import { throttleTime } from 'rxjs/operators';
import { AppPageButtonDirective } from '../fab/fab.directive';

// MARK: Button Directives
@Directive({
  selector: '[appButtonSegue]'
})
export class AppButtonSegueDirective implements OnInit, OnDestroy {

  private _sub = new SubscriptionObject();

  @Input()
  public appButtonSegue?: string;

  @Input()
  public segueParams?: {};

  public throttle = 50;

  constructor(private _fab: AppPageButtonDirective, private _state: StateService, private _uiRouterGlobals: UIRouterGlobals) { }

  ngOnInit(): void {
    this._sub.subscription = this._fab.buttonClick.pipe(
      throttleTime(this.throttle)
    ).subscribe(() => {
      this.performSegue();
    });
  }

  ngOnDestroy(): void {
    this._sub.destroy();
  }

  // MARK: Segue
  public get segueName(): Maybe<string> {
    return this.appButtonSegue;
  }

  protected performSegue(): void {
    const params = { ...this._uiRouterGlobals.current.params, ...this.segueParams };
    this._state.go(this.segueName, params);
  }

}
