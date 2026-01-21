import path from 'path';
import { ContextStore } from './ContextStore';
import { DecisionLog } from './DecisionLog';
import { TaskHistoryStore } from './TaskHistoryStore';

const DATA_DIR = path.resolve(
  process.env.EXECMIND_DATA_DIR ?? path.resolve(__dirname, '../data')
);

export const contextStore = new ContextStore(path.join(DATA_DIR, 'context_store.json'));
export const decisionLog = new DecisionLog(path.join(DATA_DIR, 'decision_records.json'));
export const taskHistoryStore = new TaskHistoryStore(path.join(DATA_DIR, 'task_history.json'));

export async function initializeStores() {
  await Promise.all([
    contextStore.initialize(),
    decisionLog.initialize(),
    taskHistoryStore.initialize()
  ]);
}
