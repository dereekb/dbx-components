import { replaceInvalidFilePathTypeSeparatorsInSlashPath, slashPathFactory, slashPathName, slashPathValidationFactory, type SlashPathFolder, slashPathType, type SlashPathTypedFile, type SlashPathFile, SLASH_PATH_SEPARATOR, isolateSlashPathFunction, removeTrailingFileTypeSeparators, removeTrailingSlashes, slashPathDetails, slashPathSubPathMatcher, slashPathFolderFactory, slashPathPathMatcher, DEFAULT_SLASH_PATH_PATH_MATCHER_NON_MATCHING_FILL_VALUE } from './path';

describe('slashPathName', () => {
  it('should return the file name', () => {
    const expected = 'test.txt';
    const result = slashPathName('/a/b/c/d/' + expected);
    expect(result).toBe(expected);
  });

  it('should return the folder name', () => {
    const expected = 'test';
    const result = slashPathName('/a/b/c/d/' + expected + '/');
    expect(result).toBe(expected);
  });
});

describe('slashPathType', () => {
  it('files with more than 1 dot should return invalid', () => {
    const typedFilePath: SlashPathTypedFile = 'wMNzlhSlp6Gb93.V8u.4.Rs/CCCC_KGML3FKTP.pdf.tmp';
    const type = slashPathType(typedFilePath);
    expect(type).toBe('invalid');
  });

  it('should identify a typed file', () => {
    const typedFilePath: SlashPathTypedFile = 'wMNzlhSlp6Gb93V8u4Rs/CCCC_KGML3FKTP.pdf';
    const type = slashPathType(typedFilePath);
    expect(type).toBe('typedfile');
  });

  it('should identify a file', () => {
    const path: SlashPathFile = 'wMNzlhSlp6Gb93V8u4Rs/CCCC_KGML3FKTP';
    const type = slashPathType(path);
    expect(type).toBe('file');
  });

  it('should identify a folder', () => {
    const folderPath: SlashPathFolder = 'wMNzlhSlp6Gb93V8u4Rs/';
    const type = slashPathType(folderPath);
    expect(type).toBe('folder');
  });
});

describe('slashPathFolderFactory()', () => {
  describe('instance', () => {
    const factory = slashPathFolderFactory();

    it('should return the empty relative folder for the input typed file', () => {
      const file = `d.txt`;

      const result = factory(file);
      expect(result).toBe('');
    });

    it('should return the root folder for the input typed file', () => {
      const file = `/d.txt`;

      const result = factory(file);
      expect(result).toBe('/');
    });

    it('should return the folder for the input typed file', () => {
      const folder = `a/b/c/`;
      const file = `${folder}d.txt`;

      const result = factory(file);
      expect(result).toBe(folder);
    });

    it('should return the absolute path folder for the input typed file', () => {
      const folder = `/a/b/c/`;
      const file = `${folder}d.txt`;

      const result = factory(file);
      expect(result).toBe(folder);
    });

    it('should return the folder for the input untyped file', () => {
      const folder = `a/b/c/`;
      const untypedFile = `${folder}d`;

      const result = factory(untypedFile);
      expect(result).toBe(folder);
    });

    it('should return the folder for the input folder', () => {
      const folderBasePath = `a/b/c/`;
      const folderPath = `${folderBasePath}d/`; // ends with slash, is a folder

      const result = factory(folderPath);
      expect(result).toBe(folderPath);
    });

    it('should return the folder for the input folder without trailing slash', () => {
      const folderBasePath = `a/b/c/`;
      const folderPath = `${folderBasePath}d`; // is considered an untyped file

      const result = factory(folderPath);
      expect(result).toBe(folderBasePath);
    });

    it('should return the folder for the input file with multiple dots', () => {
      const folder = `a/b/c/`;
      const untypedFile = `${folder}d.test.tests.test`;

      const result = factory(untypedFile);
      expect(result).toBe(folder);
    });

    it('should return the fixed folder for the input folder with illegal characters', () => {
      const folder = `a.a.a.a/b.b.b/.c.c.c/`;
      const untypedFile = `${folder}d.txt`;

      const result = factory(untypedFile);
      const expected = `${folder.replaceAll('.', '_')}`;

      expect(result).toBe(expected);
    });

    describe('treatUntypedFilesAsFolders=true', () => {
      const factory = slashPathFolderFactory({ treatUntypedFilesAsFolders: true });

      it('should treat the untyped file as a folder', () => {
        const folder = `a/b/c/`;
        const untypedFilePath = `${folder}d`;

        const result = factory(untypedFilePath);
        expect(result).toBe(`${untypedFilePath}/`);
      });

      describe('startType=absolute', () => {
        const factory = slashPathFolderFactory({ startType: 'absolute', treatUntypedFilesAsFolders: true });

        it('should return a valid absolute folder path', () => {
          const folder = 'wMNzlhSlp6Gb93V8u4Rs';
          const result = factory(folder);
          expect(result).toBe(`/${folder}/`);
        });
      });

      describe('startType=relative', () => {
        const factory = slashPathFolderFactory({ startType: 'relative', treatUntypedFilesAsFolders: true });

        it('should return a valid relative folder path', () => {
          const folder = 'wMNzlhSlp6Gb93V8u4Rs';
          const result = factory(`/${folder}`);
          expect(result).toBe(`${folder}/`);
        });
      });
    });
  });
});

