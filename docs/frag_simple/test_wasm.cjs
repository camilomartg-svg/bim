const OBC = require('@thatopen/components');
const FRAGS = require('@thatopen/fragments');
const WebIFC = require('web-ifc');

async function test() {
  console.log('Testing single-thread web-ifc...');
  const api = new WebIFC.IfcAPI();
  api.SetWasmPath('https://unpkg.com/web-ifc@0.0.77/', true);
  await api.Init(undefined, true);
  console.log('Init success! wasmModule:', !!api.wasmModule);
  console.log('Version:', api.GetVersion());
}

test().catch(err => {
  console.error('Test error:', err);
});
