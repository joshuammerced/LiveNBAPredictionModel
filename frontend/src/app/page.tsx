"use client";

import React from 'react';
import {motion} from 'framer-motion';
// This is your mock data "contract"
const MOCK_PREDICTION = {
  home_team: "Golden State Warriors",
  away_team: "Los Angeles Lakers",
  win_prob: 0.92,
  home_player: {
    team: "Golden State Warriors",
    name: "Joshua Mathew",
    pts: 50.4,
    ast: 11.1,
    reb: 18.5,
    efg: "58.2%"
  },
  away_player: {
    team: "Los Angeles Lakers",
    name: "LeBron James",
    pts: 48.2,
    ast: 9.3,
    reb: 12.1,
    efg: "55.8%"
  }
};

interface HoverBoxProps {
  children: React.ReactNode;
}

export function HoverBox({ children }: HoverBoxProps) {
  return (
    <motion.div 
      whileHover={{ scale: 1.05, borderColor: "#f97316" }} // Scale up and turn border orange
      // transition={{ type: "spring", stiffness: 200 }}      // Makes it feel "bouncy" like a game UI
      // className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl cursor-pointer"
    >
      {children}
    </motion.div>
  );
}

interface PlayerType {
  team: string;
  name: string;
  pts: number;
  ast: number;
  reb: number;
  efg: string;
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
            <p className="text-xl font-bold">{player.pts}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs">AST</p>
            <p className="text-xl font-bold">{player.ast}</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs">REB</p>
            <p className="text-xl font-bold">{player.reb}</p>
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
  return (
    <main className="min-h-screen bg-black text-white p-8 font-sans">
      {/* Header Section */}
      <header className="mb-12 border-b border-zinc-800 pb-6">
        <h1 className="text-4xl font-black tracking-tighter italic">NBA PREDICT <span className="text-orange-300">v1.0</span></h1>
        <p className="text-zinc-400 mt-2 uppercase tracking-widest text-xs font-bold">Machine Learning Game Insights</p>
      </header>

      {/* Hero Matchup Card */}
          <HoverBox>
        <section className="max-w-4xl mx-auto bg-zinc-900 rounded-3xl p-10 border border-zinc-800 shadow-2xl">
          <div className="flex justify-between items-center mb-10">
            <div className="text-center">
              <h2 className="text-3xl font-bold">{MOCK_PREDICTION.away_team}</h2>
              <p className="text-zinc-500 font-bold mt-2">AWAY</p>
          </div>
          
          <div className="text-6xl font-black text-zinc-700 italic">VS</div>
          
          <div className="text-center">
            <h2 className="text-3xl font-bold text-orange-300">{MOCK_PREDICTION.home_team}</h2>
            <p className="text-zinc-500 font-bold mt-2">HOME</p>
          </div>
        </div>
        

        {/* Win Probability Bar */}
        <div className="w-full bg-zinc-800 h-4 rounded-full overflow-hidden flex">
          <div 
            className="bg-orange-300 h-full transition-all duration-1000" 
            style={{ width: `${MOCK_PREDICTION.win_prob * 100}%` }}
          />
        </div>
        <p className="text-center mt-4 font-mono text-zinc-400">
          WIN PROBABILITY: <span className="text-white font-bold">{(MOCK_PREDICTION.win_prob * 100).toFixed(0)}%</span>
        </p>
      </section>
        </HoverBox>


      {/* Featured Player Section */}
      <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <PlayerCard player={MOCK_PREDICTION.away_player} />
        <PlayerCard player={MOCK_PREDICTION.home_player} />
      </section>
    </main>
  );
}