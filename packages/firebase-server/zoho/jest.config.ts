/* eslint-disable */
(global as any).testFolderRootPath = '<rootDir>/../../..';
(global as any).appTestType = 'firebase';

module.exports = {
  displayName: 'firebase-server-zoho',
  maxWorkers: 1,
  coverageDirectory: '../../../coverage/packages/firebase-server/zoho',
  preset: '../../../jest.preset.ts'
};
