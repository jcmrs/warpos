// Test task_instance_get error message for non-existent instance
import { spawn } from 'child_process';

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let requestId = 0;

server.stdout.on('data', (data) => {
  output += data.toString();
  try {
    const lines = output.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const msg = JSON.parse(line);

      // Response to tools/list
      if (msg.id === 1 && msg.result) {
        console.log('✅ Server initialized');

        // Now call task_instance_get with non-existent instance
        const toolRequest = JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'task_instance_get',
            arguments: {
              project_slug: 'test-project',
              instance_id: 'nonexistent-instance-uuid'
            }
          }
        });
        server.stdin.write(toolRequest + '\n');
      }

      // Response to tool call
      if (msg.id === 2) {
        if (msg.result) {
          console.log('❌ Tool should have failed but succeeded');
          console.log('Response:', JSON.stringify(msg.result, null, 2));
        }
        if (msg.error) {
          console.log('✅ Tool failed as expected');
          console.log('Error message:', msg.error.message);

          // Check if error message is user-friendly
          if (msg.error.message.includes('not found') && !msg.error.message.includes('ENOENT')) {
            console.log('✅ Error message is user-friendly (no ENOENT exposed)');
          } else {
            console.log('❌ Error message still exposes implementation details');
          }
        }
        server.kill();
        process.exit(0);
      }
    }
  } catch (e) {
    // Not complete JSON yet
  }
});

server.stderr.on('data', (data) => {
  console.error('Server stderr:', data.toString());
});

// Send initial tools/list
const listRequest = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/list',
  params: {}
});

server.stdin.write(listRequest + '\n');

setTimeout(() => {
  console.error('❌ Timeout');
  server.kill();
  process.exit(1);
}, 5000);
