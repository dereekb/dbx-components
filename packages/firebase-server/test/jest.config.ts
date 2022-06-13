(global as any).testFolderRootPath = '<rootDir>/../../..';
(global as any).appTestType = 'firebase';

module.exports = {
  displayName: 'firebase-server-test',
  maxConcurrency: 1,
  maxWorkers: 1,
  coverageDirectory: '../../coverage/packages/firebase-server/test',
  preset: '../../jest.preset.ts'
};
