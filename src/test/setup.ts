import { configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// Testing Library's waitFor/findBy default to 1s, which a loaded Contabo runner
// blows through: a different handful of specs fails each run and all of them
// pass on an idle box. Raise the budget globally — a passing assertion still
// resolves as soon as its condition holds, so this costs nothing when green.
configure({ asyncUtilTimeout: 5000 });
