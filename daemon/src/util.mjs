import {
  pipe, compose, composeRight,
  dot1, whenPredicate, ne,
  map, noop, condS, eq, guard, die, otherwise, ifTrue,
  recurry, always, ifOk, id,
} from 'stick-js/es'

import fs from 'node:fs'
import fsP from 'node:fs/promises'
import path from 'path'
import { fileURLToPath, } from 'url'

import { recover, rejectP, startP, then, } from 'alleycat-js/es/async'
import { Left, Right, } from 'alleycat-js/es/bilby'
import { composeManyRight, decorateRejection, } from 'alleycat-js/es/general'
import { ifUndefined, } from 'alleycat-js/es/predicate'

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

export const lookupOn = recurry (2) (
  o => k => o [k],
)
export const lookup = recurry (2) (
  k => o => lookupOn (o, k),
)
export const lookupEitherOn = recurry (2) (
  o => k => o [k] | ifOk (
    Right, () => Left ("Can't find key " + String (k)),
  ),
)
export const lookupOnOr = recurry (3) (
  (f) => (o) => (k) => lookupOn (o, k) | ifUndefined (f, id),
)
export const lookupOr = recurry (3) (
  (f) => (k) => (o) => lookupOnOr (f, o, k),
)
export const lookupOnOrV = recurry (3) (
  (x) => lookupOnOr (x | always),
)
export const lookupOrV = recurry (3) (
  (x) => lookupOr (x | always),
)
export const lookupOrDie = recurry (3) (
  (msg) => (k) => (o) => lookupOnOr (
    () => die (msg),
    o, k,
  )
)
export const lookupOnOrDie = recurry (3) (
  (msg) => (o) => (k) => lookupOrDie (msg, k, o),
)
