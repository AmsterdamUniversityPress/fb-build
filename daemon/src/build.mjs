import {
  pipe, compose, composeRight,
  die, lets, map, dot1, id,
  whenPredicate, ne, tryCatch, not,
  sprintfN, join, tap,
} from 'stick-js/es'

import fs from 'node:fs'
import fsP from 'node:fs/promises'

import daggy from 'daggy'
import fishLib from 'fish-lib'

import { allP, recover, recoverAndBounce, resolveP, rejectP, startP, then, } from 'alleycat-js/es/async'
import { cata, } from 'alleycat-js/es/bilby'
import { composeManyRight, decorateRejection, logWith, } from 'alleycat-js/es/general'

import { cmdP, cmdPCwd, info, magenta, warn, yellow, } from './io.mjs'
import { __dirname, } from './util.mjs'

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
// const buildDirRoot = process.env.HOME + '/build'
const [buildDirRoot, buildDirLatestData] = lets (
  () => __dirname (import.meta.url) + '/../../build',
  (buildDir) => buildDir + '/latest-data',
  (buildDir, buildDirLatestData) => [buildDir, buildDirLatestData],
)

const stateType = daggy.taggedSum ('stateType', {
  Building: [],
  Idle: [],
})

const { Building, Idle, } = stateType

const state = { current: Idle, }

const mkdirExistsOkP = (dir) => fsP.mkdir (dir)
  | recover ((e) => e.code | whenNe ('EEXIST') (
    () => rejectP (e | decorateRejection ('Unable to create directory:')),
  ))
  | then (() => dir)

const prepareBuildDir = () => startP ()
  | then (() => mkdirExistsOkP (buildDirRoot))
  | then (() => mkdirExistsOkP (buildDirLatestData))
  | then (() => fsP.mkdtemp (buildDirRoot + '/'))
  | recover (rejectP << decorateRejection ('prepareBuildDir (): '))

// --- we could potentially want to handle the data differently per
// environment, but at the moment the environment is ignored.
const fbIngest = (env, csvFile) => {
  info ([yellow (env), magenta (csvFile)] | sprintfN (
    'doing fb-ingest for env=%s, csv-file=%s',
  ))
  return cmdP ('fb-ingest', csvFile)
}

const ls = (dir) => tryCatch (
  id,
  decorateRejection ('ls (): '),
  () => fs.readdirSync (dir),
)

const makeCsv = (buildDir, zipPath) => {
  info ('makeCsv', buildDir, zipPath)
  let unzipDir, xlsx
  return startP ()
  | then (() => fsP.mkdtemp (buildDir + '/'))
  | then ((dir) => unzipDir = dir)
  | then (() => cmdPCwd (unzipDir) ('unzip', zipPath))
  | then (() => {
    const files = ls (unzipDir)
    const n = files.length
    if (n !== 1) die ('makeCsv (): expected exactly 1 file in zip file, got', n)
    const last = files [0]
    if (not (last.match (/.xlsx$/i))) warn ('Expected .xlsx extension, got filename', last)
    xlsx = last
    return cmdPCwd (unzipDir) ('libreoffice', '--convert-to', 'csv', xlsx)
  })
  | then (() => join ('/', [
    unzipDir,
    xlsx.replace (/\.[^.]*$/, '.csv'),
  ]))
  | recover (rejectP << decorateRejection ('makeCsv (): '))
}

const buildEnv = (env, csvFile, outputJson, outputJsonLatest) => {
  info ('building env:', env)
  return startP ()
  | then (() => fbIngest (env, csvFile))
  | recoverFail ('Error with fb-ingest: ')
  | then (({ stdout: json, }) => allP ([
    fsP.writeFile (outputJson, json),
    fsP.writeFile (outputJsonLatest, json),
  ]))
  | recoverFail ('Error writing json: ')
  | recoverFail (`Error building env ${env}: `)
}

const go = (buildDir, zipPath) => {
  return makeCsv (buildDir, zipPath)
  | then ((csvFile) => seq (
    () => buildEnv ('tst', csvFile, buildDir + '/fb-tst.json', buildDirLatestData + '/fb-tst.json'),
    () => buildEnv ('acc', csvFile, buildDir + '/fb-acc.json', buildDirLatestData + '/fb-acc.json'),
    () => buildEnv ('prd', csvFile, buildDir + '/fb-prd.json', buildDirLatestData + '/fb-prd.json'),
  ))
}

export const start = (zipPath) => state.current | cata ({
  Building: () => {
    info ('build in progress, ignoring trigger')
    return null
  },
  Idle: () => {
    state.current = Building
    const toIdle = () => state.current = Idle
    return prepareBuildDir ()
    | then ((buildDir) => {
      info ('starting new build, working dir =', buildDir, 'zipfile =', zipPath)
      return go (buildDir, zipPath)
    })
    | regardless (() => toIdle ())
    | then (() => info ('build completed successfully!'))
    | recoverFail ('Aborting: ')

    // --- @todo
    // | recoverAndBounce ((_) => toIdle ())
  },
})
