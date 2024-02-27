import {
  pipe, compose, composeRight,
  die, lets, not, sprintfN, join,
} from 'stick-js/es'

import fsP from 'node:fs/promises'

import daggy from 'daggy'

import { allP, recover, rejectP, startP, then, } from 'alleycat-js/es/async'
import { cata, } from 'alleycat-js/es/bilby'
import { decorateRejection, setTimeoutOn, } from 'alleycat-js/es/general'

import { cmdP, cmdPCwd, info, ls, magenta, mkdirExistsOkP, warn, yellow, } from './io.mjs'
import { __dirname, recoverFail, regardless, seqP, } from './util.mjs'

// --- @todo
const [fbBuildRoot, buildDirRoot, buildDirLatestData] = lets (
  () => __dirname (import.meta.url) + '/../..',
  (fbBuildRoot) => fbBuildRoot + '/build',
  (_, buildDir) => buildDir + '/latest-data',
  (fbBuildRoot, buildDir, buildDirLatestData) => [fbBuildRoot, buildDir, buildDirLatestData],
)

const stateType = daggy.taggedSum ('stateType', {
  Building: [],
  Idle: [],
})

const { Building, Idle, } = stateType

const state = { current: Idle, }

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

const numTimes = 10
const tryInterval = 10000

// --- try numTimes times, with an interval of tryInterval
const unzip = (dir, zipPath) => new Promise ((res, rej) => {
  const f = (tryIdx) => {
    if (tryIdx === 0) return rej ('Gave up after ' + String (numTimes) + ' tries')
    const g = () => cmdPCwd (dir) ('unzip', zipPath)
    | then (() => res ())
    | recover ((e) => {
      warn (e)
      tryInterval | setTimeoutOn (() => f (tryIdx - 1))
    })
    tryInterval | setTimeoutOn (g)
  }
  f (numTimes)
})

const makeCsv = (buildDir, zipPath) => {
  info ('makeCsv', buildDir, zipPath)
  let unzipDir, xlsx
  return startP ()
  | then (() => fsP.mkdtemp (buildDir + '/'))
  | then ((dir) => unzipDir = dir)
  | then (() => unzip (unzipDir, zipPath))
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

const prepareData = (env, csvFile, outputJson, outputJsonLatest) => {
  info ('preparing data for env', yellow (env))
  return startP ()
  | then (() => fbIngest (env, csvFile))
  | recoverFail ('Error with fb-ingest: ')
  | then (({ stdout: json, }) => allP ([
    fsP.writeFile (outputJson, json),
    fsP.writeFile (outputJsonLatest, json),
  ]))
  | recoverFail ('Error writing json: ')
  | recoverFail (`Error preparing data for env ${env}: `)
}

const buildDockerImage = () => {
  return cmdPCwd (fbBuildRoot) (
    'docker', 'build', '--build-arg', 'CACHEBUST=$(date +%s)', '-t', 'fb-main', '.',
  ) | then (({ stdout, }) => console.log (stdout))
}

const go = (buildDir, zipPath) => {
  return makeCsv (buildDir, zipPath)
  | then ((csvFile) => seqP (
    () => prepareData ('tst', csvFile, buildDir + '/fb-tst.json', buildDirLatestData + '/fb-tst.json'),
    () => prepareData ('acc', csvFile, buildDir + '/fb-acc.json', buildDirLatestData + '/fb-acc.json'),
    () => prepareData ('prd', csvFile, buildDir + '/fb-prd.json', buildDirLatestData + '/fb-prd.json'),
    () => buildDockerImage (),
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
