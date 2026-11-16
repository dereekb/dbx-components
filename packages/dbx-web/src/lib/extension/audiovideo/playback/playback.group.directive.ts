import { Directive, computed, effect, inject, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxAudioVideoPlaybackOverflowMode } from './playback';
import { DbxAudioVideoPlaybackStore } from './playback.store';

/**
 * Config for {@link DbxAudioVideoPlaybackGroupDirective}.
 */
export interface DbxAudioVideoPlaybackGroupConfig {
  /**
   * Number of media in the group allowed to play at the same time. Null or 0 or less means unlimited.
   *
   * Defaults to 1.
   */
  readonly maxPlaying?: Maybe<number>;
  /**
   * What to do when starting a media goes over the limit. Defaults to `pause_oldest`.
   */
  readonly overflowMode?: Maybe<DbxAudioVideoPlaybackOverflowMode>;
}

/**
 * Provides a scoped {@link DbxAudioVideoPlaybackStore} for the media inside it, so they are coordinated separately from the
 * app-wide store and can use their own playing limit and overflow mode.
 *
 * @dbxWebComponent
 * @dbxWebSlug audio-video-playback-group
 * @dbxWebCategory misc
 * @dbxWebKind directive
 * @dbxWebRelated audio-video-playback
 * @dbxWebMinimalExample ```html
 * <div dbxAudioVideoPlaybackGroup [maxPlaying]="2">
 *   <audio controls dbxAudioVideoPlayback src="/assets/a.mp3"></audio>
 *   <audio controls dbxAudioVideoPlayback src="/assets/b.mp3"></audio>
 *   <audio controls dbxAudioVideoPlayback src="/assets/c.mp3"></audio>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <div [dbxAudioVideoPlaybackGroup]="{ maxPlaying: 1, overflowMode: 'pause_newest' }" #group="dbxAudioVideoPlaybackGroup">
 *   <video controls dbxAudioVideoPlayback src="/assets/clip.mp4"></video>
 *   <button (click)="group.store.pauseAll()">Pause all</button>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxAudioVideoPlaybackGroup]',
  exportAs: 'dbxAudioVideoPlaybackGroup',
  providers: [DbxAudioVideoPlaybackStore],
  standalone: true
})
export class DbxAudioVideoPlaybackGroupDirective {
  readonly store = inject(DbxAudioVideoPlaybackStore, { self: true });

  readonly config = input<Maybe<DbxAudioVideoPlaybackGroupConfig>, Maybe<DbxAudioVideoPlaybackGroupConfig | ''>>(undefined, { alias: 'dbxAudioVideoPlaybackGroup', transform: (x) => (x === '' ? undefined : x) });
  readonly maxPlaying = input<Maybe<number>>();
  readonly overflowMode = input<Maybe<DbxAudioVideoPlaybackOverflowMode>>();

  readonly maxPlayingSignal = computed(() => {
    const config = this.config();
    const maxPlaying = this.maxPlaying();
    return maxPlaying === undefined ? config?.maxPlaying : maxPlaying;
  });

  readonly overflowModeSignal = computed(() => {
    const config = this.config();
    return this.overflowMode() ?? config?.overflowMode;
  });

  protected readonly _maxPlayingEffect = effect(() => {
    const maxPlaying = this.maxPlayingSignal();

    // undefined keeps the default limit; null explicitly means unlimited
    if (maxPlaying !== undefined) {
      this.store.setMaxPlaying(maxPlaying);
    }
  });

  protected readonly _overflowModeEffect = effect(() => {
    this.store.setOverflowMode(this.overflowModeSignal());
  });
}
