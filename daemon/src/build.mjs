import {
  pipe, compose, composeRight,
  die, lets, map, dot1,
  whenPredicate, ne,
} from 'stick-js/es'

import fsP from 'node:fs/promises'

import daggy from 'daggy'
import fishLib from 'fish-lib'

import { then, recover, recoverAndBounce, rejectP, startP, } from 'alleycat-js/es/async'
import { cata, } from 'alleycat-js/es/bilby'
import { composeManyRight, decorateRejection, } from 'alleycat-js/es/general'

import { cmdPCwd, info, warn, } from './io.mjs'

// --- catch a promise rejection, decorate it, and re-reject.
// --- @todo alleycat-js, combine with recoverAndBounce
const recoverFail = (decorate) => recover (rejectP << decorateRejection (decorate))
const regardless = dot1 ('finally')

const whenNe = ne >> whenPredicate

// --- run promises in sequence. Each `f` returns a promise. (This is
// different than Promise.all, or our allP, which take promises, not
// functions. But we need the extra laziness to avoid the promises starting
// all at once).
const seq = (... fs) => startP () | composeManyRight (
  ... fs | map (then),
)
const delayP = (ms, val=null) => new Promise ((res, _) =>
  setTimeout (() => res (val), ms),
)

// --- @todo
const buildDirRoot = process.env.HOME + '/build'

const stateType = daggy.taggedSum ('stateType', {
  Building: [],
  Idle: [],
})

const { Building, Idle, } = stateType
// export { Building, Idle, }

const state = { current: Idle, }

const mkdirExistsOkP = (dir) => fsP.mkdir (dir)
  | recover ((e) => e.code | whenNe ('EEXIST') (
    () => rejectP (
      e | decorateRejection ('Unable to create directory:'),
    ),
  ))
  | then (() => dir)

const prepareBuildDir = () => startP ()
  | then (() => mkdirExistsOkP (buildDirRoot))
  | then ((dir) => fsP.mkdtemp (dir + '/'))
  | recover (rejectP << decorateRejection ('Error: prepareBuildDir (): '))

export const start = () => state.current | cata ({
  Building: () => {
    info ('build in progress, ignoring trigger')
    return null
  },
  Idle: () => {
    state.current = Building
    const toIdle = () => state.current = Idle
    return prepareBuildDir ()
    | then ((buildDir) => {
      info ('starting new build, working dir =', buildDir)
      return go (buildDir)
    })
    | regardless (() => toIdle ())
    | then (() => info ('build completed successfully!'))
    | recoverFail ('Aborting: ')

    // --- @todo
    // | recoverAndBounce ((_) => toIdle ())
  },
})

// --- @todo
const [d, f] = lets (
  () => process.env.HOME + '/src/fb',
  (pref) => [
    pref + '/fb-ingest/fb_ingest',
    '/home/upload',
  ],
)

// --- @todo
const buildEleventy = () => {
  info ('building eleventy')
  return null
}

const fbIngest = () => {
  info ('doing fb-ingest')
  return cmdPCwd (d) (
    // --- @todo
    'fb-ingest', '/tmp/fonds.csv',
  )
}

const buildEnv = (env, outputJson) => {
  info ('building env:', env)
  info ('output:', outputJson)
  return startP ()
  | then (() => fbIngest ())
  | recoverFail ('Error with fb-ingest: ')
  | then (({ stdout: json, }) => fsP.writeFile (outputJson, json))
  | recoverFail ('Error writing json: ')
  | then (() => buildEleventy ())
  | recoverFail ('Error building eleventy: ')
  | recoverFail (`Error building env ${env}: `)
}

const go = (buildDir) => seq (
  // () => makeCsv (f, ),
  () => buildEnv ('tst', buildDir + '/fb-tst.json'),
  () => buildEnv ('acc', buildDir + '/fb-acc.json'),
  () => buildEnv ('prd', buildDir + '/fb-prd.json'),
)
