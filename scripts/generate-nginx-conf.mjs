#!/usr/bin/env node
// Generates .docker/default.conf with CSP sha256 hashes for every inline
// <script> in dist/index.html substituted into the {{CSP_SCRIPT_HASHES}}
// placeholder. Run after `vite build`.

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const INLINE_SCRIPT_RE = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g

const html = readFileSync('dist/index.html', 'utf8')
const hashes = [...html.matchAll(INLINE_SCRIPT_RE)]
  .map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`)
  .join(' ')

const template = readFileSync('.docker/default.conf', 'utf8')
writeFileSync('.docker/default.conf.generated', template.replace('{{CSP_SCRIPT_HASHES}}', hashes))

console.log(
  `Generated .docker/default.conf.generated with ${hashes ? hashes.split(' ').length : 0} inline script hash(es).`,
)
