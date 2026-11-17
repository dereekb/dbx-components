import { type Maybe } from '@dereekb/util';

/**
 * Unique identifier of a playback entry registered with a {@link DbxAudioVideoPlaybackStore}.
 */
export type DbxAudioVideoPlaybackId = string;

/**
 * Kind of media a playback entry plays.
 */
export type DbxAudioVideoPlaybackKind = 'audio' | 'video' | 'other';

/**
 * A playable media source registered with a {@link DbxAudioVideoPlaybackStore}.
 *
 * An `HTMLMediaElement` already has `pause()`, so an `<audio>`/`<video>` element or an imperative `new Audio()` can back a ref.
 */
export interface DbxAudioVideoPlaybackRef {
  readonly id: DbxAudioVideoPlaybackId;
  readonly kind: DbxAudioVideoPlaybackKind;
  /**
   * Pauses the media. Called by the store when the media goes over the playing limit.
   */
  pause(): void;
}

/**
 * Which of the other playing media to pause when starting a media would go over the playing limit.
 *
 * The media that just started always keeps playing, so the two modes only differ when more than one media may play at a time.
 *
 * - `pause_oldest`: the media that started earliest are paused.
 * - `pause_newest`: the media that started most recently are paused, so the earliest started media keep playing.
 */
export type DbxAudioVideoPlaybackOverflowMode = 'pause_oldest' | 'pause_newest';

/**
 * Default overflow mode.
 */
export const DEFAULT_DBX_AUDIO_VIDEO_PLAYBACK_OVERFLOW_MODE: DbxAudioVideoPlaybackOverflowMode = 'pause_oldest';

/**
 * Default number of media allowed to play at the same time.
 */
export const DEFAULT_DBX_AUDIO_VIDEO_PLAYBACK_MAX_PLAYING = 1;

/**
 * Input for {@link dbxAudioVideoPlaybackIdsToPause}.
 */
export interface DbxAudioVideoPlaybackIdsToPauseInput {
  /**
   * Ids of the playing media, in the order they started playing. Includes the media that just started, if any.
   */
  readonly playing: readonly DbxAudioVideoPlaybackId[];
  /**
   * Number of media allowed to play at the same time. Null/undefined or 0 or less means unlimited.
   */
  readonly maxPlaying: Maybe<number>;
  /**
   * Overflow mode. Defaults to {@link DEFAULT_DBX_AUDIO_VIDEO_PLAYBACK_OVERFLOW_MODE}.
   */
  readonly overflowMode?: Maybe<DbxAudioVideoPlaybackOverflowMode>;
  /**
   * Id of the media that just started playing, if any. This media is never paused.
   *
   * When not set, for example when the limit is lowered, the overflow mode picks from all playing media.
   */
  readonly startedId?: Maybe<DbxAudioVideoPlaybackId>;
}

/**
 * Returns the ids of the media to pause so that the number playing is within the limit.
 *
 * @param input - The playing media, limit and overflow mode.
 * @returns The ids to pause. Empty when the playing media are within the limit.
 *
 * @example
 * ```ts
 * dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b'], maxPlaying: 1, startedId: 'b' }); // ['a']
 * dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b', 'c'], maxPlaying: 2, startedId: 'c' }); // ['a']
 * dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b', 'c'], maxPlaying: 2, startedId: 'c', overflowMode: 'pause_newest' }); // ['b']
 * ```
 */
export function dbxAudioVideoPlaybackIdsToPause(input: DbxAudioVideoPlaybackIdsToPauseInput): DbxAudioVideoPlaybackId[] {
  const { playing, maxPlaying, overflowMode, startedId } = input;
  const overflowCount = maxPlaying != null && maxPlaying > 0 ? playing.length - maxPlaying : 0;
  let result: DbxAudioVideoPlaybackId[] = [];

  if (overflowCount > 0) {
    const mode = overflowMode ?? DEFAULT_DBX_AUDIO_VIDEO_PLAYBACK_OVERFLOW_MODE;

    // the limit is at least 1, so there are always enough other media to pause and the started media keeps playing
    const others = playing.filter((x) => x !== startedId);
    const ordered = mode === 'pause_oldest' ? others : others.toReversed();
    result = ordered.slice(0, overflowCount);
  }

  return result;
}
