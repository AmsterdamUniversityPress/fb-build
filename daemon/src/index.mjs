#!/usr/bin/env node

import {
  pipe, compose, composeRight,
  condS, eq, guard, die, otherwise,
  ifTrue, noop, tryCatch, sprintfN, ifNil,
} from 'stick-js/es'

import fs from 'node:fs'
import fsP from 'node:fs/promises'
import path from 'node:path'

import { then, recover, rejectP, startP, } from 'alleycat-js/es/async'
import { decorateRejection, toString, } from 'alleycat-js/es/general'

import { start as startBuild, } from './build.mjs'
import { info, warn, } from './io.mjs'

const chomp = (x) => x.replace (/\n$/, '')

const goPath = ['/tmp', 'go']

const trigger = (sourceDesc, zipPath, removeFile=null) => {
  info (`triggered by ${sourceDesc}`)
  const cleanup = (file) => tryCatch (
    () => info ('removed', file),
    warn << decorateRejection ([file] | sprintfN ('Unable to remove %s: ')),
    () => fs.unlinkSync (file),
  )
  return startBuild (zipPath)
  | ifNil (
    () => info ('not starting build'),
    (p) => {
      return p
      // | then (() => removeFile && cleanup (removeFile))
      | then (() => null)
      | recover (rejectP << decorateRejection ('Build failed: '))
    },
  )
}

const go = async (dir, { created=noop, deleted=noop, }) => {
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

const [goDir, goFile] = goPath
go (goDir, {
  created: (goFilename, goFullpath) => {
    if (goFilename !== goFile) return
    fsP.readFile (goFullpath)
    | then (chomp << toString)
    | then ((zipPath) => trigger ('go-file', zipPath, goFullpath))
    | recover ((e) => warn ('Build (trigger=go-file) failed:', e.message || e))
  },
})
