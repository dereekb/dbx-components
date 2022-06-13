(global as any).testFolderRootPath = '<rootDir>/../../..';
(global as any).appTestType = 'firebase';

module.exports = {
  displayName: 'firebase-test',
  maxConcurrency: 1,
  maxWorkers: 1,
  coverageDirectory: '../../coverage/packages/firebase/test',
  preset: '../../../jest.preset.ts'
};
