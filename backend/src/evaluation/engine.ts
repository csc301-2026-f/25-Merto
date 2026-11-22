import { HttpError } from '../errors.ts';
import { detectIssues, type Conversation, type Issue } from './detect.ts';

export type IssueDetector = (conversation: Conversation) => Issue[] | Promise<Issue[]>;

export interface EngineStatus {
  id?: string;
  choices?: { id: string; name: string }[];
  mode: 'rules' | 'model';
  name: string;
  version?: string;
  ready: boolean;
  scope?: 'local' | 'hosted';
}

export interface EvaluationEngine {
  detect: IssueDetector;
  status(): Promise<EngineStatus>;
  // A model's probability for each wording signal of one message. The rules have none.
  score?(side: 'ai' | 'buyer', text: string): Promise<Record<string, number>>;
}

// Normal app/deployment behaviour stays opt-in-free and deterministic.
export const rulesEngine: EvaluationEngine = {
  detect: detectIssues,
  status: async () => ({ mode: 'rules', name: 'Deterministic rules', ready: true }),
};

// The version saved with a run's results: null for the deterministic rules. A
// model run must name its version, so GM reviews can be traced to the model
// that made (or missed) each flag.
export async function runVersion(engine: EvaluationEngine): Promise<string | null> {
  const status = await engine.status();
  if (status.mode === 'rules') return null;
  if (!status.version?.trim()) {
    throw new HttpError(503, 'The model service did not report its version. No evaluation was saved.');
  }
  return status.version;
}
