// LLM Worker — runs as a separate process to handle ESM-only node-llama-cpp
// Communicates with parent via stdin/stdout JSON messages

import { getLlama, LlamaChatSession } from 'node-llama-cpp';

let model = null;
let modelName = null;

process.stdin.setEncoding('utf8');

let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (line.trim()) handleMessage(JSON.parse(line));
  }
});

async function handleMessage(msg) {
  try {
    switch (msg.type) {
      case 'load':
        const llama = await getLlama();
        model = await llama.loadModel({ modelPath: msg.modelPath });
        modelName = msg.modelPath.split(/[/\\]/).pop();
        send({ type: 'loaded', modelName });
        break;

      case 'generate':
        if (!model) { send({ type: 'error', error: 'No model loaded' }); break; }
        const ctx = await model.createContext();
        const session = new LlamaChatSession({ contextSequence: ctx.getSequence() });
        const response = await session.prompt(msg.prompt, {
          maxTokens: msg.maxTokens || 200,
          temperature: msg.temperature || 0.3,
        });
        session.dispose();
        ctx.dispose();
        send({ type: 'response', id: msg.id, text: response });
        break;

      case 'status':
        send({ type: 'status', loaded: !!model, modelName });
        break;

      case 'exit':
        if (model) model.dispose?.();
        process.exit(0);
        break;
    }
  } catch (err) {
    send({ type: 'error', id: msg.id, error: err.message });
  }
}

function send(data) {
  process.stdout.write(JSON.stringify(data) + '\n');
}

send({ type: 'ready' });
