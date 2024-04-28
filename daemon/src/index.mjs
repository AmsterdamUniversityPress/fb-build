#!/usr/bin/env node

import {
  pipe, compose, composeRight,
  tryCatch, sprintfN, ifNil,
} from 'stick-js/es'

import fs from 'node:fs'
import fsP from 'node:fs/promises'

import { then, recover, rejectP, resolveP, } from 'alleycat-js/es/async'
import { decorateRejection, toString, } from 'alleycat-js/es/general'
import configure from 'alleycat-js/es/configure'

import { start as startBuild, } from './build.mjs'
import { config, } from './config.mjs'
import { cmdP, info, warn, } from './io.mjs'
import { chomp, watchDir, } from './util.mjs'

const configTop = configure.init (config ())
const { cmdRmUpload, goPath, uploadDir, } = configTop.gets (
  'cmdRmUpload',
  'goPath', 'uploadDir',
)

const trigger = (sourceDesc, zipPath, removeFile=null) => {
  info (`triggered by ${sourceDesc}`)
  const cleanup = (file) => cmdP (... cmdRmUpload (file))
  return startBuild (zipPath)
  | then (() => removeFile && cleanup (removeFile))
  | recover (rejectP << decorateRejection ('Build failed: '))
}

const [goDir, goFile] = goPath

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

info ('ready')
