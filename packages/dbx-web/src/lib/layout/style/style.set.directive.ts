import { splitCommaSeparatedStringToSet } from '@dereekb/util';
import { Observable, distinctUntilChanged, map, shareReplay } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';
import { BehaviorSubject, delay, combineLatest } from 'rxjs';
import { Directive, Input, OnDestroy, ChangeDetectorRef, OnInit } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxStyleConfig, DbxStyleService } from './style.service';
import { AbstractSubscriptionDirective, safeDetectChanges } from '@dereekb/dbx-core';

/**
 * Used to denote which app style to use for all children below this.
 * 
 * Will update the parent DbxStyleService.
 */
@Directive({
  selector: '[dbxSetStyle]',
  host: {
    'class': 'dbx-style-root',
    '[class]': 'outputStyle'
  }
})
export class DbxSetStyleDirective extends AbstractSubscriptionDirective implements OnDestroy, OnInit {

  private _suffixes = new BehaviorSubject<Maybe<string>>(undefined);
  private _style = new BehaviorSubject<Maybe<string>>(undefined);

  readonly style$ = this._style.pipe(filterMaybe());
  readonly suffixes$ = this._suffixes.pipe(distinctUntilChanged(), map(splitCommaSeparatedStringToSet));

  readonly config$: Observable<DbxStyleConfig> = combineLatest([this.style$, this.suffixes$]).pipe(
    map(([style, suffixes]) => ({ style, suffixes })),
    shareReplay(1)
  );

  readonly outputStyle$ = this.styleService.getStyleWithConfig(this.config$);
  outputStyle = '';

  constructor(readonly styleService: DbxStyleService, readonly cdRef: ChangeDetectorRef) {
    super();
  }

  ngOnInit(): void {
    this.styleService.setConfig(this.config$);
    this.sub = this.outputStyle$.pipe(delay(0)).subscribe((style) => {
      this.outputStyle = style;
      safeDetectChanges(this.cdRef);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._suffixes.complete();
    this._style.complete();
  }

  @Input('dbxSetStyle')
  get style(): string {
    return this._style.value ?? '';
  }

  set style(style: string) {
    this._style.next(style);
  }

  @Input()
  get suffixes(): Maybe<string> {
    return this._suffixes.value;
  }

  set suffixes(suffixes: Maybe<string>) {
    this._suffixes.next(suffixes);
  }

}
