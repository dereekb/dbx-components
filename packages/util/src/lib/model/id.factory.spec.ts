import { sequentialIncrementingNumberStringModelIdFactory } from './id.factory';
import { NUMBER_STRING_DENCODER_64 } from '../string/dencoder';
import { padStartFunction } from '../string/transform';

describe('sequentialIncrementingNumberStringModelIdFactory()', () => {
  it('should create a factory', () => {
    const factory = sequentialIncrementingNumberStringModelIdFactory();
    expect(factory).toBeDefined();
  });

  describe('function', () => {
    describe('config', () => {
      describe('transform defined', () => {
        const factory = sequentialIncrementingNumberStringModelIdFactory({
          startAt: 4096 + 1,
          transform: padStartFunction(5, '0'),
          dencoder: NUMBER_STRING_DENCODER_64
        });

        it('should transform the id', () => {
          expect(factory()).toBe('00101'); // should be 5 digits padded
        });
      });

      describe('startAt defined', () => {
        const startAt = 100;

        const factory = sequentialIncrementingNumberStringModelIdFactory({
          dencoder: NUMBER_STRING_DENCODER_64,
          startAt
        });

        it('should generate the first id as the encoded startAt index value', () => {
          expect(factory()).toBe(NUMBER_STRING_DENCODER_64.encodeNumber(startAt));
          expect(factory()).toBe(NUMBER_STRING_DENCODER_64.encodeNumber(startAt + 1));
          expect(factory()).toBe(NUMBER_STRING_DENCODER_64.encodeNumber(startAt + 2));
        });
      });

      describe('currentIndex defined', () => {
        const currentIndex = 100;

        const factory = sequentialIncrementingNumberStringModelIdFactory({
          dencoder: NUMBER_STRING_DENCODER_64,
          currentIndex
        });

        it('should generate the first id as the encoded currentIndex index value + 1', () => {
          expect(factory()).toBe(NUMBER_STRING_DENCODER_64.encodeNumber(currentIndex + 1));
          expect(factory()).toBe(NUMBER_STRING_DENCODER_64.encodeNumber(currentIndex + 2));
          expect(factory()).toBe(NUMBER_STRING_DENCODER_64.encodeNumber(currentIndex + 3));
        });
      });
    });
  });
});
