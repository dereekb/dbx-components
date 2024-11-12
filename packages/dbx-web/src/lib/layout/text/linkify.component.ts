import { Component, Input, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, shareReplay } from 'rxjs';
import linkifyStr from 'linkify-string';
import { DomSanitizer } from '@angular/platform-browser';
import { Maybe } from '@dereekb/util';

/**
 * Used to "linkify" the input text.
 */
@Component({
  selector: 'dbx-linkify',
  template: `
    <span [innerHTML]="linkifiedBody$ | async"></span>
  `,
  host: {
    class: 'dbx-i dbx-linkify'
  }
})
export class DbxLinkifyComponent implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);

  private _text = new BehaviorSubject<Maybe<string>>(undefined);

  readonly linkifiedText$ = this._text.pipe(
    distinctUntilChanged(),
    map((x) =>
      x
        ? linkifyStr(x, {
            defaultProtocol: 'https',
            target: {
              url: '_blank'
            }
          })
        : undefined
    ),
    shareReplay(1)
  );

  readonly linkifiedBody$ = this.linkifiedText$.pipe(
    map((x) => {
      return x ? this.sanitizer.bypassSecurityTrustHtml(x) : undefined;
    }),
    shareReplay(1)
  );

  ngOnDestroy(): void {
    this._text.complete();
  }

  @Input()
  get text(): Maybe<string> {
    return this._text.value;
  }

  set text(text: Maybe<string>) {
    this._text.next(text);
  }
}
