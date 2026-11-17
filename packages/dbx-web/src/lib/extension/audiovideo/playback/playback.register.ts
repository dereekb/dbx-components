import { DestroyRef, inject } from '@angular/core';
import { type DestroyFunction, type Maybe } from '@dereekb/util';
import { type DbxAudioVideoPlaybackId, type DbxAudioVideoPlaybackKind } from './playback';
import { DbxAudioVideoPlaybackStore } from './playback.store';

let dbxAudioVideoPlaybackIdCounter = 0;

/**
 * Creates a new unique playback id.
 *
 * @returns A unique id.
 */
export function makeDbxAudioVideoPlaybackId(): DbxAudioVideoPlaybackId {
  dbxAudioVideoPlaybackIdCounter += 1;
  return `dbx_av_${dbxAudioVideoPlaybackIdCounter}`;
}

/**
 * Config for {@link registerDbxAudioVideoPlaybackElement}.
 */
export interface RegisterDbxAudioVideoPlaybackElementConfig {
  /**
   * Id to register the media with. A unique id is made when not set.
   */
  readonly id?: Maybe<DbxAudioVideoPlaybackId>;
  /**
   * Kind of media. Read from the element's tag name when not set.
   */
  readonly kind?: Maybe<DbxAudioVideoPlaybackKind>;
  /**
   * Whether muted playback counts toward the playing limit (and pauses other media).
   *
   * Defaults to false, so a muted autoplaying preview clip does not interrupt other media.
   */
  readonly includeMuted?: Maybe<boolean>;
  /**
   * Store to register with. Defaults to the nearest injected {@link DbxAudioVideoPlaybackStore}.
   */
  readonly store?: Maybe<DbxAudioVideoPlaybackStore>;
  /**
   * DestroyRef to unregister on. Defaults to the injected DestroyRef.
   */
  readonly destroyRef?: Maybe<DestroyRef>;
}

/**
 * Result of {@link registerDbxAudioVideoPlaybackElement}.
 */
export interface DbxAudioVideoPlaybackElementRegistration {
  readonly id: DbxAudioVideoPlaybackId;
  readonly store: DbxAudioVideoPlaybackStore;
  /**
   * Unregisters the element and removes its event listeners. Also called when the DestroyRef is destroyed.
   */
  readonly destroy: DestroyFunction;
}

/**
 * Registers a media element with the nearest {@link DbxAudioVideoPlaybackStore} so its playback is coordinated with other media.
 *
 * Listens to the element's `play`, `pause`, `ended`, `emptied` and `volumechange` events. Muted playback does not count
 * toward the playing limit unless `includeMuted` is true. Unregisters when the DestroyRef is destroyed.
 *
 * Must be called in an injection context unless both `store` and `destroyRef` are provided.
 *
 * @param element - The media element. Works with `<audio>`, `<video>` and `new Audio()`.
 * @param config - Optional config.
 * @returns The registration.
 *
 * @example
 * ```ts
 * readonly audio = new Audio('/assets/sound.mp3');
 * readonly registration = registerDbxAudioVideoPlaybackElement(this.audio);
 * ```
 */
export function registerDbxAudioVideoPlaybackElement(element: HTMLMediaElement, config?: Maybe<RegisterDbxAudioVideoPlaybackElementConfig>): DbxAudioVideoPlaybackElementRegistration {
  const store = config?.store ?? inject(DbxAudioVideoPlaybackStore);
  const destroyRef = config?.destroyRef ?? inject(DestroyRef);
  const includeMuted = config?.includeMuted ?? false;
  const id = config?.id ?? makeDbxAudioVideoPlaybackId();
  const kind = config?.kind ?? (element.tagName?.toLowerCase() === 'video' ? 'video' : 'audio');

  store.register({ id, kind, pause: () => element.pause() });

  const updatePlaying = () => {
    const isCounted = !element.paused && !element.ended && (includeMuted || !element.muted);

    if (isCounted) {
      store.notifyPlaying(id);
    } else {
      store.notifyStopped(id);
    }
  };

  const onStopped = () => store.notifyStopped(id);

  element.addEventListener('play', updatePlaying);
  element.addEventListener('volumechange', updatePlaying);
  element.addEventListener('pause', onStopped);
  element.addEventListener('ended', onStopped);
  element.addEventListener('emptied', onStopped);

  let destroyed = false;

  const destroy = () => {
    if (!destroyed) {
      destroyed = true;
      element.removeEventListener('play', updatePlaying);
      element.removeEventListener('volumechange', updatePlaying);
      element.removeEventListener('pause', onStopped);
      element.removeEventListener('ended', onStopped);
      element.removeEventListener('emptied', onStopped);
      store.unregister(id);
    }
  };

  destroyRef.onDestroy(destroy);

  return { id, store, destroy };
}
