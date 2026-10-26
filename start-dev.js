import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('----------------------------------------------------');
console.log('🚀 Starting ML Challenge Platform (Full-Stack Dev) ...');
console.log('----------------------------------------------------');

// Start Express Backend
const server = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit',
  shell: true
});

// Start Vite Frontend
const client = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'client'),
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\nStopping servers...');
  server.kill();
  client.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
