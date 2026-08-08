import React, { useState } from 'react';
import { BookOpen, Search, ShieldCheck, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { MOCK_FIRST_AID_GUIDES } from '../data/mockFirstAid';
import { FirstAidTopic } from '../types/triage';
import { useLanguage } from '../hooks/useLanguage';

export const HealthGuidanceScreen: React.FC = () => {
  const { lang } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<FirstAidTopic | null>(null);

  const filteredGuides = MOCK_FIRST_AID_GUIDES.filter((guide) => {
    const title = guide.title;
    const summary = guide.summary;
    const q = searchQuery.toLowerCase();
    return title.toLowerCase().includes(q) || summary.toLowerCase().includes(q);
  });

  if (selectedTopic) {
    return (
      <div>
        <button
          onClick={() => setSelectedTopic(null)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#0f766e',
            fontWeight: 600,
            fontSize: '14px',
            marginBottom: '16px',
            border: 'none',
            background: 'none'
          }}
        >
          <ArrowLeft size={18} />
          {lang === 'te' ? 'జాబితాకు వెళ్ళండి' : 'Back to Guidance Library'}
        </button>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="badge badge-low">
              <ShieldCheck size={14} />
              {lang === 'te' ? '100% ఆఫ్‌లైన్ అందుబాటులో ఉంది' : '100% Offline Available'}
            </span>
          </div>

          <h2 style={{ fontSize: '22px', color: '#0f766e', marginBottom: '8px' }}>
            {selectedTopic.title}
          </h2>

          <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>
            {selectedTopic.summary}
          </p>

          {/* DO STEPS */}
          <div style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '14px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <h3 style={{ fontSize: '17px', color: '#166534', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={20} color="#16a34a" />
              {lang === 'te' ? 'చేయాల్సిన విషయాలు:' : 'What to Do (Step-by-Step Guidance):'}
            </h3>
            <ol style={{ paddingLeft: '20px', margin: 0 }}>
              {selectedTopic.steps.map((step, idx) => (
                <li key={idx} style={{ fontSize: '15px', color: '#14532d', marginBottom: '10px', lineHeight: 1.5 }}>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* DO NOT DO STEPS */}
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '14px',
            padding: '16px'
          }}>
            <h3 style={{ fontSize: '17px', color: '#991b1b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <XCircle size={20} color="#dc2626" />
              {lang === 'te' ? 'చేయకూడని విషయాలు (DO NOT DO):' : 'Critical Warning — DO NOT DO:'}
            </h3>
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              {selectedTopic.doNotDo.map((item, idx) => (
                <li key={idx} style={{ fontSize: '15px', color: '#7f1d1d', marginBottom: '8px', lineHeight: 1.5, fontWeight: 600 }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '22px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={24} />
          {lang === 'te' ? 'ప్రాథమిక చికిత్స గైడ్లు' : 'Offline First Aid & Guidance'}
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          {lang === 'te' ? 'పాము కాటు, జ్వరం మరియు ORS వాడకం వివరాలు' : 'Essential medical first aid protocols accessible anytime without internet.'}
        </p>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '14px' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={lang === 'te' ? 'గైడ్ వెతకండి (ఉదా: పాము కాటు, జ్వరం)...' : 'Search guides (e.g. snakebite, fever, ORS)...'}
          style={{
            width: '100%',
            padding: '12px 14px 12px 42px',
            borderRadius: '12px',
            border: '1.5px solid #cbd5e1',
            fontSize: '15px',
            outline: 'none'
          }}
        />
      </div>

      {/* Guides List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredGuides.map((guide) => (
          <div
            key={guide.id}
            className="card card-interactive"
            onClick={() => setSelectedTopic(guide)}
            style={{ margin: 0, padding: '16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#0f766e' }}>
                {guide.title}
              </h3>
              <span className="badge badge-low" style={{ fontSize: '11px' }}>
                Offline
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#475569', lineHeight: 1.4 }}>
              {guide.summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
