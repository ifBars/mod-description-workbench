/* global process */

import { readFileSync } from 'node:fs'

const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const tag = process.env.RELEASE_TAG

if (!tag) throw new Error('RELEASE_TAG is required for a release build.')
if (tag !== `v${version}`) throw new Error(`Release tag ${tag} does not match package version ${version}.`)
