import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  parseISO,
  subWeeks,
  addWeeks
} from 'date-fns';
import type { Match, League } from './types';
import './App.css';

const LCK_LEAGUE_ID = '98767991310872058';
const API_KEY = '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) return savedTheme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(LCK_LEAGUE_ID);
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Fetch Leagues
  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const response = await axios.get('https://esports-api.lolesports.com/persisted/gw/getLeagues', {
          params: { hl: 'ko-KR' },
          headers: { 'x-api-key': API_KEY }
        });
        if (response.data && response.data.data && response.data.data.leagues) {
          setLeagues(response.data.data.leagues);
        }
      } catch (err) {
        console.error('Failed to load leagues:', err);
      }
    };
    fetchLeagues();
  }, []);

  // Fetch Schedule when selectedLeagueId changes
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        setLoading(true);
        const response = await axios.get('https://esports-api.lolesports.com/persisted/gw/getSchedule', {
          params: {
            hl: 'ko-KR',
            leagueId: selectedLeagueId
          },
          headers: {
            'x-api-key': API_KEY
          }
        });
        if (response.data && response.data.data && response.data.data.schedule && response.data.data.schedule.events) {
          setMatches(response.data.data.schedule.events);
        } else {
          setMatches([]);
        }
        setError(null);
      } catch (err) {
        console.error(err);
        setError('Failed to load schedule directly from LoL Esports API.');
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [selectedLeagueId]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const nextDate = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const prevDate = () => {
    if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const todayDate = () => {
    setCurrentDate(new Date());
  };

  const renderSidebar = () => {
    return (
      <div className="sidebar">
        <div className="sidebar-header">Leagues</div>
        <div className="league-list">
          {leagues.map((league) => (
            <div 
              key={league.id} 
              className={`league-item ${selectedLeagueId === league.id ? 'active' : ''}`}
              onClick={() => setSelectedLeagueId(league.id)}
            >
              {league.image ? (
                <img src={league.image} alt={league.name} className="league-logo" />
              ) : (
                <div className="league-logo" />
              )}
              <span className="league-name">{league.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHeader = () => {
    const dateFormat = view === 'month' ? 'MMMM yyyy' : 'MMM d, yyyy';
    return (
      <div className="header">
        <div className="header-controls">
          <button className={`btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Month</button>
          <button className={`btn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Week</button>
          <button className="btn" onClick={toggleTheme}>
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
        <div className="month-nav">
          <button className="btn" onClick={prevDate}>&lt; Prev</button>
          <button className="btn" onClick={todayDate}>Today</button>
          <h2>{format(currentDate, dateFormat)}</h2>
          <button className="btn" onClick={nextDate}>Next &gt;</button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const dateFormat = 'EEEE';
    const days = [];
    const startDate = startOfWeek(currentDate);

    for (let i = 0; i < 7; i++) {
      days.push(
        <div className="day-name" key={i}>
          {format(addDays(startDate, i), dateFormat)}
        </div>
      );
    }

    return <div className="days-header">{days}</div>;
  };

  const getMatchesForDay = (day: Date) => {
    return matches.filter(match => isSameDay(parseISO(match.startTime), day));
  };

  const renderMatch = (match: Match) => {
    const inProgress = match.state === 'inProgress';
    const matchData = match.match;
    // Check if any team has won a game or if there's a result structure
    // Sometimes 'completed' state implies a score
    const hasScore = match.state === 'completed' || inProgress;

    return (
      <div className="match-event" key={match.id}>
        <div className="match-time">
          {format(parseISO(match.startTime), 'HH:mm')} - {match.blockName || match.league?.name || 'Match'}
        </div>
        {matchData && matchData.teams && matchData.teams.length === 2 && (
          <div className="match-teams">
            {matchData.teams.map((team, idx) => (
              <div className="team-row" key={team.code || idx}>
                <div className="team-info">
                  {team.image ? <img src={team.image} alt={team.code} className="team-logo" /> : <div className="team-logo" />}
                  <span className="team-code">{team.code}</span>
                </div>
                <span className={`team-score ${match.state === 'completed' ? (team.result?.outcome === 'win' ? 'win' : 'loss') : ''}`}>
                  {hasScore ? (team.result?.gameWins ?? '-') : '-'}
                </span>
              </div>
            ))}
          </div>
        )}
        {inProgress && <div className="match-status live">LIVE</div>}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const formattedDate = format(day, 'd');
        const cloneDay = day;
        const dayMatches = getMatchesForDay(cloneDay);

        days.push(
          <div
            className={`calendar-cell ${!isSameMonth(day, monthStart) ? 'empty-cell' : ''} ${isSameDay(day, new Date()) ? 'today' : ''}`}
            key={day.toString()}
          >
            <span className="date-number">{formattedDate}</span>
            <div className="events-container">
              {dayMatches.map(renderMatch)}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="calendar-body" key={day.toString()}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="calendar-grid">{rows}</div>;
  };

  const renderWeeklyView = () => {
    const startDate = startOfWeek(currentDate);
    const days = [];

    for (let i = 0; i < 7; i++) {
      const day = addDays(startDate, i);
      const dayMatches = getMatchesForDay(day);

      days.push(
        <div className={`weekly-day ${isSameDay(day, new Date()) ? 'today' : ''}`} key={day.toString()}>
          <div className="weekly-day-header">
            {format(day, 'EEE, MMM d')}
          </div>
          <div className="events-container">
            {dayMatches.length > 0 ? dayMatches.map(renderMatch) : <div className="match-time">No matches</div>}
          </div>
        </div>
      );
    }

    return <div className="weekly-grid">{days}</div>;
  };

  return (
    <div className="app-container">
      {renderSidebar()}
      <div className="main-content">
        {renderHeader()}
        {loading ? (
          <div className="loading">Loading schedule...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : view === 'month' ? (
          <div className="calendar-grid">
            {renderDays()}
            {renderCells()}
          </div>
        ) : (
          renderWeeklyView()
        )}
      </div>
    </div>
  );
};

export default App;
