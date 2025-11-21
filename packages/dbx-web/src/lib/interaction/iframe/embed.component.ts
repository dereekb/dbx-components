import { Component, viewChild, ElementRef, ChangeDetectionStrategy, computed, inject, SecurityContext, input } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { ContentTypeMimeType, Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'dbx-embed',
  template: `
    <span #root></span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxEmbedComponent extends AbstractSubscriptionDirective {
  readonly sanitizer = inject(DomSanitizer);

  readonly root = viewChild<string, ElementRef<HTMLSpanElement>>('root', { read: ElementRef });

  readonly sanitizeUrl = input<Maybe<boolean>>(false);
  readonly srcUrl = input.required<Maybe<string | SafeResourceUrl>>();
  readonly type = input<Maybe<ContentTypeMimeType | string>>();

  readonly srcUrlSignal = computed(() => {
    let url: Maybe<string | SafeResourceUrl> = this.srcUrl();
    const sanitizeUrl = this.sanitizeUrl();

    if (url && typeof url === 'string' && sanitizeUrl) {
      url = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    return url;
  });

  readonly root$ = toObservable(this.root);
  readonly srcUrl$ = toObservable(this.srcUrl);
  readonly type$ = toObservable(this.type);

  constructor() {
    super();
    this.sub = combineLatest([this.srcUrl$, this.root$, this.type$]).subscribe(([srcUrl, root, type]) => {
      const element = root?.nativeElement;

      if (element) {
        // remove all embeds from the element
        element?.childNodes.forEach((x) => element.removeChild(x));

        if (srcUrl) {
          // NOTE: We do this because of the following chromium behavior:
          // https://issues.chromium.org/issues/40508296
          //
          // Embed cannot have src change dynamically, so we create a new embed element each time the src changes.
          //
          const embed = document.createElement('embed');

          let url: Maybe<string> = undefined;

          if (srcUrl != null && typeof srcUrl !== 'string') {
            url = this.sanitizer.sanitize(SecurityContext.URL, srcUrl);
          } else {
            url = srcUrl;
          }

          embed.setAttribute('src', url ?? '');

          // only set the type if it is presented
          if (type) {
            embed.setAttribute('type', type);
          }

          element.appendChild(embed);
        }
      }
    });
  }
}