describe('removeTrailingSlashes()', () => {
  it('should remove all trailing slashes', () => {
    const folderName = 'wMNzlhSlp6Gb93V8u4Rs';
    const folderPath: SlashPathFolder = `${folderName}/`;
    const result = removeTrailingSlashes(folderPath);
    expect(result).toBe(folderName);
  });

  it('should remove all trailing slashes from a url', () => {
    const url = 'https://components.dereekb.com';
    const urlPath = `${url}/`;
    const result = removeTrailingSlashes(urlPath);
    expect(result).toBe(url);
  });
});

describe('removeTrailingFileTypeSeparators()', () => {
  it('should remove the trailing file type separator (".")', () => {
    const filename = 'filename';
    const typedFilePath: SlashPathTypedFile = `${filename}.`;

    const result = removeTrailingFileTypeSeparators(typedFilePath);
    expect(result).toBe(filename);
  });

  it('should not remove the trailing file type.', () => {
    const filename = 'filename';
    const typedFilePath: SlashPathTypedFile = `${filename}.pdf`;

    const result = removeTrailingFileTypeSeparators(typedFilePath);
    expect(result).toBe(typedFilePath);
  });
});

describe('replaceInvalidFilePathTypeSeparatorsInSlashPath()', () => {
  it('should replace all extra file path type separators', () => {
    const value = '/path/to/file.who.thought.about.it.test.png';
    const expectedValue = '/path/to/file_who_thought_about_it_test.png';

    const result = replaceInvalidFilePathTypeSeparatorsInSlashPath(value);
    expect(result).toBe(expectedValue);
  });

  it('should ignore any trailing file path separators.', () => {
    const expectedValue = '/path/to/file.test';
    const value = expectedValue + '.';

    const result = replaceInvalidFilePathTypeSeparatorsInSlashPath(value);
    expect(result).toBe(expectedValue);
  });

  it('should convert any file path separators before a slash.', () => {
    const expectedValue = '/path/to/file_test/';
    const value = '/path/to/file.test/';

    const result = replaceInvalidFilePathTypeSeparatorsInSlashPath(value);
    expect(result).toBe(expectedValue);
  });
});

describe('slashPathValidationFactory()', () => {
  describe('function', () => {
    const validator = slashPathValidationFactory();

    it('should fix the input slashpath', () => {
      const value = '/path/to/file.who.thought.about.it.test.png';
      const expectedValue = '/path/to/file_who_thought_about_it_test.png';

      const result = validator(value);
      expect(result).toBe(expectedValue);
    });

    it('should replace the illegal slash path characters', () => {
      const value = '/path/#/to/**my**[beta]?.png';
      const expectedValue = '/path/_/to/__my___beta__.png';

      const result = validator(value);
      expect(result).toBe(expectedValue);
    });
  });
});

describe('slashPathFactory', () => {
  describe('function', () => {
    const slashPathFn = slashPathFactory();

    it('should merge two paths together.', () => {
      const result = slashPathFn(['test/', 'hello.png']);
      expect(result).toBe('test/hello.png');
    });

    describe('with absolute start type', () => {
      const slashPathAbsoluteStartType = slashPathFactory({
        startType: 'absolute'
      });

      it('should merge two paths together.', () => {
        const result = slashPathAbsoluteStartType(['test/', 'hello.png']);
        expect(result).toBe('/test/hello.png');
      });
    });

    describe('with base path', () => {
      const slashPathWithBasePathFn = slashPathFactory({
        basePath: '/test/'
      });

      it('should append the input with the base path', () => {
        const result = slashPathWithBasePathFn('hello.png');
        expect(result).toBe('/test/hello.png');
      });
    });
  });
});

