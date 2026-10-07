import { randomBytes, scryptSync } from 'node:crypto'
import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'

export function hashPassword(password) {
  const salt = randomBytes(32).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

if (process.argv[1]?.endsWith('password.mjs')) {
  let muted = false
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding)
      callback()
    },
  })
  const input = createInterface({ input: process.stdin, output, terminal: !!process.stdin.isTTY })
  // Read from stdin, hiding terminal input and keeping secrets out of process arguments/history.
  input.question('Password (at least 14 characters; use a unique passphrase): ', (password) => {
    if (process.stdin.isTTY) process.stdout.write('\n')
    if (password.length < 14) {
      console.error('Password too short.')
      process.exitCode = 1
    } else console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`)
    input.close()
  })
  muted = true
}
