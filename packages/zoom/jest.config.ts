/* eslint-disable */
(global as any).appTestType = 'nestjs';

module.exports = {
  displayName: 'zoom',
  preset: '../../jest.preset.ts',
  coverageDirectory: '../../coverage/packages/zoom',
  modulePathIgnorePatterns: ['nestjs']
};