describe('isolateSlashPathFunction', () => {
  describe('function', () => {
    it('should isolate the input path range.', () => {
      const parts = ['a', 'b', 'c', 'd', 'e'];
      const path = parts.join(SLASH_PATH_SEPARATOR);

      const result = isolateSlashPathFunction({ range: { minIndex: 2, maxIndex: 4 } })(path);
      expect(result).toBe('c/d/');
    });

    it('should retain the file ending', () => {
      const parts = ['a', 'b', 'c', 'd', 'e.e'];
      const path = parts.join(SLASH_PATH_SEPARATOR);

      const result = isolateSlashPathFunction({ range: { minIndex: 2, maxIndex: parts.length } })(path);
      expect(result).toBe('c/d/e.e');
    });

    it('should retain the file ending', () => {
      const parts = ['a', 'b', 'c', 'd', 'e'];
      const path = parts.join(SLASH_PATH_SEPARATOR);

      const result = isolateSlashPathFunction({ range: { minIndex: 2, maxIndex: parts.length } })(path);
      expect(result).toBe('c/d/e');
    });

    it('should retain the folder ending', () => {
      const parts = ['a', 'b', 'c', 'd', 'e/'];
      const path = parts.join(SLASH_PATH_SEPARATOR);

      const result = isolateSlashPathFunction({ range: { minIndex: 2, maxIndex: parts.length } })(path);
      expect(result).toBe('c/d/e/');
    });

    it('should retain the absolute path prefix', () => {
      const parts = ['/a', 'b', 'c', 'd', 'e'];
      const path = parts.join(SLASH_PATH_SEPARATOR);

      const result = isolateSlashPathFunction({ range: { minIndex: 2, maxIndex: parts.length } })(path);
      expect(result).toBe('/c/d/e');
    });

    it('should retain the absolute path prefix and folder ending', () => {
      const parts = ['/a', 'b', 'c', 'd', 'e/'];
      const path = parts.join(SLASH_PATH_SEPARATOR);

      const result = isolateSlashPathFunction({ range: { minIndex: 2, maxIndex: parts.length } })(path);
      expect(result).toBe('/c/d/e/');
    });
  });
});

describe('slashPathDetails()', () => {
  it('should return the details of the path', () => {
    const folder = '/a/b/c/'; // absolute path
    const file = 'd.e';
    const path = `${folder}${file}`;
    const details = slashPathDetails(path);

    expect(details.type).toBe('typedfile');
    expect(details.startType).toBe('absolute');
    expect(details.path).toBe(path);
    expect(details.folderPath).toBe(folder);
    expect(details.file).toBe(file);
    expect(details.typedFile).toBe(file);
    expect(details.fileFolder).toBe('c');
  });

  it('should return the details of a relative path', () => {
    const folder = 'a/b/c/'; // relative path
    const file = 'd.e';
    const path = `${folder}${file}`;
    const details = slashPathDetails(path);

    expect(details.type).toBe('typedfile');
    expect(details.startType).toBe('relative');
    expect(details.path).toBe(path);
    expect(details.folderPath).toBe(folder);
    expect(details.file).toBe(file);
    expect(details.typedFile).toBe(file);
    expect(details.fileFolder).toBe('c');
  });

  describe('file', () => {
    it('should return the details of an untyped file at a relative root path', () => {
      const file = 'd';
      const path = `${file}`;
      const details = slashPathDetails(path);

      expect(details.type).toBe('file');
      expect(details.startType).toBe('relative');
      expect(details.path).toBe(path);
      expect(details.folderPath).toBe('');
      expect(details.file).toBe(file);
      expect(details.typedFile).toBeUndefined();
      expect(details.fileFolder).toBeUndefined();
    });

    it('should return the details of an untyped file at an absolute root path', () => {
      const file = 'd';
      const path = `${SLASH_PATH_SEPARATOR}${file}`;
      const details = slashPathDetails(path);

      expect(details.type).toBe('file');
      expect(details.startType).toBe('absolute');
      expect(details.path).toBe(path);
      expect(details.folderPath).toBe(SLASH_PATH_SEPARATOR);
      expect(details.file).toBe(file);
      expect(details.typedFile).toBeUndefined();
      expect(details.fileFolder).toBeUndefined();
    });

    it('should return the details of a typed file at a relative root path', () => {
      const file = 'd.e';
      const path = `${file}`;
      const details = slashPathDetails(path);

      expect(details.type).toBe('typedfile');
      expect(details.startType).toBe('relative');
      expect(details.path).toBe(path);
      expect(details.folderPath).toBe('');
      expect(details.file).toBe(file);
      expect(details.typedFile).toBe(file);
      expect(details.fileFolder).toBeUndefined();
    });

    it('should return the details of a typed file at an absolute root path', () => {
      const file = 'd.e';
      const path = `${SLASH_PATH_SEPARATOR}${file}`;
      const details = slashPathDetails(path);

      expect(details.type).toBe('typedfile');
      expect(details.startType).toBe('absolute');
      expect(details.path).toBe(path);
      expect(details.folderPath).toBe(SLASH_PATH_SEPARATOR);
      expect(details.file).toBe(file);
      expect(details.typedFile).toBe(file);
      expect(details.fileFolder).toBeUndefined();
    });
  });
});

