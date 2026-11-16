import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { DEFAULT_DBX_AUDIO_VIDEO_PLAYBACK_MAX_PLAYING, DEFAULT_DBX_AUDIO_VIDEO_PLAYBACK_OVERFLOW_MODE, type DbxAudioVideoPlaybackId, dbxAudioVideoPlaybackIdsToPause, type DbxAudioVideoPlaybackOverflowMode, type DbxAudioVideoPlaybackRef } from './playback';

/**
 * State of a {@link DbxAudioVideoPlaybackStore}.
 */
export interface DbxAudioVideoPlaybackStoreState {
  /**
   * Number of media allowed to play at the same time. Null or 0 or less means unlimited.
   */
  readonly maxPlaying: Maybe<number>;
  readonly overflowMode: DbxAudioVideoPlaybackOverflowMode;
  /**
   * Registered media, keyed by id.
   */
  readonly entries: Map<DbxAudioVideoPlaybackId, DbxAudioVideoPlaybackRef>;
  /**
   * Ids of the playing media, in the order they started playing.
   */
  readonly playing: DbxAudioVideoPlaybackId[];
}

/**
 * Coordinates audio/video playback so that no more than a set number of media play at the same time (default 1).
 *
 * The root instance is the app-wide coordinator. {@link DbxAudioVideoPlaybackGroupDirective} provides a scoped instance for
 * the media inside it, so media resolve the nearest group first and otherwise use the app-wide store.
 *
 * Media are usually registered through {@link DbxAudioVideoPlaybackDirective} or {@link registerDbxAudioVideoPlaybackElement}.
 *
 * @example
 * ```ts
 * readonly playbackStore = inject(DbxAudioVideoPlaybackStore);
 * readonly playingCountSignal = this.playbackStore.playingCountSignal;
 *
 * pauseAll() {
 *   this.playbackStore.pauseAll();
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class DbxAudioVideoPlaybackStore extends ComponentStore<DbxAudioVideoPlaybackStoreState> {
  constructor() {
    super({ maxPlaying: DEFAULT_DBX_AUDIO_VIDEO_PLAYBACK_MAX_PLAYING, overflowMode: DEFAULT_DBX_AUDIO_VIDEO_PLAYBACK_OVERFLOW_MODE, entries: new Map(), playing: [] });
  }

  // MARK: Accessors
  readonly maxPlaying$: Observable<Maybe<number>> = this.select((x) => x.maxPlaying);
  readonly overflowMode$: Observable<DbxAudioVideoPlaybackOverflowMode> = this.select((x) => x.overflowMode);
  readonly playing$: Observable<DbxAudioVideoPlaybackId[]> = this.select((x) => x.playing);
  readonly playingCount$: Observable<number> = this.select((x) => x.playing.length);
  readonly isPlaying$: Observable<boolean> = this.select((x) => x.playing.length > 0);
  readonly registeredCount$: Observable<number> = this.select((x) => x.entries.size);

  readonly maxPlayingSignal = this.selectSignal((x) => x.maxPlaying);
  readonly overflowModeSignal = this.selectSignal((x) => x.overflowMode);
  readonly playingSignal = this.selectSignal((x) => x.playing);
  readonly playingCountSignal = this.selectSignal((x) => x.playing.length);
  readonly isPlayingSignal = this.selectSignal((x) => x.playing.length > 0);
  readonly registeredCountSignal = this.selectSignal((x) => x.entries.size);

  /**
   * Returns an observable of whether the media with the given id is playing.
   *
   * @param id - The media id.
   * @returns Observable that emits true while the media is playing.
   */
  isIdPlaying$(id: DbxAudioVideoPlaybackId): Observable<boolean> {
    return this.select((x) => x.playing.includes(id));
  }

  // MARK: Registration
  /**
   * Registers the media. Replaces any media registered with the same id.
   */
  readonly register = this.updater((state, ref: DbxAudioVideoPlaybackRef) => {
    const entries = new Map(state.entries);
    entries.set(ref.id, ref);
    return { ...state, entries };
  });

  /**
   * Unregisters the media and removes it from the playing media.
   */
  readonly unregister = this.updater((state, id: DbxAudioVideoPlaybackId) => {
    const entries = new Map(state.entries);
    entries.delete(id);
    return { ...state, entries, playing: state.playing.filter((x) => x !== id) };
  });

  // MARK: Playback
  /**
   * Marks the media as playing, then pauses media to stay within the playing limit.
   *
   * @param id - The id of the media that started playing.
   */
  notifyPlaying(id: DbxAudioVideoPlaybackId): void {
    const { playing } = this.get();

    if (!playing.includes(id)) {
      this._setPlaying([...playing, id]);
    }

    this._enforceMaxPlaying(id);
  }

  /**
   * Marks the media as no longer playing.
   *
   * @param id - The id of the media that stopped playing.
   */
  notifyStopped(id: DbxAudioVideoPlaybackId): void {
    const { playing } = this.get();

    if (playing.includes(id)) {
      this._setPlaying(playing.filter((x) => x !== id));
    }
  }

  /**
   * Pauses the media with the given id.
   *
   * @param id - The media id.
   */
  pause(id: DbxAudioVideoPlaybackId): void {
    this._pauseIds([id]);
  }

  /**
   * Pauses all playing media.
   */
  pauseAll(): void {
    this._pauseIds([...this.get().playing]);
  }

  /**
   * Sets the number of media allowed to play at the same time, and pauses media that are now over the limit.
   *
   * @param maxPlaying - The limit. Null or 0 or less means unlimited.
   */
  setMaxPlaying(maxPlaying: Maybe<number>): void {
    this.patchState({ maxPlaying });
    this._enforceMaxPlaying();
  }

  /**
   * Sets the overflow mode.
   *
   * @param overflowMode - The overflow mode. Defaults to {@link DEFAULT_DBX_AUDIO_VIDEO_PLAYBACK_OVERFLOW_MODE} when null.
   */
  setOverflowMode(overflowMode: Maybe<DbxAudioVideoPlaybackOverflowMode>): void {
    this.patchState({ overflowMode: overflowMode ?? DEFAULT_DBX_AUDIO_VIDEO_PLAYBACK_OVERFLOW_MODE });
  }

  // MARK: Internal
  private _setPlaying(playing: DbxAudioVideoPlaybackId[]): void {
    this.patchState({ playing });
  }

  private _enforceMaxPlaying(startedId?: Maybe<DbxAudioVideoPlaybackId>): void {
    const { playing, maxPlaying, overflowMode } = this.get();
    const idsToPause = dbxAudioVideoPlaybackIdsToPause({ playing, maxPlaying, overflowMode, startedId });

    if (idsToPause.length > 0) {
      this._pauseIds(idsToPause);
    }
  }

  /**
   * Removes the ids from the playing media first, then calls pause() on each one. Media that are paused emit their own pause
   * event afterwards, which is ignored since the id is no longer playing.
   *
   * @param ids - The media ids to pause.
   */
  private _pauseIds(ids: DbxAudioVideoPlaybackId[]): void {
    const { playing, entries } = this.get();
    const idsSet = new Set(ids);
    this._setPlaying(playing.filter((x) => !idsSet.has(x)));

    ids.forEach((id) => {
      entries.get(id)?.pause();
    });
  }
}
