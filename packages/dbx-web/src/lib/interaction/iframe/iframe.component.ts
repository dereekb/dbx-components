import { Component, viewChild, ElementRef, OnDestroy, ChangeDetectionStrategy, computed, inject, SecurityContext, output } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { asyncScheduler, combineLatest, delayWhen, map, Subject, switchMap, timer, startWith } from 'rxjs';
import { input } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export const DBX_IFRAME_COMPONENT_TEMPLATE = `<iframe #iframe src="about:blank" frameborder="0" [scrolling]="scrolling()" allow="autoplay"></iframe>`;

@Component({
  selector: 'dbx-iframe',
  template: DBX_IFRAME_COMPONENT_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxIframeComponent extends AbstractSubscriptionDirective implements OnDestroy {
  readonly sanitizer = inject(DomSanitizer);

  readonly iframeLocationChanged = output<ElementRef<HTMLIFrameElement>>();
  readonly iframe = viewChild<string, ElementRef<HTMLIFrameElement>>('iframe', { read: ElementRef });

  readonly scrolling = input<'auto' | 'no' | 'yes', 'auto' | 'no' | 'yes' | boolean>('no', { transform: (x) => (x == null ? 'no' : typeof x === 'string' ? x : x === true ? 'auto' : 'no') });

  readonly sanitizeUrl = input<boolean>(false);
  readonly contentUrl = input.required<Maybe<string | SafeResourceUrl>>();

  readonly contentUrlSignal = computed(() => {
    let url: Maybe<string | SafeResourceUrl> = this.contentUrl();
    const sanitizeUrl = this.sanitizeUrl();

    if (url && typeof url === 'string' && sanitizeUrl) {
      url = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    return url;
  });

  readonly iframe$ = toObservable(this.iframe);
  readonly contentUrl$ = toObservable(this.contentUrl);

  readonly retry = new Subject<void>();

  constructor() {
    super();
    this.sub = combineLatest([this.contentUrl$, this.iframe$])
      .pipe(
        // delay retries by 50ms
        switchMap((x) =>
          this.retry.pipe(
            startWith(undefined),
            delayWhen((_, i) => timer(i ? 50 : 0, asyncScheduler)),
            map(() => x)
          )
        )
      )
      .subscribe(([x, iframe]) => {
        const contentWindow = iframe?.nativeElement.contentWindow;

        if (contentWindow) {
          let url: Maybe<string> = undefined;

          if (x != null && typeof x !== 'string') {
            url = this.sanitizer.sanitize(SecurityContext.URL, x);
          } else {
            url = x;
          }

          contentWindow.location.replace(url ?? '');
        } else {
          this.retry.next(); // queue up another retry for setting the iframe value
        }
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.retry.complete();
  }
}
