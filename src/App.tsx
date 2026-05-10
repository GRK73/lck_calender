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
  
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768;
    }
    return false;
  });

  const [view, setView] = useState<'month' | 'week'>(isMobile ? 'week' : 'month');

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setView('week'); // Mobile forces week logic
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) return savedTheme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });

  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<string[]>([LCK_LEAGUE_ID]);
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Mobile Modal State
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

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

  // Fetch Schedule when selectedLeagueIds changes
  useEffect(() => {
    const fetchSchedule = async () => {
      if (selectedLeagueIds.length === 0) {
        setMatches([]);
        return;
      }
      try {
        setLoading(true);
        const promises = selectedLeagueIds.map(id =>
          axios.get('https://esports-api.lolesports.com/persisted/gw/getSchedule', {
            params: { hl: 'ko-KR', leagueId: id },
            headers: { 'x-api-key': API_KEY }
          })
        );
        const responses = await Promise.all(promises);
        
        let allMatches: Match[] = [];
        responses.forEach(response => {
          if (response.data && response.data.data && response.data.data.schedule && response.data.data.schedule.events) {
            allMatches = [...allMatches, ...response.data.data.schedule.events];
          }
        });
        
        // Sort matches by time
        allMatches.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        
        setMatches(allMatches);
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
  }, [selectedLeagueIds]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const nextDate = () => {
    if (view === 'month' && !isMobile) {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const prevDate = () => {
    if (view === 'month' && !isMobile) {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const todayDate = () => {
    setCurrentDate(new Date());
  };

  const toggleLeague = (id: string) => {
    setSelectedLeagueIds(prev =>
      prev.includes(id) ? prev.filter(lId => lId !== id) : [...prev, id]
    );
  };

  const getMatchesForDay = (day: Date) => {
    return matches.filter(match => isSameDay(parseISO(match.startTime), day));
  };

  const renderMatchCard = (match: Match) => {
    const inProgress = match.state === 'inProgress';
    const matchData = match.match;
    const hasScore = match.state === 'completed' || inProgress;

    return (
      <div className="match-card" key={match.id}>
        <div className="match-card-header">
          <span className="match-league">[{match.league?.name}]</span>
          <span className="match-time">{format(parseISO(match.startTime), 'HH:mm')}</span>
        </div>
        <div className="match-card-block">{match.blockName || 'Match'}</div>
        
        {matchData && matchData.teams && matchData.teams.length === 2 && (
          <div className="match-card-teams">
            {matchData.teams.map((team, idx) => (
              <div className="match-card-team" key={team.code || idx}>
                <div className="team-info">
                  {team.image ? <img src={team.image} alt={team.code} className="team-logo" /> : <div className="team-logo-placeholder" />}
                  <span className="team-name">{team.code}</span>
                </div>
                <span className={`team-score ${match.state === 'completed' ? (team.result?.outcome === 'win' ? 'win' : 'loss') : ''}`}>
                  {hasScore ? (team.result?.gameWins ?? '-') : '-'}
                </span>
              </div>
            ))}
          </div>
        )}
        {inProgress && <div className="match-live-badge">LIVE</div>}
      </div>
    );
  };

  // --- MOBILE UI RENDERERS ---

  const renderMobileHeader = () => {
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    
    return (
      <div className="mobile-header">
        <div className="mobile-header-top">
          <h2>LoL Cal</h2>
          <div className="mobile-header-actions">
            <button className="icon-btn" onClick={() => setIsMobileFilterOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            </button>
            <button className="icon-btn" onClick={toggleTheme}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
        <div className="mobile-date-nav">
          <button className="icon-btn" onClick={prevDate}>&lt;</button>
          <div className="mobile-date-display" onClick={todayDate}>
            {format(start, 'MMM d')} - {format(end, 'MMM d')}
          </div>
          <button className="icon-btn" onClick={nextDate}>&gt;</button>
        </div>
      </div>
    );
  };

  const renderMobileView = () => {
    const startDate = startOfWeek(currentDate);
    const days = [];

    for (let i = 0; i < 7; i++) {
      const day = addDays(startDate, i);
      const dayMatches = getMatchesForDay(day);

      days.push(
        <div className={`mobile-day-section ${isSameDay(day, new Date()) ? 'today' : ''}`} key={day.toString()}>
          <div className="mobile-day-header">
            <span className="mobile-day-name">{format(day, 'EEEE')}</span>
            <span className="mobile-day-date">{format(day, 'MMM d')}</span>
          </div>
          <div className="mobile-matches-list">
            {dayMatches.length > 0 ? dayMatches.map(renderMatchCard) : <div className="no-matches">No matches scheduled</div>}
          </div>
        </div>
      );
    }

    return (
      <div className="mobile-container">
        {renderMobileHeader()}
        
        <div className="mobile-content">
          {loading ? (
            <div className="loading">Loading schedule...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : (
            days
          )}
        </div>

        {/* Mobile League Filter Modal */}
        {isMobileFilterOpen && (
          <div className="mobile-modal-overlay" onClick={() => setIsMobileFilterOpen(false)}>
            <div className="mobile-modal" onClick={e => e.stopPropagation()}>
              <div className="mobile-modal-header">
                <h3>Select Leagues</h3>
                <button className="icon-btn close-btn" onClick={() => setIsMobileFilterOpen(false)}>✕</button>
              </div>
              <div className="mobile-modal-content">
                {leagues.map((league) => (
                  <div 
                    key={league.id} 
                    className={`mobile-league-item ${selectedLeagueIds.includes(league.id) ? 'active' : ''}`}
                    onClick={() => toggleLeague(league.id)}
                  >
                    {league.image ? (
                      <img src={league.image} alt={league.name} className="league-logo" />
                    ) : (
                      <div className="league-logo-placeholder" />
                    )}
                    <span className="league-name">{league.name}</span>
                    {selectedLeagueIds.includes(league.id) && <span className="check-icon">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- DESKTOP UI RENDERERS ---

  const renderDesktopHeader = () => {
    const dateFormat = view === 'month' ? 'MMMM yyyy' : 'MMM d, yyyy';
    return (
      <div className="desktop-header">
        <div className="desktop-header-top">
          <h2>LoL Cal</h2>
          <div className="desktop-header-actions">
            <button className={`btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Month</button>
            <button className={`btn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Week</button>
            <button className="btn" onClick={toggleTheme}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
        
        <div className="desktop-header-bottom">
          <div className="desktop-league-filters">
            {leagues.map((league) => (
              <div 
                key={league.id} 
                className={`league-pill ${selectedLeagueIds.includes(league.id) ? 'active' : ''}`}
                onClick={() => toggleLeague(league.id)}
                title={league.name}
              >
                {league.image && <img src={league.image} alt={league.name} className="league-pill-logo" />}
                <span className="league-pill-name">{league.name}</span>
              </div>
            ))}
          </div>
          <div className="desktop-date-nav">
            <button className="icon-btn" onClick={prevDate}>&lt;</button>
            <button className="btn" onClick={todayDate}>Today</button>
            <h2 className="desktop-date-title">{format(currentDate, dateFormat)}</h2>
            <button className="icon-btn" onClick={nextDate}>&gt;</button>
          </div>
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

  const renderDesktopMatch = (match: Match) => {
    const inProgress = match.state === 'inProgress';
    const matchData = match.match;
    const hasScore = match.state === 'completed' || inProgress;

    if (!matchData || !matchData.teams || matchData.teams.length !== 2) {
      return (
        <div className="desktop-match-pill" key={match.id}>
           <span className="pill-league">[{match.league?.name}]</span>
           <span className="pill-time">{format(parseISO(match.startTime), 'HH:mm')}</span>
           <span className="pill-text">{match.blockName || 'Match'}</span>
        </div>
      );
    }

    const team1 = matchData.teams[0];
    const team2 = matchData.teams[1];

    return (
      <div className="desktop-match-pill" key={match.id} title={`${team1.name} vs ${team2.name}`}>
        <div className="pill-left">
          <span className="pill-league">[{match.league?.name}]</span>
          <span className="pill-time">{format(parseISO(match.startTime), 'HH:mm')}</span>
        </div>
        <div className="pill-center">
          <span className="pill-team-code">{team1.code}</span>
          {team1.image ? <img src={team1.image} alt={team1.code} className="pill-team-logo" /> : <div className="pill-logo-placeholder"/>}
          
          <span className={`pill-score ${inProgress ? 'live' : ''} ${hasScore && match.state === 'completed' ? 'final' : ''}`}>
            {hasScore ? `${team1.result?.gameWins ?? 0} : ${team2.result?.gameWins ?? 0}` : 'vs'}
          </span>
          
          {team2.image ? <img src={team2.image} alt={team2.code} className="pill-team-logo" /> : <div className="pill-logo-placeholder"/>}
          <span className="pill-team-code">{team2.code}</span>
        </div>
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
              {dayMatches.map(renderDesktopMatch)}
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

  const renderDesktopWeeklyView = () => {
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
            {dayMatches.length > 0 ? dayMatches.map(renderDesktopMatch) : <div className="no-matches-desktop">No matches</div>}
          </div>
        </div>
      );
    }

    return <div className="weekly-grid">{days}</div>;
  };

  const renderDesktopApp = () => (
    <div className="app-container desktop-layout">
      <div className="main-content">
        <div className="content-wrapper">
          {renderDesktopHeader()}
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
            renderDesktopWeeklyView()
          )}
        </div>
      </div>
    </div>
  );

  return isMobile ? renderMobileView() : renderDesktopApp();
};

export default App;
