import {
  pipe, compose, composeRight,
} from 'stick-js'

import { realpathSync as realpath, } from 'fs'
import { join as pathJoin, } from 'path'

import { __dirname, } from './util.mjs'

const rootDir = realpath (pathJoin (__dirname (import.meta.url), '../..'))

export const config = () => {
  const c = {
    goPath: ['/path/to/dir', 'file'],
    uploadDir: '/path/to/dir',
    buildRoot: rootDir,
    // --- build dirs must match paths in Dockerfile-main
    buildDir: pathJoin (rootDir, 'build'),
    cmdIngest: 'fb-ingest',
    // --- be sure to add the command to sudoers (use * for the path)
    cmdRmUpload: (path) => ['sudo', 'rm', '-f', path],
    dockerImage: 'fb-main',
    unzipNumRetries: 10,
    unzipTryInterval: 10000,
  }
  c.buildLatestDataDir = pathJoin (c.buildDir, 'latest-data')
  return c
}
