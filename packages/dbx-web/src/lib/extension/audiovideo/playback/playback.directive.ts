import { DestroyRef, Directive, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type Maybe } from '@dereekb/util';
import { of, switchMap } from 'rxjs';
import { type DbxAudioVideoPlaybackId } from './playback';
import { type RegisterDbxAudioVideoPlaybackElementConfig, registerDbxAudioVideoPlaybackElement } from './playback.register';
import { DbxAudioVideoPlaybackStore } from './playback.store';

/**
 * Config for {@link DbxAudioVideoPlaybackDirective}.
 */
export type DbxAudioVideoPlaybackDirectiveConfig = Pick<RegisterDbxAudioVideoPlaybackElementConfig, 'id' | 'includeMuted'>;

/**
 * Registers an `<audio>` or `<video>` element with the nearest {@link DbxAudioVideoPlaybackStore}, so that starting it pauses
 * other media once the playing limit is reached (one at a time by default).
 *
 * Uses the app-wide store unless the element is inside a {@link DbxAudioVideoPlaybackGroupDirective}. Muted playback does not
 * count toward the limit unless `includeMuted` is set.
 *
 * @dbxWebComponent
 * @dbxWebSlug audio-video-playback
 * @dbxWebCategory misc
 * @dbxWebKind directive
 * @dbxWebRelated audio-video-playback-group, gallery
 * @dbxWebMinimalExample ```html
 * <audio controls dbxAudioVideoPlayback src="/assets/a.mp3"></audio>
 * ```
 *
 * @example
 * ```html
 * <video controls [dbxAudioVideoPlayback]="{ includeMuted: true }" #playback="dbxAudioVideoPlayback" src="/assets/clip.mp4"></video>
 * <span>{{ playback.isPlayingSignal() ? 'Playing' : 'Stopped' }}</span>
 * ```
 */
@Directive({
  selector: 'audio[dbxAudioVideoPlayback], video[dbxAudioVideoPlayback]',
  exportAs: 'dbxAudioVideoPlayback',
  standalone: true
})
export class DbxAudioVideoPlaybackDirective {
  readonly store = inject(DbxAudioVideoPlaybackStore);
  private readonly _element = inject<ElementRef<HTMLMediaElement>>(ElementRef).nativeElement;
  private readonly _destroyRef = inject(DestroyRef);

  readonly config = input<Maybe<DbxAudioVideoPlaybackDirectiveConfig>, Maybe<DbxAudioVideoPlaybackDirectiveConfig | ''>>(undefined, { alias: 'dbxAudioVideoPlayback', transform: (x) => (x === '' ? undefined : x) });

  private readonly _id = signal<Maybe<DbxAudioVideoPlaybackId>>(undefined);

  /**
   * Id the element is registered with.
   */
  readonly idSignal = this._id.asReadonly();

  /**
   * Whether the element is playing and counted by the store.
   */
  readonly isPlayingSignal = toSignal(toObservable(this._id).pipe(switchMap((id) => (id ? this.store.isIdPlaying$(id) : of(false)))), { initialValue: false });

  private readonly _configSignal = computed(
    () => {
      const config = this.config();
      return { id: config?.id, includeMuted: config?.includeMuted };
    },
    { equal: (a, b) => a.id === b.id && a.includeMuted === b.includeMuted }
  );

  protected readonly _registerEffect = effect((onCleanup) => {
    const config = this._configSignal();

    untracked(() => {
      const registration = registerDbxAudioVideoPlaybackElement(this._element, { ...config, store: this.store, destroyRef: this._destroyRef });
      this._id.set(registration.id);
      onCleanup(() => registration.destroy());
    });
  });

  /**
   * Pauses the element.
   */
  pause(): void {
    this._element.pause();
  }
}
