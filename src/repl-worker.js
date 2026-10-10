import { parentPort } from 'node:worker_threads';
import { PassThrough } from 'node:stream';
import { start } from 'node:repl';
import { inspect } from 'node:util';

const pending = new Map(); let nextId = 0;
const serialize = value => { try { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); } catch { return inspect(value, { depth: 3 }); } };
const call = (method, args) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject }); parentPort.postMessage({ type: 'rpc', id, method, args: serialize(args) });
});
const output = value => parentPort.postMessage({ type: 'output', value: serialize(value) });
const appMethods = ['getAXState', 'getScreenshot', 'getAXStateAndScreenshot', 'click', 'typeText', 'paste',
  'pressKey', 'scroll', 'drag', 'setValue', 'invoke', 'activate', 'ocr'];
const cua = {
  getState: () => call('getState', []), listWindows: () => call('listWindows', []), listApps: () => call('listApps', []),
  async getApp(selector) {
    const { appId, target } = await call('getApp', [selector]);
    return Object.assign({ id: target.id, target, toJSON: () => ({ id: target.id, target }) },
      Object.fromEntries(appMethods.map(method => [method, (...args) => call(method, [appId, ...args])])));
  },
};
const repl = start({ input: new PassThrough(), output: new PassThrough(), terminal: false, prompt: '', ignoreUndefined: true });
let activeEvaluation = false;
const finish = message => { if (activeEvaluation) { activeEvaluation = false; parentPort.postMessage({ type: 'done', ...message }); } };
// Node's built-in REPL reports runtime errors through its domain instead of
// the eval callback. Cover that path so failed awaited actions return promptly.
repl._domain.on('error', error => finish({ error: error.message }));
Object.assign(repl.context, { cua, computer: cua, nodeRepl: { write: output, emitImage: async value => output(value) },
  console: { log: (...values) => output(values.map(value => typeof value === 'string' ? value : inspect(value)).join(' ')),
    error: (...values) => output(values.map(String).join(' ')), warn: (...values) => output(values.map(String).join(' ')) } });
parentPort.on('message', message => {
  if (message.type === 'rpc-result') {
    const waiter = pending.get(message.id); pending.delete(message.id);
    if (message.error) waiter?.reject(new Error(message.error)); else waiter?.resolve(message.value);
  } else if (message.type === 'eval') {
    activeEvaluation = true;
    repl.eval(message.code, repl.context, 'computer.js', async (error, value) => {
      try { finish(error ? { error: error.message } : { value: serialize(await value) }); }
      catch (failure) { finish({ error: failure.message }); }
    });
  }
});
