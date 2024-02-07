import {
  pipe, compose, composeRight,
  sprintfN,
} from 'stick-js/es'

import fishLib from 'fish-lib'

export const {
  log, info, warn, error, green, yellow, magenta, brightRed, cyan, brightBlue,
} = fishLib

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
