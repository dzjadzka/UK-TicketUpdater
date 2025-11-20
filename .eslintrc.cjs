module.exports = {
  env: {
    browser: true,
    es2021: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:testing-library/react',
    'plugin:prettier/recommended'
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  overrides: [
    {
      files: ['vite.config.js', '*.cjs'],
      env: {
        node: true
      },
      rules: {
        'no-undef': 'off'
      }
    },
    {
      files: ['tests/**/*'],
      env: {
        jest: true
      }
    }
  ],
  rules: {
    'react/prop-types': 'off'
  }
};
