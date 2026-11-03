import { detectIssues, type Conversation, type Issue } from './detect.ts';

export type IssueDetector = (conversation: Conversation) => Issue[] | Promise<Issue[]>;

export interface EngineStatus {
  id?: string;
  choices?: { id: string; name: string }[];
  mode: 'rules' | 'model';
  name: string;
  version?: string;
  ready: boolean;
}

export interface EvaluationEngine {
  detect: IssueDetector;
  status(): Promise<EngineStatus>;
}

// Normal app/deployment behaviour stays opt-in-free and deterministic.
export const rulesEngine: EvaluationEngine = {
  detect: detectIssues,
  status: async () => ({ mode: 'rules', name: 'Deterministic rules', ready: true }),
};
