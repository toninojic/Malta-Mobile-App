import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobileDir = resolve(rootDir, 'apps/mobile');
const args = ['eas-cli@latest', ...process.argv.slice(2)];
const nodeOptions = [process.env.NODE_OPTIONS, '--no-deprecation'].filter(Boolean).join(' ');

const npmExecPath = process.env.npm_execpath;
const npxCliCandidates = [
  npmExecPath?.replace(/npm-cli\.js$/i, 'npx-cli.js'),
  resolve(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js'),
  resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npx-cli.js'),
].filter(Boolean);
const npxCli = npxCliCandidates.find((candidate) => existsSync(candidate));
const command = npxCli ? process.execPath : 'npx';
const commandArgs = npxCli ? [npxCli, ...args] : args;

const child = spawn(command, commandArgs, {
  cwd: mobileDir,
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  shell: false,
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
