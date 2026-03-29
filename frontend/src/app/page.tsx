"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface PlayerType {
  team: string;
  name: string;
  pts_per_game: number;
  ast_per_game: number;
  reb_per_game: number;
  efg: string;
}

interface PredictionType {
  home_team: string;
  away_team: string;
  game_time: string;
  win_prob: number;
  home_player: PlayerType | null;
  away_player: PlayerType | null;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export function HoverBox({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, borderColor: '#f97316' }}
      className="transition-all"
    >
      {children}
    </motion.div>
  );
}

function PlayerCard({ player }: { player: PlayerType }) {
  return (
    <HoverBox>
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <h3 className="text-zinc-500 uppercase text-xs font-black tracking-widest mb-4">{player.team}: MVP</h3>
        <h4 className="text-2xl font-bold mb-4">{player.name}</h4>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-zinc-500 text-xs">PTS</p>
            <p className="text-xl font-bold">{player.pts_per_game.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs">AST</p>
            <p className="text-xl font-bold">{player.ast_per_game.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs">REB</p>
            <p className="text-xl font-bold">{player.reb_per_game.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs">eFG%</p>
            <p className="text-xl font-bold text-green-400">{player.efg}</p>
          </div>
        </div>
      </div>
    </HoverBox>
  );
}

export default function Dashboard() {
  const [predictions, setPredictions] = useState<PredictionType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingTime, setLoadingTime] = useState<number>(0);

  useEffect(() => {
    async function fetchPredictions() {
      const startTime = Date.now();
      const interval = setInterval(() => {
        setLoadingTime(Date.now() - startTime);
      }, 100);
      try {
        const res = await fetch(`${API_URL}/predictions`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const data: PredictionType[] = await res.json();
        setPredictions(data);
        setIsLoading(false);
        clearInterval(interval);
        setLoadingTime(Date.now() - startTime);
      } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
        clearInterval(interval);
      }
    }

    fetchPredictions();
  }, []);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? predictions.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === predictions.length - 1 ? 0 : prev + 1));
  };

  if (error) {
    return <main className="min-h-screen bg-black text-white p-8">Error: {error}</main>;
  }

  if (isLoading) {
    return <main className="min-h-screen bg-black text-white p-8">Loading upcoming games... ({(loadingTime / 1000).toFixed(1)}s)</main>;
  }

  if (predictions.length === 0) {
    return <main className="min-h-screen bg-black text-white p-8">No games today. Come back tomorrow!</main>;
  }

  const currentPrediction = predictions[currentIndex];

  return (
    <main className="min-h-screen bg-black text-white p-8 font-sans">
      <header className="mb-12 border-b border-zinc-800 pb-6">
        <h1 className="text-4xl font-black tracking-tighter italic">NBA PREDICT <span className="text-orange-300">v1.0</span></h1>
        <p className="text-zinc-400 mt-2 uppercase tracking-widest text-xs font-bold">Machine Learning Game Insights</p>
        <p className="text-zinc-500 mt-1 text-sm">Game {currentIndex + 1} of {predictions.length}</p>
      </header>

      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <HoverBox>
          <section className="max-w-5xl mx-auto bg-zinc-900 rounded-3xl p-16 border border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center mb-12">
              <button
                onClick={goToPrevious}
                className="text-zinc-400 hover:text-white text-4xl font-bold px-6 py-4 bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
              >
                ‹
              </button>
              <div className="text-center flex-1 px-6 flex flex-col items-center">
                <h2 className="text-5xl font-bold">{currentPrediction.away_team}</h2>
                <p className="text-zinc-500 font-bold mt-4 uppercase tracking-widest">AWAY</p>
              </div>
              <div className="text-center flex-1 px-6">
                <div className="text-7xl font-black text-zinc-700 italic">VS</div>
                <p className="text-orange-400 text-md font-bold mt-6 uppercase tracking-widest">{currentPrediction.game_time}</p>
              </div>
              <div className="text-center flex-1 px-6 flex flex-col items-center">
                <h2 className="text-5xl font-bold text-orange-300">{currentPrediction.home_team}</h2>
                <p className="text-zinc-500 font-bold mt-4 uppercase tracking-widest">HOME</p>
              </div>
              <button
                onClick={goToNext}
                className="text-zinc-400 hover:text-white text-4xl font-bold px-6 py-4 bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
              >
                ›
              </button>
            </div>
            <div className="w-full bg-zinc-800 h-6 rounded-full overflow-hidden flex">
              <div className="bg-orange-300 h-full transition-all duration-1000" style={{ width: `${currentPrediction.win_prob * 100}%` }} />
            </div>
            <p className="text-center mt-6 font-mono text-zinc-400 text-lg">
              WIN PROBABILITY: <span className="text-white font-bold">{(currentPrediction.win_prob * 100).toFixed(0)}%</span>
            </p>
          </section>
        </HoverBox>
      </motion.div>

      <section className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {currentPrediction.away_player && <PlayerCard player={currentPrediction.away_player} />}
        {currentPrediction.home_player && <PlayerCard player={currentPrediction.home_player} />}
      </section>
    </main>
  );
}
