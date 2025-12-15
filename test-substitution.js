// Test variable substitution directly
import { TaskExecutor } from './dist/taskExecutor.js';

const executor = new TaskExecutor();

// Test the private method via a simple test
const testTemplate = "File: src/routes/{resource}.routes.js\nDefine {http_method} {endpoint_path} route\nPurpose: {description}";
const testInputs = {
  endpoint_path: "/api/todos",
  http_method: "GET",
  description: "List all TODO items",
  resource: "todos"
};

// Since substituteVariables is private, we'll test via prepareTask
async function test() {
  try {
    const plan = await executor.prepareTask('todo-api', 'c42cf3e4-57f3-43f1-9f23-6af93c9b383a');
    console.log('✅ Plan generated');
    console.log('\nFirst step instruction:');
    console.log(plan.steps[0].instruction);
    console.log('\nVerification command:');
    console.log(plan.verification[0].command);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

test();
