import { fileAcceptFunction } from './upload.accept';

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
