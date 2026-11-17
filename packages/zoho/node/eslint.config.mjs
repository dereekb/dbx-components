import basePackageConfig from '../eslint.config.mjs';

const NESTJS_FREE_MESSAGE = '@dereekb/zoho/node must stay NestJS-free (zoho-cli bundles it as a self-contained bundle): import from @dereekb/zoho, never @dereekb/zoho/nestjs or @nestjs/*';

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
