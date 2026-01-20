import { Users, Calculator, Trophy, Settings2, RotateCcw } from 'lucide-react';
import React from 'react';
import { CalculatorParams } from '../../hooks/useSwissCalculator';

interface InputFormProps {
  params: CalculatorParams;
  onUpdate: (key: keyof CalculatorParams, value: string | number) => void;
  onCalculate: () => void;
  onReset: () => void;
}

export const InputForm = React.memo(({ params, onUpdate, onCalculate, onReset }: InputFormProps) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-500" />
            比赛参数
          </h2>
          <button 
            onClick={onReset}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="重置"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4" /> 参与人数
            </label>
            <input
              type="number"
              value={params.participants}
              onChange={(e) => onUpdate('participants', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="请输入参与人数"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Calculator className="w-4 h-4" /> 比赛轮数
            </label>
            <input
              type="number"
              value={params.rounds}
              onChange={(e) => onUpdate('rounds', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="请输入比赛轮数"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Trophy className="w-4 h-4" /> 晋级人数
            </label>
            <input
              type="number"
              value={params.topCut}
              onChange={(e) => onUpdate('topCut', e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="请输入晋级名额"
            />
          </div>

          <button
            onClick={onCalculate}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all active:scale-[0.98] mt-2"
          >
            开始计算
          </button>
        </div>
      </div>
    </div>
  );
});

InputForm.displayName = 'InputForm';
