import {
  pipe, compose, composeRight,
} from 'stick-js/es'

import { dirname, } from 'path'
import { fileURLToPath, } from 'url'

// --- usage: `__dirname (import.meta.url)`
export const __dirname = fileURLToPath >> dirname

