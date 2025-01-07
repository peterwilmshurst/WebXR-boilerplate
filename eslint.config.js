import js from "@eslint/js";
import stylistic from '@stylistic/eslint-plugin'
import globals from "globals";

export default [
  {
    files: ['src/**/*.js'],
    plugins: {
      '@stylistic': stylistic,
    },
    languageOptions: { 
      globals: { ...globals.browser,
        process: 'readonly',
    },
  },
  rules: {
    ...js.configs.recommended.rules,
    ...stylistic.configs['recommended-flat'].rules,
  },
}
];