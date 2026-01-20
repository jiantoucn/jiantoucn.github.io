import React from 'react';
import { BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { SwissResult } from '../../utils/swiss-logic';

interface DistributionChartProps {
  result: SwissResult;
}

export const DistributionChart = React.memo(({ result }: DistributionChartProps) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-indigo-500" />
        战绩分布可视化
      </h2>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={result.brackets}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="wins" 
              tickFormatter={(val) => `${val}胜`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              cursor={{fill: 'transparent'}}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl">
                      <p className="font-bold mb-1">{data.wins}胜 - {data.losses}负</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">人数: {data.count}</p>
                      <p className="text-sm text-indigo-600 font-medium">晋级率: {data.promotionRate.toFixed(1)}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {result.brackets.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.promotionRate === 100 ? '#4f46e5' : entry.promotionRate > 0 ? '#f97316' : '#94a3b8'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-6 text-xs font-medium">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
          <span>100% 晋级</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span>部分晋级 (博弈)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-400"></div>
          <span>未晋级</span>
        </div>
      </div>
    </div>
  );
});

DistributionChart.displayName = 'DistributionChart';
