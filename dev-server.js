const { spawn } = require('child_process');
const path = require('path');

const viteDir = path.resolve(__dirname, 'Interface', 'tech-&-ai');
const viteBin = path.join(viteDir, 'node_modules', 'vite', 'bin', 'vite.js');

const proc = spawn('node', [viteBin, '--port', '3000'], {
    cwd: viteDir,
    stdio: 'inherit',
    shell: false,
});

proc.on('exit', (code) => process.exit(code));
