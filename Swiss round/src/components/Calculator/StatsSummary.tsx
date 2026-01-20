import React from 'react';
import { SwissResult } from '../../utils/swiss-logic';

interface StatsSummaryProps {
  result: SwissResult;
}

export const StatsSummary = React.memo(({ result }: StatsSummaryProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <p className="text-sm text-slate-500 mb-1">晋级比例</p>
        <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
          {((result.topCut / (result.totalParticipants || 1)) * 100).toFixed(1)}%
        </p>
      </div>
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <p className="text-sm text-slate-500 mb-1">稳进线 (100%)</p>
        <p className="text-2xl font-black text-green-600 dark:text-green-500">
          {result.guaranteedWins} 胜
        </p>
      </div>
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <p className="text-sm text-slate-500 mb-1">晋级博弈线</p>
        <p className="text-2xl font-black text-orange-600 dark:text-orange-500">
          {result.promotionLine} 胜
        </p>
      </div>
    </div>
  );
});

StatsSummary.displayName = 'StatsSummary';
