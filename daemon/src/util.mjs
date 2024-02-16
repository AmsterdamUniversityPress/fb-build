import {
  pipe, compose, composeRight,
  dot1, whenPredicate, ne,
  map, noop, condS, eq, guard, die, otherwise, ifTrue,
} from 'stick-js/es'

import fs from 'node:fs'
import fsP from 'node:fs/promises'
import path from 'path'
import { fileURLToPath, } from 'url'

import { recover, rejectP, startP, then, } from 'alleycat-js/es/async'
import { composeManyRight, decorateRejection, toString, } from 'alleycat-js/es/general'

// --- usage: `__dirname (import.meta.url)`
export const __dirname = fileURLToPath >> path.dirname

// --- catch a promise rejection, decorate it, and re-reject.
// --- @todo alleycat-js, combine with recoverAndBounce
export const recoverFail = (decorate) => recover (rejectP << decorateRejection (decorate))
export const regardless = dot1 ('finally')

export const whenNe = ne >> whenPredicate

// --- run promises in sequence. Each `f` returns a promise. (This is
// different than Promise.all, or our allP, which take promises, not
// functions. But we need the extra laziness to avoid the promises starting
// all at once).
export const seqP = (... fs) => startP () | composeManyRight (
  ... fs | map (then),
)

export const delayP = (ms, val=null) => new Promise ((res, _) =>
  setTimeout (() => res (val), ms),
)

export const chomp = (x) => x.replace (/\n+$/, '')

export const watchDir = async (dir, { created=noop, deleted=noop, }) => {
  const watcher = fsP.watch (dir)
  for await (const { eventType, filename, } of watcher) {
    const fullpath = path.join (dir, filename)
    eventType | condS ([
      // --- a file was created or deleted
      eq ('rename') | guard (() => {
        fs.existsSync (fullpath) | ifTrue (
          // --- file was created
          () => created (filename, fullpath),
          // --- file was deleted
          () => deleted (filename, fullpath),
        )
      }),
      eq ('change') | guard (() => {}),
      otherwise | guard (() => die ('unexpected')),
    ])
  }
}

