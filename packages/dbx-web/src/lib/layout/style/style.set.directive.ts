import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject } from 'rxjs';
import { Directive, Input, OnDestroy, AfterViewInit, ChangeDetectorRef, OnInit } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxStyleService } from './style.service';

/**
 * Used to denote which app style to use for all children below this.
 * 
 * Will update the parent DbxStyleService.
 */
@Directive({
  selector: '[dbxSetStyle]',
  host: {
    'class': 'dbx-style-root',
    '[class]': 'style'
  }
})
export class DbxSetStyleDirective implements OnDestroy, OnInit {

  private _style = new BehaviorSubject<Maybe<string>>(undefined);
  readonly style$ = this._style.pipe(filterMaybe());

  constructor(readonly styleService: DbxStyleService, readonly cdRef: ChangeDetectorRef) {}

  @Input('dbxSetStyle')
  get style(): string {
    return this._style.value ?? '';
  }

  set style(style: string) {
    this._style.next(style);
  }

  ngOnDestroy(): void {
    this._style.complete();
  }

  ngOnInit(): void {
    this.styleService.setStyle(this.style$);
  }

}
