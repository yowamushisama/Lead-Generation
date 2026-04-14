// Domain models
export * from './lead';
export * from './message';
export * from './analytics';
export * from './auth';
export * from './campaign';
export * from './icp';
export * from './conversation';
export * from './prompt-config';

// Structural interfaces — re-exported for backward-compat (`import ... from '@/models'` still works)
export * from '../interfaces/common';
export * from '../interfaces/health';
export * from '../interfaces/pipeline';
