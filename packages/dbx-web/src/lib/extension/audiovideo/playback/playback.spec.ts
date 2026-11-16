import { describe, expect, it } from 'vitest';
import { dbxAudioVideoPlaybackIdsToPause } from './playback';

describe('dbxAudioVideoPlaybackIdsToPause()', () => {
  it('should return nothing when within the limit', () => {
    expect(dbxAudioVideoPlaybackIdsToPause({ playing: ['a'], maxPlaying: 1, startedId: 'a' })).toEqual([]);
  });

  it('should return nothing when the limit is unlimited', () => {
    expect(dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b', 'c'], maxPlaying: undefined })).toEqual([]);
    expect(dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b', 'c'], maxPlaying: 0 })).toEqual([]);
    expect(dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b', 'c'], maxPlaying: -1 })).toEqual([]);
  });

  describe('pause_oldest', () => {
    it('should pause the oldest media', () => {
      expect(dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b'], maxPlaying: 1, startedId: 'b' })).toEqual(['a']);
    });

    it('should pause the oldest media other than the started one', () => {
      expect(dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b', 'c'], maxPlaying: 2, startedId: 'c' })).toEqual(['a']);
      expect(dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b', 'c'], maxPlaying: 1, startedId: 'c' })).toEqual(['a', 'b']);
    });

    it('should pause the oldest media when no media just started', () => {
      expect(dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b', 'c'], maxPlaying: 1 })).toEqual(['a', 'b']);
    });
  });

  describe('pause_newest', () => {
    it('should pause the started media', () => {
      expect(dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b'], maxPlaying: 1, startedId: 'b', overflowMode: 'pause_newest' })).toEqual(['b']);
    });

    it('should pause the newest media when no media just started', () => {
      expect(dbxAudioVideoPlaybackIdsToPause({ playing: ['a', 'b', 'c'], maxPlaying: 1, overflowMode: 'pause_newest' })).toEqual(['c', 'b']);
    });
  });
});
