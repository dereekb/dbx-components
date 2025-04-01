import { ChangeDetectionStrategy, Component, Input, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, shareReplay } from 'rxjs';
import linkifyStr from 'linkify-string';
import { DomSanitizer } from '@angular/platform-browser';
import { type Maybe } from '@dereekb/util';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Used to "linkify" the input text.
 */
@Component({
  selector: 'dbx-linkify',
  template: `
    <span [innerHTML]="linkifiedBodySignal()"></span>
  `,
  host: {
    class: 'dbx-i dbx-linkify'
  },
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxLinkifyComponent implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly _text = new BehaviorSubject<Maybe<string>>(undefined);

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

  readonly linkifiedBodySignal = toSignal(this.linkifiedBody$);

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
