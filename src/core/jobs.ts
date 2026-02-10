import type { ConversionResult } from './types';

export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

export interface Job {
  id: string;
  title: string;
  status: JobStatus;
  progress: number;
  outputs: ConversionResult[];
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export const createJob = (title: string): Job => ({
  id: crypto.randomUUID(),
  title,
  status: 'queued',
  progress: 0,
  outputs: []
});
