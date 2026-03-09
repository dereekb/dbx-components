import { bufferHasValidPdfMarkings } from './pdf';

describe('bufferHasValidPdfMarkings', () => {
  it('should return true for a buffer with valid PDF markers', () => {
    const content = '%PDF-1.4 some content %%EOF';
    const buffer = Buffer.from(content);
    expect(bufferHasValidPdfMarkings(buffer)).toBe(true);
  });

  it('should return false when %PDF- header is missing', () => {
    const content = 'some content %%EOF';
    const buffer = Buffer.from(content);
    expect(bufferHasValidPdfMarkings(buffer)).toBe(false);
  });

  it('should return false when %%EOF marker is missing', () => {
    const content = '%PDF-1.4 some content';
    const buffer = Buffer.from(content);
    expect(bufferHasValidPdfMarkings(buffer)).toBe(false);
  });

  it('should return false for an empty buffer', () => {
    const buffer = Buffer.from('');
    expect(bufferHasValidPdfMarkings(buffer)).toBe(false);
  });

  it('should return false when %PDF- is not at the start', () => {
    const content = 'prefix %PDF-1.4 some content %%EOF';
    const buffer = Buffer.from(content);
    expect(bufferHasValidPdfMarkings(buffer)).toBe(false);
  });
});
