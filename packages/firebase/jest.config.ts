/* eslint-disable */
(global as any).appTestType = 'firebase';

module.exports = {
  displayName: 'firebase',
  maxConcurrency: 1,
  maxWorkers: 1,
  coverageDirectory: '../../coverage/packages/firebase',
  preset: '../../jest.preset.ts'
};
