import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const WORKER_DIR = path.join(process.cwd(), 'workers', 'poi-processor')
const LOG_DIR    = path.join(process.cwd(), 'workers', 'logs')

/**
 * Spawn the Python POI worker in the background for the given jobId.
 * Logs stdout/stderr to workers/logs/job-<jobId>.log
 * Returns the child process PID, or throws if Python cannot be found.
 */
export function triggerPOIWorker(jobId) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
  const logFile = path.join(LOG_DIR, `job-${jobId}.log`)
  const logFd   = fs.openSync(logFile, 'a')

  // On Windows 'python' is the standard command; fall back to 'python3' / 'py'
  const candidates = ['python', 'python3', 'py']
  let lastError

  for (const cmd of candidates) {
    try {
      const child = spawn(cmd, ['main.py', jobId], {
        cwd:      WORKER_DIR,
        env:      { ...process.env },   // pass all Next.js env vars (DB_*, GOOGLE_PLACES_API_KEY)
        detached: true,
        stdio:    ['ignore', logFd, logFd],
      })

      child.on('error', () => {})  // prevent unhandled-error crashes
      child.unref()                // let Node exit independently of the worker

      console.log(`[worker] started: cmd=${cmd} job=${jobId} pid=${child.pid} log=${logFile}`)
      return { pid: child.pid, logFile }
    } catch (err) {
      lastError = err
    }
  }

  throw new Error(`Could not start Python worker: ${lastError?.message}`)
}
