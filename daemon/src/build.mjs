import {
  pipe, compose, composeRight,
  die, lets, not, sprintfN, join, nil, whenOk,
  prop,
} from 'stick-js/es'

import fsP from 'node:fs/promises'

import daggy from 'daggy'

import { allP, recover, rejectP, startP, then, } from 'alleycat-js/es/async'
import { cata, } from 'alleycat-js/es/bilby'
import { decorateRejection, setTimeoutOn, trim, } from 'alleycat-js/es/general'
import { blue, } from 'alleycat-js/es/io'
import { isEmptyString, } from 'alleycat-js/es/predicate'

import { cmdP, cmdPCwd, cmdPOptsFull, cmd, info, ls, magenta, mkdirExistsOkP, warn, yellow, } from './io.mjs'
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

const UNZIP_NUM_RETRIES = 10
const UNZIP_TRY_INTERVAL = 10000
const DOCKER_IMAGE = 'fb-main'

// --- try numTimes times, with an interval of tryInterval
const unzip = (dir, zipPath) => new Promise ((res, rej) => {
  const f = (tryIdx) => {
    if (tryIdx === 0) return rej ('Gave up after ' + String (UNZIP_NUM_RETRIES) + ' tries')
    const g = () => cmdPCwd (dir) ('unzip', zipPath)
    | then (() => res ())
    | recover ((e) => {
      warn (e)
      UNZIP_TRY_INTERVAL | setTimeoutOn (() => f (tryIdx - 1))
    })
    UNZIP_TRY_INTERVAL | setTimeoutOn (g)
  }
  f (UNZIP_NUM_RETRIES)
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

const buildDockerImage = async () => {
  await cmdPOptsFull ({ outPrint: true, }, { cwd: fbBuildRoot, }) (
    'docker', 'build', '--file', 'Dockerfile-main', '--build-arg', 'CACHEBUST=' + String (Date.now ()), '-t', 'fb-main', '.',
  )
  const fbSiteCommit = cmd (
    'docker', 'run', '--rm', 'fb-main:latest', 'sh', '-c', 'cd fb-site && git rev-parse --short HEAD',
  )
  | prop ('stdout')
  | whenOk (trim)
  if (nil (fbSiteCommit) || isEmptyString (fbSiteCommit))
    return warn ('Unable to determine fb-site commit')
  info ('tagging new image with fb-site commit:', blue (fbSiteCommit))
  cmd (
    'docker', 'image', 'tag', 'fb-main:latest', 'fb-main:' + fbSiteCommit,
  )
}

const doBuild = (buildDir, zipPath) => {
  return makeCsv (buildDir, zipPath)
  | then ((csvFile) => seqP (
    () => prepareData ('tst', csvFile, buildDir + '/fb-tst.json', buildDirLatestData + '/fb-tst.json'),
    () => prepareData ('acc', csvFile, buildDir + '/fb-acc.json', buildDirLatestData + '/fb-acc.json'),
    () => prepareData ('prd', csvFile, buildDir + '/fb-prd.json', buildDirLatestData + '/fb-prd.json'),
    () => buildDockerImage (),
  ))
}

const deploy = (env) => lets (
  () => DOCKER_IMAGE + ':latest',
  () => DOCKER_IMAGE + ':' + env,
  (from, to) => cmdP ('docker', 'image', 'tag', from, to),
)

export const start = (zipPath) => state.current | cata ({
  Building: () => rejectP ('Build in progress, ignoring trigger'),
  Idle: () => {
    state.current = Building
    const toIdle = () => state.current = Idle
    return prepareBuildDir ()
    | then ((buildDir) => {
      info ('starting new build, working dir =', buildDir, 'zipfile =', zipPath)
      return doBuild (buildDir, zipPath)
    })
    | then (() => info ('build completed successfully, deploying'))
    | then (() => deploy ('tst'))
    | then (() => info ('all done!'))
    | regardless (() => toIdle ())
    | recoverFail ('Aborting: ')

    // --- @todo
    // | recoverAndBounce ((_) => toIdle ())
  },
})
