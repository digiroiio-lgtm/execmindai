import { promises as fs } from 'fs';
import path from 'path';
import { TaskItem } from '../types/data';

export class TaskHistoryStore {
  private tasks: TaskItem[] = [];

  constructor(private filePath: string) {}

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.tasks = (JSON.parse(raw) as TaskItem[]) ?? [];
    } catch (err) {
      this.tasks = [];
      await this.persist();
    }
  }

  async persist() {
    await fs.writeFile(this.filePath, JSON.stringify(this.tasks, null, 2), 'utf-8');
  }

  list(): TaskItem[] {
    return [...this.tasks];
  }

  snapshot(): TaskItem[] {
    return JSON.parse(JSON.stringify(this.tasks));
  }

  async record(task: TaskItem) {
    this.tasks.push(task);
    await this.persist();
  }

  async reset() {
    this.tasks = [];
    await this.persist();
  }
}