describe('slashPathPathMatcher()', () => {
  describe('instance', () => {
    describe('simple paths', () => {
      describe('exact folder', () => {
        const folder = 'a/b/c';
        const matcher = slashPathPathMatcher({ targetPath: folder });

        it('should match a the folder', () => {
          const result = matcher(folder);
          expect(result.matchesTargetPath).toBe(true);
          expect(result.matchingParts).toEqual(['a', 'b', 'c']);
          expect(result.nonMatchingParts.filter(Boolean)).toHaveLength(0);
        });

        it('should not match a sub path folder', () => {
          const result = matcher(`${folder}/d`);
          expect(result.matchesTargetPath).toBe(false);
          expect(result.matchingParts).toEqual(['a', 'b', 'c', null]);
          expect(result.nonMatchingParts.filter(Boolean)).toHaveLength(1);
          expect(result.nonMatchingParts).toEqual([null, null, null, 'd']);
        });

        describe('matchRemaining=true', () => {
          const matcher = slashPathPathMatcher({ targetPath: folder, matchRemaining: true });

          it('should match a the folder', () => {
            const result = matcher(folder);
            expect(result.matchesTargetPath).toBe(true);
            expect(result.matchingParts).toEqual(['a', 'b', 'c']);
            expect(result.nonMatchingParts.filter(Boolean)).toHaveLength(0);
          });

          it('should match a sub path folder', () => {
            const result = matcher(`${folder}/d`);
            expect(result.matchesTargetPath).toBe(true);
            expect(result.matchingParts).toEqual(['a', 'b', 'c', 'd']);
            expect(result.nonMatchingParts.filter(Boolean)).toHaveLength(0);
          });
        });
      });

      describe('exact file', () => {
        const folder = 'a/b/c/';
        const file = 'avatar.png';
        const filePath = `${folder}${file}`;

        const matcher = slashPathPathMatcher({ targetPath: filePath });

        it('should match a the file path', () => {
          const result = matcher(filePath);
          expect(result.matchesTargetPath).toBe(true);
          expect(result.matchingParts).toEqual(['a', 'b', 'c', 'avatar.png']);
          expect(result.nonMatchingParts.filter(Boolean)).toHaveLength(0);
        });

        it('should not match the folder path', () => {
          const result = matcher(folder);
          expect(result.matchesTargetPath).toBe(false);

          expect(result.matchingParts).toEqual(['a', 'b', 'c', null]);
          expect(result.nonMatchingParts.filter((x) => x != null)).toHaveLength(1);
          expect(result.nonMatchingParts).toEqual([null, null, null, result.nonMatchingFillValue]);
        });

        describe('matchRemaining=true', () => {
          const matcher = slashPathPathMatcher({ targetPath: folder, matchRemaining: true });

          it('should match a the folder', () => {
            const result = matcher(folder);
            expect(result.matchesTargetPath).toBe(true);
            expect(result.matchingParts).toEqual(['a', 'b', 'c']);
            expect(result.nonMatchingParts.filter(Boolean)).toHaveLength(0);
          });
        });
      });
    });

    describe('complex paths configuration', () => {
      // TODO: ...
    });
  });
});

describe('slashPathSubPathMatcher()', () => {
  describe('instance', () => {
    describe('simple path', () => {
      const basePath = 'a/b/c';
      const matcher = slashPathSubPathMatcher({ basePath });

      it('should match a sub path folder', () => {
        const result = matcher(`${basePath}/d`);
        expect(result.matchesBasePath).toBe(true);
        expect(result.subPathParts).toBeDefined();
        expect(result.subPathParts).toEqual(['d']);
        expect(result.nonMatchingParts.filter(Boolean)).toHaveLength(0);
      });

      it('should match a sub path file', () => {
        const result = matcher(`${basePath}/d.e`);
        expect(result.matchesBasePath).toBe(true);
        expect(result.subPathParts).toBeDefined();
        expect(result.subPathParts).toEqual(['d.e']);
        expect(result.nonMatchingParts.filter(Boolean)).toHaveLength(0);
      });

      it('should match a sub path nested file', () => {
        const result = matcher(`${basePath}/d/e.f`);
        expect(result.matchesBasePath).toBe(true);
        expect(result.subPathParts).toBeDefined();
        expect(result.subPathParts).toEqual(['d', 'e.f']);
        expect(result.nonMatchingParts.filter(Boolean)).toHaveLength(0);
      });

      it('should not match a non-sub path', () => {
        const result = matcher('a/b/d');
        expect(result.matchesBasePath).toBe(false);
        expect(result.nonMatchingParts.filter(Boolean)).toHaveLength(1);
        expect(result.nonMatchingParts[2]).toBe('d');
      });
    });

    describe('complex paths configuration', () => {
      // TODO: ...
    });
  });
});
