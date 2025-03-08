import js from '@eslint/js'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    name: 'cm-molins-api/recommended',
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'indent': ['error', 2],
      'no-multiple-empty-lines': ['error', { max: 1 }],
    },
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/coverage/**'],
  },
]
