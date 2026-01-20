import { useState } from 'react'
import { Trophy, Coins } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSwissCalculator } from './hooks/useSwissCalculator'
import { InputForm } from './components/Calculator/InputForm'
import { StatsSummary } from './components/Calculator/StatsSummary'
import { DistributionChart } from './components/Calculator/DistributionChart'
import { ResultsTable } from './components/Calculator/ResultsTable'
import CoinToss from './components/CoinToss'

function App() {
  const [view, setView] = useState<'calculator' | 'cointoss'>('calculator')
  const { params, result, updateParam, handleCalculate, handleReset } = useSwissCalculator();

  return (
    <AnimatePresence mode="wait">
      {view === 'cointoss' ? (
        <motion.div
          key="cointoss"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <CoinToss onBack={() => setView('calculator')} />
        </motion.div>
      ) : (
        <motion.div
          key="calculator"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8 transition-colors relative"
        >
          {/* 投硬币入口按钮 */}
          <div className="absolute top-4 left-4 md:top-8 md:left-8">
            <button
              onClick={() => setView('cointoss')}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-200 dark:shadow-none hover:shadow-indigo-300 active:scale-95 group"
            >
              <Coins className="w-5 h-5 transition-transform group-hover:rotate-12" />
              <span>投硬币</span>
            </button>
          </div>

          <header className="max-w-3xl mx-auto mb-10 text-center">
            <div className="inline-flex items-center justify-center p-3 mb-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl">
              <Trophy className="text-yellow-600 dark:text-yellow-500 w-10 h-10" />
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3">
              瑞士轮比赛计算器
            </h1>
          </header>

          <main className="max-w-3xl mx-auto space-y-8">
            {/* Input Section */}
            <InputForm 
              params={params} 
              onUpdate={updateParam}
              onCalculate={handleCalculate} 
              onReset={handleReset} 
            />

            {/* Results Section */}
            <div className="space-y-6">
              <StatsSummary result={result} />
              <DistributionChart result={result} />
              <ResultsTable result={result} />
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default App
