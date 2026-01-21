import { promises as fs } from 'fs';
import path from 'path';
import config from '../config';
import { ContextEntry, TravelStatus } from '../types/data';

const nowIso = () => new Date().toISOString();

export class ContextStore {
  private entries: ContextEntry[] = [];

  constructor(private filePath: string) {}

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.entries = (JSON.parse(raw) as ContextEntry[]) ?? [];
    } catch (err) {
      this.entries = [];
      await this.persist();
    }
  }

  async persist() {
    await fs.writeFile(this.filePath, JSON.stringify(this.entries, null, 2), 'utf-8');
  }

  list(): ContextEntry[] {
    return this.entries;
  }

  snapshot(): ContextEntry[] {
    return this.entries.map((entry) => ({
      ...entry,
      suggestionHistory: [...entry.suggestionHistory],
      relatedDecisions: [...entry.relatedDecisions]
    }));
  }

  find(tag: string): ContextEntry | undefined {
    return this.entries.find((entry) => entry.contextTag === tag);
  }

  async reset() {
    this.entries = [];
    await this.persist();
  }

  async bumpContext(
    tag: string,
    options: { decisionId?: string; suggestionId?: string; travelStatus?: TravelStatus } = {}
  ) {
    const now = nowIso();
    let entry = this.find(tag);
    if (!entry) {
      entry = {
        contextTag: tag,
        lastMentionedAt: now,
        relatedDecisions: [],
        travelStatus: options.travelStatus ?? null,
        momentumScore: 0,
        silenceUntil: null,
        suggestionHistory: []
      };
      this.entries.push(entry);
    }

    entry.lastMentionedAt = now;
    entry.momentumScore = Math.min(5, entry.momentumScore + 1);
    if (options.decisionId && !entry.relatedDecisions.includes(options.decisionId)) {
      entry.relatedDecisions.push(options.decisionId);
    }

    if (options.travelStatus) {
      entry.travelStatus = options.travelStatus;
    }

    if (options.suggestionId) {
      entry.suggestionHistory = entry.suggestionHistory.filter((item) => {
        const age = Date.now() - new Date(item.sentAt).getTime();
        return age <= config.suggestion.contextRetentionHours * 60 * 60 * 1000;
      });
      entry.suggestionHistory.push({ suggestionId: options.suggestionId, sentAt: now });
    }

    await this.persist();
    return entry;
  }

  async adjustMomentum(tag: string, delta: number) {
    const entry = this.find(tag);
    if (!entry) {
      return null;
    }
    entry.momentumScore = Math.min(5, Math.max(0, entry.momentumScore + delta));
    await this.persist();
    return entry;
  }

  async setSilence(tag: string, silenceUntil: string | null) {
    const entry = this.find(tag);
    if (!entry) {
      return null;
    }
    entry.silenceUntil = silenceUntil;
    await this.persist();
    return entry;
  }

  async getMutedContexts(now = Date.now()) {
    return this.entries.filter(
      (entry) => entry.silenceUntil && new Date(entry.silenceUntil).getTime() > now
    );
  }
}
