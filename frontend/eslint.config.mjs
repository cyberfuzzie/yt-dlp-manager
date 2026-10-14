import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

const cwd = new URL('.', import.meta.url).pathname;

// Extract TypeScript recommended rules safely at runtime.
const tsRecommendedRules = 'rules' in ts.configs.recommended
    ? ts.configs.recommended.rules
    : {};

export default [
    // Ignore generated / build directories
    {
        ignores: ['**/.svelte-kit/**', '**/build/**', '**/coverage/**', '**/node_modules/**'],
    },

    // Base configuration for all files
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
        },
        rules: {
            'no-console': 'warn',
            'no-unused-vars': 'off',
            eqeqeq: ['error', 'always', { null: 'ignore' }],
        },
    },

    // TypeScript files — recommended rules + project-aware checks
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: cwd,
            },
        },
        plugins: { '@typescript-eslint': ts },
        rules: {
            ...tsRecommendedRules,
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',
        },
    },

    // Svelte files — explicit parser + processor + plugin rules
    {
        files: ['**/*.svelte'],
        languageOptions: {
            parser: svelteParser,
            parserOptions: {
                parser: tsParser,
                extraFileExtensions: ['.svelte'],
            },
        },
        processor: svelte.processors['.svelte'],
        plugins: { svelte },
        rules: {
            'no-console': 'off',
            'svelte/comment-directive': 'off',
        },
    },

    // Svelte plugin rules — flat/recommended spreads these as config objects
    ...svelte.configs['flat/recommended'],
];
