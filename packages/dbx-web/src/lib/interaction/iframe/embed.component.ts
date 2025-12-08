import { Component, viewChild, ElementRef, ChangeDetectionStrategy, computed, inject, SecurityContext, effect, signal, OnDestroy, model } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, throttleTime } from 'rxjs';
import { ContentTypeMimeType, Maybe } from '@dereekb/util';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { browserObjectUrlRef } from '@dereekb/browser';

export type DbxEmbedComponentElement = 'embed' | 'img';

@Component({
  selector: 'dbx-embed',
  template: `
    <span #root></span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxEmbedComponent extends AbstractSubscriptionDirective implements OnDestroy {
  private readonly _browserObjectUrlRef = browserObjectUrlRef();

  readonly sanitizer = inject(DomSanitizer);

  readonly root = viewChild<string, ElementRef<HTMLSpanElement>>('root', { read: ElementRef });

  /**
   * The element to embed. Can be either embed or img. If not provided, will be determined by the input mimetype.
   *
   * If set to 'embed', the embed element will be used.
   * If set to 'img', the img element will be used.
   */
  readonly embedElement = model<Maybe<DbxEmbedComponentElement>>();

  readonly sanitizeUrl = model<Maybe<boolean>>();

  readonly srcUrl = model<Maybe<string | SafeResourceUrl>>();
  readonly type = model<Maybe<ContentTypeMimeType | string>>();

  /**
   * The input blob or media source to use.
   *
   * If set, the srcUrl will be updated with the browser object URL.
   */
  readonly blob = model<Maybe<Blob>>();

  readonly srcUrlFromBlob = signal<Maybe<string>>(undefined);
  readonly typeFromBlob = signal<Maybe<string>>(undefined);

  readonly blobEffect = effect(
    () => {
      const blob = this.blob();
      this.srcUrlFromBlob.set(this._browserObjectUrlRef.createBrowserUrl(blob));
      this.typeFromBlob.set(blob?.type);
    },
    {
      allowSignalWrites: true
    }
  );

  readonly srcUrlSignal = computed(() => {
    const srcUrl = this.srcUrl();
    const srcUrlFromBlob = this.srcUrlFromBlob();

    const baseUrl = srcUrl ?? srcUrlFromBlob;

    let url: Maybe<string | SafeResourceUrl> = baseUrl;
    const sanitizeUrl = this.sanitizeUrl();

    if (url && typeof url === 'string' && sanitizeUrl) {
      url = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    return url;
  });

  readonly typeSignal = computed(() => {
    const type = this.type();
    const typeFromBlob = this.typeFromBlob();
    return type ?? typeFromBlob;
  });

  readonly root$ = toObservable(this.root);
  readonly srcUrl$ = toObservable(this.srcUrlSignal);
  readonly type$ = toObservable(this.typeSignal);
  readonly embedElementName$ = toObservable(this.embedElement);

  constructor() {
    super();
    this.sub = combineLatest([this.srcUrl$, this.root$, this.type$, this.embedElementName$])
      .pipe(throttleTime(100, undefined, { leading: true, trailing: true }))
      .subscribe(([srcUrl, root, type, forceEmbedElementName]) => {
        const element = root?.nativeElement;

        if (element) {
          // remove all embeds from the element
          element?.childNodes.forEach((x) => element.removeChild(x));

          if (srcUrl) {
            const isImageType = type?.startsWith('image/');
            const embedElementName = forceEmbedElementName ?? (isImageType ? 'img' : 'embed');

            // NOTE: We do this because of the following chromium behavior:
            // https://issues.chromium.org/issues/40508296
            //
            // Embed cannot have src change dynamically, so we create a new embed element each time the src changes.
            //
            const embed = document.createElement(embedElementName);

            let url: Maybe<string> = undefined;

            if (srcUrl != null && typeof srcUrl !== 'string') {
              url = this.sanitizer.sanitize(SecurityContext.URL, srcUrl);
            } else {
              url = srcUrl;
            }

            // both embed and img use src
            embed.setAttribute('src', url ?? '');

            // if the type is an image, add the embed class
            if (isImageType) {
              embed.setAttribute('class', 'embed embed-img');
            } else {
              embed.setAttribute('class', 'embed');
            }

            switch (embedElementName) {
              case 'embed':
                // only set the type if it is presented
                if (type) {
                  embed.setAttribute('type', type);
                }
                break;
            }

            element.appendChild(embed);
          }
        }
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._browserObjectUrlRef.destroy();
  }
}
