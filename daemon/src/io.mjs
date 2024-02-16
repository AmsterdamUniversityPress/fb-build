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
const _cmdP = (cmd, args, invocationOpts={}) => new Promise ((res, rej) => {
  const o = fishLib.sysSpawn (
    cmd,
    args,
    {
      die: false,
      verbose: true,
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

export const cmdP = (cmd, ... args) => _cmdP (cmd, args)
export const cmdPCwd = (cwd) => (cmd, ... args) => _cmdP (cmd, args, { cwd, })

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
