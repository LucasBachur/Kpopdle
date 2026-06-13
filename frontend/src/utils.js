import { useState } from 'react';

export function useStats(keyPrefix, mode) {
  const initialStats = {
    gamesPlayed: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedDate: null,
    guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, "5+": 0 }
  };

  const storageKey = `${keyPrefix}_${mode}`;

  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : initialStats;
  });

  function registerGame(attempts) {
    setStats(prev => {
      const today = todayArg();
      let { gamesPlayed, currentStreak, maxStreak, lastPlayedDate, guessDistribution } = prev;

      gamesPlayed++;

      if (lastPlayedDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
        currentStreak = lastPlayedDate === yStr ? currentStreak + 1 : 1;
      } else {
        currentStreak = 1;
      }
      maxStreak = Math.max(maxStreak, currentStreak);

      const key = attempts <= 4 ? attempts : "5+";
      guessDistribution = { ...guessDistribution, [key]: (guessDistribution[key] || 0) + 1 };

      const newStats = { gamesPlayed, currentStreak, maxStreak, lastPlayedDate: today, guessDistribution };
      localStorage.setItem(storageKey, JSON.stringify(newStats));
      return newStats;
    });
  }

  return { stats, registerGame };
}

export function normalizeString(str) {
  return str
    .toLowerCase()
    .replace(/[-:.\s]/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function todayArg(withTime = false) {
  const options = {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  };

  if (withTime) {
    options.hour12 = false;
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.second = '2-digit';
  }

  return new Date().toLocaleString('en-CA', options);
}
