/* eslint-disable */
(global as any).testFolderRootPath = '<rootDir>/../../..';
(global as any).appTestType = 'firebase';

module.exports = {
  displayName: 'firebase-server-model',
  maxWorkers: 1,
  coverageDirectory: '../../../coverage/packages/firebase-server/model',
  preset: '../../../jest.preset.ts'
};
