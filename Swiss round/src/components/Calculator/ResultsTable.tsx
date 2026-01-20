import React from 'react';
import { SwissResult } from '../../utils/swiss-logic';

interface ResultsTableProps {
  result: SwissResult;
}

export const ResultsTable = React.memo(({ result }: ResultsTableProps) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
      <h2 className="text-xl font-bold mb-4">详细战绩分布表</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 font-bold">战绩</th>
              <th className="py-2 font-bold">人数</th>
              <th className="py-2 font-bold">晋级</th>
              <th className="py-2 font-bold">概率</th>
            </tr>
          </thead>
          <tbody>
            {result.brackets.map((bracket, idx) => (
              <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="py-3 font-mono">{bracket.wins}-{bracket.losses}</td>
                <td className="py-3">{bracket.count}</td>
                <td className="py-3">{bracket.qualifiedCount}</td>
                <td className="py-3">{bracket.promotionRate.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

ResultsTable.displayName = 'ResultsTable';
