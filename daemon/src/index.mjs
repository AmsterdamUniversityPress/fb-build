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
import { decorateRejection, } from 'alleycat-js/es/general'

import { start as startBuild, } from './build.mjs'
import { info, warn, } from './io.mjs'

const trigger = (source) => {
  info (`triggered by ${source}`)
  return startBuild ()
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

const TMPDIR = '/tmp'
go (TMPDIR, {
  created: (filename, fullpath) => {
    if (filename !== 'go') return
    const cleanup = () => tryCatch (
      () => info ('removed', fullpath),
      warn << decorateRejection ([fullpath] | sprintfN ('Unable to remove %s: ')),
      () => fs.unlinkSync (fullpath),
    )
    trigger ('go-file')
    | ifNil (
      () => info ('not starting build'),
      (p) => {
        return p
        | then (() => cleanup ())
        | recover ((e) => {
          warn ('Build failed:', e.message || e)
        })
      },
    )
  },
})
