import { fileAcceptFunction, fileArrayAcceptMatchFunction, fileArrayAcceptMaxFiles } from './upload.accept';

describe('fileAcceptFunction()', () => {
  describe('function', () => {
    describe('scenario', () => {
      const testFiles = [
        { type: 'image/png', name: 'image.png' },
        { type: 'image/jpeg', name: 'image.jpg' },
        { type: 'application/pdf', name: 'document.pdf' }
      ];

      it('should handle the wildcard "*"', () => {
        const accept = '*';
        const acceptFunction = fileAcceptFunction(accept);

        const files = testFiles;

        const result = files.filter(acceptFunction);
        expect(result).toEqual(files);
      });

      it('should filter on image/*', () => {
        const accept = 'image/*';
        const acceptFunction = fileAcceptFunction(accept);

        const files = testFiles;

        const result = files.filter(acceptFunction);
        expect(result).toEqual([files[0], files[1]]);
      });

      it('should filter on .png', () => {
        const accept = '.png';
        const acceptFunction = fileAcceptFunction(accept);

        const files = testFiles;

        const result = files.filter(acceptFunction);
        expect(result).toEqual([files[0]]);
      });

      it('should filter on .png and image/jpeg', () => {
        const accept = '.png,image/jpeg';
        const acceptFunction = fileAcceptFunction(accept);

        const files = testFiles;

        const result = files.filter(acceptFunction);
        expect(result).toEqual([files[0], files[1]]);
      });

      it('should filter on .png and .pdf', () => {
        const accept = '.png,.pdf';
        const acceptFunction = fileAcceptFunction(accept);

        const files = testFiles;

        const result = files.filter(acceptFunction);
        expect(result).toEqual([files[0], files[2]]);
      });
    });
  });
});

function testFile(name: string, type: string): File {
  return new File(['x'], name, { type });
}

describe('fileArrayAcceptMaxFiles()', () => {
  it('should return 1 when multiple is false', () => {
    expect(fileArrayAcceptMaxFiles({ multiple: false, maxFiles: 4 })).toBe(1);
  });

  it('should return undefined when there is no limit', () => {
    expect(fileArrayAcceptMaxFiles({ multiple: true })).toBeUndefined();
    expect(fileArrayAcceptMaxFiles({})).toBeUndefined();
  });

  it('should return the limit when multiple is allowed', () => {
    expect(fileArrayAcceptMaxFiles({ multiple: true, maxFiles: 4 })).toBe(4);
  });

  it('should return 0 for a destination with no room left', () => {
    expect(fileArrayAcceptMaxFiles({ multiple: true, maxFiles: 0 })).toBe(0);
  });

  it('should clamp a negative limit to 0', () => {
    expect(fileArrayAcceptMaxFiles({ multiple: true, maxFiles: -3 })).toBe(0);
  });
});

describe('fileArrayAcceptMatchFunction()', () => {
  const files = [testFile('a.png', 'image/png'), testFile('b.png', 'image/png'), testFile('c.png', 'image/png'), testFile('d.pdf', 'application/pdf')];

  it('should accept every matching file when there is no limit', () => {
    const result = fileArrayAcceptMatchFunction({ accept: 'image/*' })(files);

    expect(result.accepted).toEqual([files[0], files[1], files[2]]);
    expect(result.rejected).toEqual([files[3]]);
    expect(result.maxFiles).toBeUndefined();
  });

  it('should reject the files past the limit rather than the whole selection', () => {
    const result = fileArrayAcceptMatchFunction({ accept: '*', maxFiles: 2 })(files);

    expect(result.maxFiles).toBe(2);
    expect(result.accepted).toEqual([files[0], files[1]]);
    expect(result.rejected).toEqual([files[2], files[3]]);
  });

  it('should apply the limit only to the files that passed the type filter', () => {
    const result = fileArrayAcceptMatchFunction({ accept: 'image/*', maxFiles: 2 })(files);

    expect(result.acceptedType).toEqual([files[0], files[1], files[2]]);
    expect(result.accepted).toEqual([files[0], files[1]]);
    expect(result.rejected).toEqual([files[3], files[2]]);
  });

  it('should accept nothing when the limit is 0', () => {
    const result = fileArrayAcceptMatchFunction({ accept: '*', maxFiles: 0 })(files);

    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual(files);
  });

  it('should ignore the limit while multiple is false', () => {
    const result = fileArrayAcceptMatchFunction({ accept: '*', multiple: false, maxFiles: 4 })(files);

    expect(result.maxFiles).toBe(1);
    expect(result.accepted).toEqual([files[0]]);
  });
});
