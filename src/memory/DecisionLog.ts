import { promises as fs } from 'fs';
import path from 'path';
import { DecisionRecord } from '../types/data';

const nowIso = () => new Date().toISOString();

export class DecisionLog {
  private records: DecisionRecord[] = [];

  constructor(private filePath: string) {}

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.records = (JSON.parse(raw) as DecisionRecord[]) ?? [];
    } catch (err) {
      this.records = [];
      await this.persist();
    }
  }

  async persist() {
    await fs.writeFile(this.filePath, JSON.stringify(this.records, null, 2), 'utf-8');
  }

  list(): DecisionRecord[] {
    return [...this.records];
  }

  snapshot(): DecisionRecord[] {
    return JSON.parse(JSON.stringify(this.records));
  }

  async record(record: DecisionRecord) {
    this.records.push(record);
    await this.persist();
  }

  async touch(decisionId: string, updates: Partial<DecisionRecord>) {
    let entry = this.records.find((item) => item.decisionId === decisionId);
    if (!entry) {
      entry = {
        decisionId,
        decisionType: 'task',
        primaryTime: nowIso(),
        description: 'auto-created',
        priorityHint: 'contextual',
        confidence: 0.5,
        status: 'proposed',
        createdAt: nowIso(),
        ...updates
      } as DecisionRecord;
      this.records.push(entry);
    } else {
      Object.assign(entry, updates);
    }
    await this.persist();
    return entry;
  }

  async get(decisionId: string) {
    return this.records.find((record) => record.decisionId === decisionId);
  }

  async reset() {
    this.records = [];
    await this.persist();
  }
}
