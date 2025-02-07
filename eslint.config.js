import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    name: 'cm-molins-api/recommended',
    files: ['**/*.{js,mjs}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: ['**/coverage/**'],
  },

]
