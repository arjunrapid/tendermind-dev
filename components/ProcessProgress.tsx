'use client';

export type ProcessStage = 'uploading' | 'analyzing' | 'done';

const STEPS: { key: ProcessStage; label: string }[] = [
  { key: 'uploading', label: 'Uploading document' },
  { key: 'analyzing', label: 'Analyzing (classification + agents)' },
  { key: 'done', label: 'Results ready' },
];

const STAGE_ORDER: Record<ProcessStage, number> = {
  uploading: 0,
  analyzing: 1,
  done: 2,
};

interface ProcessProgressProps {
  stage: ProcessStage;
  /** 0-100. Real (byte-based) during upload, simulated during analysis
   * since that call has no server-sent progress. */
  percent: number;
}

/** Shows overall progress from file upload through to analysis results,
 * so the user always knows the pipeline is still running and roughly how
 * far along it is - rather than a single opaque spinner for the whole
 * upload+analyze round trip. */
export default function ProcessProgress({ stage, percent }: ProcessProgressProps) {
  const currentIndex = STAGE_ORDER[stage];

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {STEPS.map((step, idx) => {
            const stepIndex = STAGE_ORDER[step.key];
            const isComplete = stepIndex < currentIndex || (stepIndex === currentIndex && stage === 'done');
            const isCurrent = stepIndex === currentIndex && stage !== 'done';

            return (
              <span
                key={step.key}
                className={`text-sm font-medium flex items-center gap-1.5 ${
                  isComplete
                    ? 'text-green-600 dark:text-green-400'
                    : isCurrent
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                <span>
                  {isComplete ? '✅' : isCurrent ? '⏳' : '○'}
                </span>
                {step.label}
                {idx < STEPS.length - 1 && <span className="text-gray-300 ml-4">→</span>}
              </span>
            );
          })}
        </div>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{Math.round(percent)}%</span>
      </div>

      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}
