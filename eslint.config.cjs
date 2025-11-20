const js = require('@eslint/js');
const prettier = require('eslint-plugin-prettier');
const jest = require('eslint-plugin-jest');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules', 'coverage']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.commonjs
      }
    },
    plugins: {
      prettier
    },
    rules: {
      ...js.configs.recommended.rules,
      'prettier/prettier': 'error',
      'no-console': 'off'
    }
  },
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
        ...globals.commonjs
      }
    },
    plugins: { jest },
    rules: {
      ...jest.configs.recommended.rules,
      'jest/expect-expect': 'warn'
    }
  }
];
