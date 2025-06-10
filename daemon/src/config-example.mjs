import {
  pipe, compose, composeRight,
  lets,
} from 'stick-js'

import { realpathSync as realpath, } from 'fs'
import { join as pathJoin, } from 'path'

import { __dirname, lookupOnOrDie, } from './util.mjs'

const rootDir = realpath (pathJoin (__dirname (import.meta.url), '../..'))

export const config = () => {
  const nginxCache = {
    tst: 'tst',
    acc: 'acc',
    prd: 'prd',
  }
  const c = {
    goPath: ['/path/to/dir', 'file'],
    uploadDir: '/path/to/dir',
    buildRoot: rootDir,
    // --- build dirs must match paths in Dockerfile-main
    buildDir: pathJoin (rootDir, 'build'),
    // --- be sure to add the sudo commands to sudoers (use * for arbitrary
    // arguments)
    cmdIngest: '/path/to/fb-ingest',
    cmdRmUpload: (path) => ['sudo', 'rm', '-f', path],
    cmdClearNginxCache: (env) => lets (
      () => env | lookupOnOrDie ('bad env', nginxCache),
      (dir) => ['sudo', 'rm', '-rf', '/path/to/nginx-cache/' + dir + '/*', ],
    ),
    dockerImage: 'fb-main',
    unzipNumRetries: 10,
    unzipTryInterval: 10000,
  }
  c.buildLatestDataDir = pathJoin (c.buildDir, 'latest-data')
  return c
}
