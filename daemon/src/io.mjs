import {
  pipe, compose, composeRight,
  sprintfN, id, tryCatch,
} from 'stick-js/es'

import fs from 'node:fs'
import fsP from 'node:fs/promises'

import fishLib from 'fish-lib'

export const {
  log, info, warn, error, green, yellow, magenta, brightRed, cyan, brightBlue,
} = fishLib

import { recover, rejectP, then, } from 'alleycat-js/es/async'
import { decorateRejection, toString, } from 'alleycat-js/es/general'

import { whenNe, } from './util.mjs'

fishLib.forceColors ()
fishLib.bulletSet ({ type: 'star', })

// --- die = false, verbose = true, does not capture stderr
const _cmdP = (cmd, args, opts={}, invocationOpts={}) => new Promise ((res, rej) => {
  const o = fishLib.sysSpawn (
    cmd,
    args,
    {
      die: false,
      verbose: true,
      ... opts,
      invocationOpts,
    },
    ({ code, ok, signal, stdout, stderr, }) => {
      if (ok) res ({ stdout, })
      else rej ([signal, code, stdout] | sprintfN (
        `signal=%s, code=%s, stdout follows: %s`,
      ))
    },
  )
})

export const cmdPOptsFull = (opts, invocationOpts) => (cmd, ... args) => _cmdP (cmd, args, opts, invocationOpts)
export const cmdPOpts = (opts) => cmdPOptsFull (opts, {})
export const cmdPCwd = (cwd) => cmdPOptsFull ({}, { cwd, })
export const cmdP = cmdPOptsFull ({}, {})

export const mkdirExistsOkP = (dir) => fsP.mkdir (dir)
  | recover ((e) => e.code | whenNe ('EEXIST') (
    () => rejectP (e | decorateRejection ('Unable to create directory:')),
  ))
  | then (() => dir)

export const ls = (dir) => tryCatch (
  id,
  decorateRejection ('ls (): '),
  () => fs.readdirSync (dir),
)
