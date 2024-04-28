#!/usr/bin/env node

import {
  pipe, compose, composeRight,
  split, map, ifOk,
} from 'stick-js/es'

import fsP from 'node:fs/promises'

import yargsMod from 'yargs'

import { then, recover, rejectP, resolveP, } from 'alleycat-js/es/async'
import { decorateRejection, toString, } from 'alleycat-js/es/general'
import configure from 'alleycat-js/es/configure'

import { start as startBuild, deploy, } from './build.mjs'
import { config, } from './config.mjs'
import { cmdP, error, info, warn, } from './io.mjs'
import { chomp, seqP, watchDir, } from './util.mjs'

const configTop = configure.init (config ())
const { cmdRmUpload, goPath, uploadDir, } = configTop.gets (
  'cmdRmUpload',
  'goPath', 'uploadDir',
)

const yargs = yargsMod
  .usage ('Usage: node $0 [options]')
  .option ('deploy-only', {
    string: true,
    describe: 'Takes a comma-separated list of environments to deploy to and then exit. May be used even if another instance is already running.',
  })
  .version (false)
  .strict ()
  .help ('h')
  .alias ('h', 'help')
  .showHelpOnFail (false, 'Specify --help for available options')

const opt = yargs.argv
// --- showHelp also quits.
if (opt._.length !== 0)
  yargs.showHelp (error)

const trigger = (sourceDesc, zipPath, removeFile=null) => {
  info (`triggered by ${sourceDesc}`)
  const cleanup = (file) => cmdP (... cmdRmUpload (file))
  return startBuild (zipPath)
  | then (() => removeFile && cleanup (removeFile))
  | recover (rejectP << decorateRejection ('Build failed: '))
}

const [goDir, goFile] = goPath

const startWatchers = () => {
  // --- triggers build using a file like /tmp/go, which must then contain the
  // path to the zip file.
  watchDir (goDir, {
    created: (goFilename, goFullpath) => {
      if (goFilename !== goFile) return
      fsP.readFile (goFullpath)
      | then (chomp << toString)
      | then ((zipPath) => trigger ('go-file', zipPath, goFullpath))
      | recover ((e) => warn ('Build (trigger=go-file) failed:', e.message || e))
    },
  })

  // --- triggers build when a file appears in `uploadDir`
  watchDir (uploadDir, {
    created: (_zipFilename, zipFullpath) => {
      trigger ('upload', zipFullpath, zipFullpath)
      | recover ((e) => warn ('Build (trigger=upload) failed:', e.message || e))
    }
  })
}

opt.deployOnly | ifOk (
  (envs) => seqP (envs | split (',') | map (
    (env) => deploy (env)
    | recover (error << decorateRejection ('Deploy failed for ' + env, ': '))
  )),
  () => {
    startWatchers ()
    info ('ready')
  },
)
