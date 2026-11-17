import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { type DbxAudioVideoPlaybackRef } from './playback';
import { registerDbxAudioVideoPlaybackElement } from './playback.register';
import { DbxAudioVideoPlaybackStore } from './playback.store';

interface FakePlaybackRef extends DbxAudioVideoPlaybackRef {
  readonly pause: Mock<() => void>;
}

function makeFakeRef(id: string): FakePlaybackRef {
  return { id, kind: 'audio', pause: vi.fn<() => void>() };
}

describe('DbxAudioVideoPlaybackStore', () => {
  let store: DbxAudioVideoPlaybackStore;
  let a: FakePlaybackRef;
  let b: FakePlaybackRef;
  let c: FakePlaybackRef;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DbxAudioVideoPlaybackStore] });
    store = TestBed.inject(DbxAudioVideoPlaybackStore);
    a = makeFakeRef('a');
    b = makeFakeRef('b');
    c = makeFakeRef('c');
    store.register(a);
    store.register(b);
    store.register(c);
  });

  it('should register the refs', () => {
    expect(store.registeredCountSignal()).toBe(3);
  });

  it('should default to one playing media', () => {
    expect(store.maxPlayingSignal()).toBe(1);
  });

  it('should pause the oldest media when another starts', () => {
    store.notifyPlaying('a');
    store.notifyPlaying('b');

    expect(a.pause).toHaveBeenCalledTimes(1);
    expect(b.pause).not.toHaveBeenCalled();
    expect(store.playingSignal()).toEqual(['b']);
  });

  it('should keep the started media playing in pause_newest mode', () => {
    store.setOverflowMode('pause_newest');
    store.notifyPlaying('a');
    store.notifyPlaying('b');

    expect(a.pause).toHaveBeenCalledTimes(1);
    expect(b.pause).not.toHaveBeenCalled();
    expect(store.playingSignal()).toEqual(['b']);
  });

  it('should pause the newest other media in pause_newest mode', () => {
    store.setOverflowMode('pause_newest');
    store.setMaxPlaying(2);
    store.notifyPlaying('a');
    store.notifyPlaying('b');
    store.notifyPlaying('c');

    expect(a.pause).not.toHaveBeenCalled();
    expect(b.pause).toHaveBeenCalledTimes(1);
    expect(c.pause).not.toHaveBeenCalled();
    expect(store.playingSignal()).toEqual(['a', 'c']);
  });

  it('should allow up to maxPlaying media', () => {
    store.setMaxPlaying(2);
    store.notifyPlaying('a');
    store.notifyPlaying('b');

    expect(store.playingCountSignal()).toBe(2);

    store.notifyPlaying('c');

    expect(a.pause).toHaveBeenCalledTimes(1);
    expect(store.playingSignal()).toEqual(['b', 'c']);
  });

  it('should pause extra media when maxPlaying is lowered', () => {
    store.setMaxPlaying(3);
    store.notifyPlaying('a');
    store.notifyPlaying('b');
    store.notifyPlaying('c');
    store.setMaxPlaying(1);

    expect(a.pause).toHaveBeenCalledTimes(1);
    expect(b.pause).toHaveBeenCalledTimes(1);
    expect(store.playingSignal()).toEqual(['c']);
  });

  it('should not limit playback when maxPlaying is null', () => {
    store.setMaxPlaying(null);
    store.notifyPlaying('a');
    store.notifyPlaying('b');
    store.notifyPlaying('c');

    expect(store.playingCountSignal()).toBe(3);
  });

  it('should remove stopped media from playing', () => {
    store.notifyPlaying('a');
    store.notifyStopped('a');
    expect(store.isPlayingSignal()).toBe(false);
  });

  it('should pause all media', () => {
    store.setMaxPlaying(3);
    store.notifyPlaying('a');
    store.notifyPlaying('b');
    store.pauseAll();

    expect(a.pause).toHaveBeenCalledTimes(1);
    expect(b.pause).toHaveBeenCalledTimes(1);
    expect(store.playingCountSignal()).toBe(0);
  });

  it('should remove unregistered media from playing', () => {
    store.notifyPlaying('a');
    store.unregister('a');
    expect(store.playingCountSignal()).toBe(0);
    expect(store.registeredCountSignal()).toBe(2);
  });

  describe('registerDbxAudioVideoPlaybackElement()', () => {
    function makeAudioElement(): HTMLAudioElement {
      const element = document.createElement('audio');
      let paused = true;
      Object.defineProperty(element, 'paused', { get: () => paused });
      vi.spyOn(element, 'pause').mockImplementation(() => {
        paused = true;
        element.dispatchEvent(new Event('pause'));
      });
      (element as unknown as { fakePlay: () => void }).fakePlay = () => {
        paused = false;
        element.dispatchEvent(new Event('play'));
      };
      return element;
    }

    function fakePlay(element: HTMLAudioElement) {
      (element as unknown as { fakePlay: () => void }).fakePlay();
    }

    function register(element: HTMLAudioElement, includeMuted?: boolean) {
      return TestBed.runInInjectionContext(() => registerDbxAudioVideoPlaybackElement(element, { store, includeMuted, destroyRef: TestBed.inject(DestroyRef) }));
    }

    it('should pause the first element when the second plays', () => {
      const first = makeAudioElement();
      const second = makeAudioElement();
      register(first);
      register(second);

      fakePlay(first);
      fakePlay(second);

      expect(first.pause).toHaveBeenCalledTimes(1);
      expect(second.paused).toBe(false);
      expect(store.playingCountSignal()).toBe(1);
    });

    it('should not count muted playback', () => {
      const first = makeAudioElement();
      const muted = makeAudioElement();
      muted.muted = true;
      register(first);
      register(muted);

      fakePlay(first);
      fakePlay(muted);

      expect(first.pause).not.toHaveBeenCalled();
      expect(muted.pause).not.toHaveBeenCalled();
      expect(store.playingCountSignal()).toBe(1);
    });

    it('should count muted playback when includeMuted is true', () => {
      const first = makeAudioElement();
      const muted = makeAudioElement();
      muted.muted = true;
      register(first);
      register(muted, true);

      fakePlay(first);
      fakePlay(muted);

      expect(first.pause).toHaveBeenCalledTimes(1);
    });

    it('should count playback when a muted element is unmuted', () => {
      const first = makeAudioElement();
      const muted = makeAudioElement();
      muted.muted = true;
      register(first);
      register(muted);

      fakePlay(first);
      fakePlay(muted);
      muted.muted = false;
      muted.dispatchEvent(new Event('volumechange'));

      expect(first.pause).toHaveBeenCalledTimes(1);
      expect(store.playingCountSignal()).toBe(1);
    });

    it('should unregister when destroyed', () => {
      const first = makeAudioElement();
      const registration = register(first);
      registration.destroy();
      expect(store.registeredCountSignal()).toBe(3);
    });
  });
});
