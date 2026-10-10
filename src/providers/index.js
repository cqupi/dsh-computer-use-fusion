import { WindowsProvider } from './windows.js';
import { MacOSProvider } from './macos.js';
import { CuaProvider } from './cua.js';

export function createProvider(config = {}, platform = process.platform) {
  if (config.backend === 'cua') return new CuaProvider(config);
  if (config.backend === 'windows' || (config.backend !== 'macos' && platform === 'win32')) return new WindowsProvider(config);
  if (config.backend === 'macos' || platform === 'darwin') return new MacOSProvider(config);
  throw new Error('UNSUPPORTED_PLATFORM: set backend=cua after installing cua-driver; Linux is experimental');
}
