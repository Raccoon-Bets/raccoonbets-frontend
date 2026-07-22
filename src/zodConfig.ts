import { z } from 'zod'

// Zod 4 JIT-compiles object validators with `new Function`, which needs a CSP
// `script-src 'unsafe-eval'` the site deliberately withholds. Disabling the JIT
// keeps validation on the interpreted path — fast enough for these schemas and
// free of eval. Imported first in main.ts so it runs before any schema is parsed.
z.config({ jitless: true })
