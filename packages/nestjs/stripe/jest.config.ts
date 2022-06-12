(global as any).appTestType = 'nestjs';
(global as any).testFolderRootPath = '<rootDir>/../../..';

module.exports = {
  displayName: 'nestjs-stripe',
  preset: '../../../jest.preset.ts',
  coverageDirectory: '../../../coverage/packages/nestjs/stripe'
};
