import { DbxScreenMediaService, ScreenMediaWidthType } from '../../screen';
import { Directive, ChangeDetectorRef, Input, OnInit } from '@angular/core';
import { BehaviorSubject, map, shareReplay, distinctUntilChanged, delay } from 'rxjs';
import { AbstractSubscriptionDirective, safeDetectChanges } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

/**
 * Used to declare a dbxFlexGroup.
 */
@Directive({
  selector: '[dbxFlexGroup]',
  host: {
    '[class.dbx-flex-group]': 'content',
    '[class.dbx-flex-group-small]': 'small',
    '[class.dbx-flex-group-relative]': 'relative'
  }
})
export class DbxFlexGroupDirective extends AbstractSubscriptionDirective implements OnInit {

  @Input()
  content = true;

  @Input()
  relative = false;

  private _small: boolean = false;

  private _breakpoint = new BehaviorSubject<ScreenMediaWidthType>('tablet');
  readonly isSmallScreen$ = this._dbxScreenMediaService.isBreakpointActive(this._breakpoint).pipe(map(x => !x), distinctUntilChanged(), shareReplay(1));

  get small(): boolean {
    return this._small;
  }

  constructor(private readonly _dbxScreenMediaService: DbxScreenMediaService, readonly cdRef: ChangeDetectorRef) {
    super();
  }

  ngOnInit(): void {
    this.sub = this.isSmallScreen$.pipe(delay(0)).subscribe((small) => {
      this._small = small;
      safeDetectChanges(this.cdRef);
    });
  }

  @Input()
  set breakpoint(breakpoint: Maybe<ScreenMediaWidthType>) {
    this._breakpoint.next(breakpoint ?? 'tablet');
  }

}
