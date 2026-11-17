import basePackageConfig from '../eslint.config.mjs';

const NESTJS_FREE_MESSAGE = 'zoho-cli must stay NestJS-free (it ships as a self-contained bundle): build clients from the @dereekb/zoho factories';

export default [
  ...basePackageConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@dereekb/zoho/nestjs', message: NESTJS_FREE_MESSAGE }],
          patterns: [{ group: ['@nestjs/*'], message: NESTJS_FREE_MESSAGE }]
        }
      ]
    }
  }
];
