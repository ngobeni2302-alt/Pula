import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  ChevronRight,
  Filter,
  ArrowUpDown,
  BookOpen,
  TrendingUp,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { GROUPS, getParentForLearner } from '../dashboardData.js';
import { getLearnerFullName, getLearnerAcademicRecord } from './learnerData.js';
import './learners.css';

export default function ReadingTierList({
  classroom,
  initialTier = 'All',
  title,
  onSelectLearner,
  onBack
}) {
  const [selectedTier, setSelectedTier] = useState(initialTier);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('alpha'); // 'alpha' | 'progress' | 'improved' | 'support'

  const learners = classroom?.learners || [];
  const grade = classroom?.grade || '2';
  const room = classroom?.room || grade;

  // Filter & Search
  const filteredLearners = useMemo(() => {
    return learners.filter(l => {
      // Tier filter
      if (selectedTier !== 'All' && l.group !== selectedTier) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const fullName = getLearnerFullName(l, grade).toLowerCase();
        if (!fullName.includes(q) && !l.name.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [learners, selectedTier, searchQuery, grade]);

  // Sort
  const sortedLearners = useMemo(() => {
    const list = [...filteredLearners];
    if (sortBy === 'alpha') {
      list.sort((a, b) => getLearnerFullName(a, grade).localeCompare(getLearnerFullName(b, grade)));
    } else if (sortBy === 'progress') {
      list.sort((a, b) => (b.history?.at(-1) || 0) - (a.history?.at(-1) || 0));
    } else if (sortBy === 'improved') {
      list.sort((a, b) => {
        const impA = (a.history?.at(-1) || 0) - (a.history?.[0] || 0);
        const impB = (b.history?.at(-1) || 0) - (b.history?.[0] || 0);
        return impB - impA;
      });
    } else if (sortBy === 'support') {
      list.sort((a, b) => (a.code || 4) - (b.code || 4));
    }
    return list;
  }, [filteredLearners, sortBy, grade]);

  return (
    <section className="pula-learners-container" aria-label="Reading Tier Learners">
      {/* Back Navigation Bar */}
      <div className="pula-back-bar">
        <button
          type="button"
          className="pula-back-btn"
          onClick={onBack}
          aria-label="Back to Class Home"
        >
          <ArrowLeft size={16} /> Back to Class Home
        </button>

        <span className="pula-badge-pill" style={{ background: '#eee5d7', color: 'var(--pula-navy)' }}>
          Grade {room}
        </span>
      </div>

      {/* Page Title */}
      <header className="pula-tier-header">
        <h1 className="pula-tier-title">
          {title ? title : (selectedTier === 'All' ? 'Reading Groups' : `${selectedTier} Reading Group`)}
        </h1>
        <p className="pula-tier-subtitle">
          Grade {room} · {sortedLearners.length} student{sortedLearners.length === 1 ? '' : 's'}
          {selectedTier !== 'All' ? ` in ${selectedTier}` : ' total'}
        </p>
      </header>

      {/* Search & Filter Controls */}
      <div className="pula-learners-controls">
        <div className="pula-search-input-wrap">
          <Search size={18} className="pula-search-icon" />
          <input
            type="search"
            className="pula-search-input"
            placeholder="Search learners..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search learners"
          />
        </div>

        <div className="pula-filter-sort-row">
          {/* Tier Chips */}
          <div className="pula-tier-chips" role="tablist" aria-label="Filter by reading tier">
            {['All', ...GROUPS].map(g => {
              const count = g === 'All'
                ? learners.length
                : learners.filter(l => l.group === g).length;
              const isActive = selectedTier === g;

              return (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`pula-tier-chip ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedTier(g)}
                >
                  <span>{g}</span>
                  <small style={{ opacity: 0.85 }}>({count})</small>
                </button>
              );
            })}
          </div>

          {/* Sort Selector */}
          <select
            className="pula-sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            aria-label="Sort learners"
          >
            <option value="alpha">Alphabetical (A–Z)</option>
            <option value="progress">Reading progress</option>
            <option value="improved">Most improved</option>
            <option value="support">Learners requiring support</option>
          </select>
        </div>
      </div>

      {/* Learner Cards List */}
      {sortedLearners.length === 0 ? (
        <div className="pula-empty-state">
          <AlertCircle size={32} style={{ marginBottom: '10px', opacity: 0.6 }} />
          <p style={{ margin: 0, fontWeight: 800 }}>
            {searchQuery
              ? `No learners found matching "${searchQuery}".`
              : 'No learners are currently assigned to this reading tier.'}
          </p>
          {searchQuery && (
            <button
              type="button"
              className="pd-link"
              onClick={() => setSearchQuery('')}
              style={{ marginTop: '8px' }}
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="pula-learner-cards">
          {sortedLearners.map(learner => {
            const fullName = getLearnerFullName(learner, grade);
            const parent = getParentForLearner(learner, grade);
            const latestWpm = learner.history?.at(-1);
            const improvement = latestWpm != null && learner.history?.[0] != null
              ? latestWpm - learner.history[0]
              : 0;
            const isGradeR = grade === 'R';

            // Initials
            const initials = fullName
              .split(' ')
              .map(p => p[0])
              .slice(0, 2)
              .join('');

            return (
              <div
                key={learner.id}
                role="button"
                tabIndex={0}
                className="pula-learner-card"
                onClick={() => onSelectLearner(learner.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectLearner(learner.id);
                  }
                }}
              >
                {/* Initials Avatar */}
                <div className={`pula-learner-avatar avatar-${learner.group}`}>
                  {initials}
                </div>

                {/* Learner Info */}
                <div className="pula-learner-info">
                  <h3 className="pula-learner-name">{fullName}</h3>

                  <div className="pula-learner-meta">
                    <span className={`pula-badge-pill badge-${learner.group}`}>
                      Tier: {learner.group}
                    </span>

                    <span style={{ fontWeight: 700 }}>
                      Grade {room}
                    </span>

                    <span>·</span>

                    <span style={{ color: '#494263', fontWeight: 800 }}>
                      {isGradeR
                        ? `Code ${learner.code || 4} · Sound & rhyme`
                        : `${latestWpm || 20} WPM · ${
                            latestWpm >= 35 ? 'Fluent' : latestWpm >= 22 ? 'Developing' : 'Early reader'
                          }`}
                    </span>

                    {improvement > 0 && !isGradeR && (
                      <span className="pula-improvement-badge pula-positive-imp">
                        +{improvement} WPM
                      </span>
                    )}
                  </div>

                  <div className="pula-learner-submeta" style={{ marginTop: '5px', fontSize: '11.5px', color: '#6c6785', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>Home Language: <strong>{learner.language || 'English'}</strong></span>
                    <span>·</span>
                    <span>Parent: <strong>{parent.name}</strong> ({learner.channel || 'WhatsApp'})</span>
                    {learner.consent === false && (
                      <span style={{ color: '#b94025', fontWeight: 800 }}>⚠️ Needs consent</span>
                    )}
                  </div>
                </div>

                <ChevronRight size={20} className="pula-card-arrow" />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

