let serviceStarted = false;

const FLOW_REFERENCE = 'FLOW.md';

/**
 * Bootstraps the ExecMindAI runtime scaffold and ensures the
 * existing suggestion service starts exactly once.
 */
export async function bootstrapSystem() {
  console.log('Initializing ExecMindAI execution skeleton…');
  console.log(`Referencing decision flow: ${FLOW_REFERENCE}`);

  await startSuggestionService();
}

async function startSuggestionService() {
  if (serviceStarted) {
    console.log('Suggestion service already initialized.');
    return;
  }

  serviceStarted = true;
  console.log('Starting suggestion service (SSE + feedback) …');

  await import('./server.js');
  console.log('Suggestion service available.');
}
