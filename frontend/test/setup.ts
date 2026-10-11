import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { addMessages, init } from 'svelte-i18n';
import en from '../src/locales/en.json';
import de from '../src/locales/de.json';

// Register jest-dom matchers so expect(...).toBeInTheDocument() etc. work.
expect.extend(matchers);

// Load locale dictionaries so $t resolves keys to actual strings.
addMessages('en', en);
addMessages('de', de);

// Initialize svelte-i18n for tests (German by default).
await init({ fallbackLocale: 'en', initialLocale: 'de' });
