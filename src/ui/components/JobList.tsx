import { h } from 'preact';
import type { Job } from '../../core/jobs';

interface JobListProps {
  jobs: Job[];
}

const JobList = ({ jobs }: JobListProps) => (
  <div class="job-list">
    {jobs.map((job) => (
      <div key={job.id} class="job">
        <div class="inline" style={{ justifyContent: 'space-between' }}>
          <strong>{job.title}</strong>
          <span class="badge">{job.status}</span>
        </div>
        <div class="progress">
          <span style={{ width: `${Math.round(job.progress * 100)}%` }}></span>
        </div>
        {job.error && <div class="helper">{job.error}</div>}
      </div>
    ))}
  </div>
);

export default JobList;
