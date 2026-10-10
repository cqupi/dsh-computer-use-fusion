import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

// A timed-out or cancelled generation is destroyed; late output cannot be
// mistaken for a subsequent action. Callers serialize complete observe/act loops.
export class LineProcess {
  constructor(command, argv = [], options = {}) {
    this.command = command;
    this.argv = argv;
    this.options = options;
    this.pending = new Map();
    this.nextId = 0;
    this.disposed = false;
  }
  start() {
    if (this.disposed) throw new Error('BACKEND_DISPOSED');
    if (this.child) return;
    const child = spawn(this.command, this.argv, {
      windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'], ...this.options,
    });
    this.child = child;
    let errorText = '';
    child.stderr.on('data', d => { errorText = (errorText + d).slice(-2000); });
    child.stdin.on('error', () => {});
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      let value;
      try { value = JSON.parse(line.replace(/^\uFEFF/, '')); } catch { return; }
      const item = this.pending.get(value.id);
      if (!item || item.child !== child) return;
      this.pending.delete(value.id);
      item.finish(null, value);
    });
    child.on('error', error => this.reset(error, child));
    child.on('exit', code => this.reset(new Error(`BACKEND_EXIT ${code}: ${errorText}`), child));
  }
  call(action, args = {}, signal, timeoutMs = 30000) {
    signal?.throwIfAborted();
    this.start();
    const child = this.child;
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const cancel = () => this.reset(signal.reason ?? new Error('CANCELLED'), child);
      const timer = setTimeout(() => this.reset(new Error('BACKEND_TIMEOUT'), child), timeoutMs);
      const finish = (error, value) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        error ? reject(error) : resolve(value);
      };
      this.pending.set(id, { child, finish });
      signal?.addEventListener('abort', cancel, { once: true });
      child.stdin.write(`${JSON.stringify({ id, action, args })}\n`, error => {
        if (error) this.reset(error, child);
      });
    });
  }
  reset(error, child = this.child) {
    if (!child) return;
    if (this.child === child) this.child = undefined;
    child.kill();
    for (const [id, item] of this.pending) {
      if (item.child === child) { this.pending.delete(id); item.finish(error); }
    }
  }
  dispose() { this.disposed = true; this.reset(new Error('BACKEND_DISPOSED')); }
}

export function runJson(command, argv, input, signal, timeoutMs = 30000) {
  signal?.throwIfAborted();
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { windowsHide: true, shell: false,
      stdio: ['pipe', 'pipe', 'pipe'], signal: combined });
    let out = ''; let err = '';
    child.stdout.on('data', d => {
      out += d;
      if (out.length > 16 * 1024 * 1024) { child.kill(); reject(new Error('PROTOCOL_TOO_LARGE')); }
    });
    child.stderr.on('data', d => { err = (err + d).slice(-2000); });
    child.on('error', reject);
    child.stdin.on('error', () => {});
    child.on('close', code => {
      if (combined.aborted) return reject(new Error('BACKEND_CANCELLED_OR_TIMEOUT'));
      if (code !== 0) return reject(new Error(`BACKEND_EXIT ${code}: ${err}`));
      try { resolve(JSON.parse(out)); } catch { reject(new Error('BACKEND_INVALID_JSON')); }
    });
    child.stdin.end(input === undefined ? undefined : `${JSON.stringify(input)}\n`);
  });
}
