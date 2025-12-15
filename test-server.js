// Quick test to verify MCP server starts and responds
import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';

server.stdout.on('data', (data) => {
  output += data.toString();
  // Look for MCP initialization message
  try {
    const lines = output.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const msg = JSON.parse(line);
      if (msg.result && msg.result.tools) {
        console.log('✅ MCP Server Response Received');
        console.log(`✅ Tools registered: ${msg.result.tools.length}`);
        console.log('\nTool names:');
        msg.result.tools.forEach(t => console.log(`  - ${t.name}`));
        server.kill();
        process.exit(0);
      }
    }
  } catch (e) {
    // Not JSON yet, keep accumulating
  }
});

server.stderr.on('data', (data) => {
  console.error('Server stderr:', data.toString());
});

server.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Server exited with code ${code}`);
    process.exit(1);
  }
});

// Send ListTools request
const request = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
});

server.stdin.write(request + '\n');

// Timeout after 5 seconds
setTimeout(() => {
  console.error('❌ Timeout - no response from server');
  server.kill();
  process.exit(1);
}, 5000);
