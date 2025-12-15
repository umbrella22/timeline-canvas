import { spawn } from 'node:child_process'

const run = (cmd, args) => {
  const pretty = [cmd, ...args].join(' ')

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('error', (err) => {
      reject(new Error(`Command failed: ${pretty}\n${String(err)}`))
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Command failed (${code ?? 1}): ${pretty}`))
    })
  })
}

const builds = [
    'timeline-canvas',
    'timeline-canvas-mcp',
]

await Promise.all(builds.map((pkg) => run('pnpm', ['--filter', pkg, 'build'])))
