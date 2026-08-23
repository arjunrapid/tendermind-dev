'use client';

export type ProcessStage = 'uploading' | 'analyzing' | 'done';

const STEPS: { key: ProcessStage; label: string }[] = [
  { key: 'uploading', label: 'Reading document' },
  { key: 'analyzing', label: 'Classifying and running agents' },
  { key: 'done', label: 'Assessment ready' },
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

/** Ingest steps with a thin progress rule, so the user always knows the
 * pipeline is still running and roughly how far along it is - rather than a
 * single opaque spinner for the whole upload+analyze round trip. */
export default function ProcessProgress({ stage, percent }: ProcessProgressProps) {
  const currentIndex = STAGE_ORDER[stage];

  return (
    <div className="mt-6">
      <div className="space-y-2.5">
        {STEPS.map((step) => {
          const stepIndex = STAGE_ORDER[step.key];
          const isComplete =
            stepIndex < currentIndex || (stepIndex === currentIndex && stage === 'done');
          const isCurrent = stepIndex === currentIndex && stage !== 'done';

          return (
            <div key={step.key} className="flex items-center gap-3">
              <span
                className={`font-mono text-[12px] w-3 ${
                  isComplete ? 'text-ok' : isCurrent ? 'text-accent tm-pulse' : 'text-ink-45'
                }`}
              >
                {isComplete ? '✓' : isCurrent ? '●' : '○'}
              </span>
              <span
                className={`text-[13px] ${
                  isComplete ? 'text-ink-60' : isCurrent ? 'text-ink font-medium' : 'text-ink-45'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div className="flex-1 h-[2px] bg-line">
          <div
            className="h-full bg-accent transition-all duration-300 ease-out"
            style={{ width: `${Math.max(4, Math.min(100, percent))}%` }}
          />
        </div>
        <span className="font-mono text-[12px] text-ink-60">{Math.round(percent)}%</span>
      </div>
    </div>
  );
}
