/* eslint-disable */
(global as any).testFolderRootPath = '<rootDir>/../../..';
(global as any).appTestType = 'firebase';

module.exports = {
  displayName: 'firebase-server-mailgun',
  maxWorkers: 1,
  coverageDirectory: '../../../coverage/packages/firebase-server/mailgun',
  preset: '../../../jest.preset.ts'
};
