import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { runAnalysis, generatePlan } from '../utils/api';

export default function Analysis({
    competitors,
    activeCompetitorId,
    onSelectCompetitor,
    analysisDataMap,
    planDataMap,
    onAnalysisComplete,
    onPlanComplete,
}) {
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzingId, setAnalyzingId] = useState(null);
    const [planning, setPlanning] = useState(false);
    const [error, setError] = useState('');
    const [analyzingAll, setAnalyzingAll] = useState(false);
    const [analyzeProgress, setAnalyzeProgress] = useState('');
    const navigate = useNavigate();

    const readyCompetitors = competitors.filter((c) => c.status === 'crawled');
    const analysisData = analysisDataMap[activeCompetitorId] || null;
    const planData = planDataMap[activeCompetitorId] || null;

    const analyzedCount = readyCompetitors.filter((c) => !!analysisDataMap[c.id]).length;
    const pendingCount = readyCompetitors.length - analyzedCount;

    const handleAnalyze = async (compId) => {
        setAnalyzing(true);
        setAnalyzingId(compId);
        setError('');
        try {
            const result = await runAnalysis(compId);
            onAnalysisComplete(compId, result);
        } catch (err) {
            setError(err.message || 'Analysis failed');
        } finally {
            setAnalyzing(false);
            setAnalyzingId(null);
        }
    };

    const handleAnalyzeAll = async () => {
        setAnalyzingAll(true);
        setError('');
        const pending = readyCompetitors.filter((c) => !analysisDataMap[c.id]);
        for (let i = 0; i < pending.length; i++) {
            const comp = pending[i];
            setAnalyzeProgress(`Analyzing ${comp.name || comp.url} (${i + 1}/${pending.length})...`);
            setAnalyzingId(comp.id);
            onSelectCompetitor(comp.id);
            try {
                const result = await runAnalysis(comp.id);
                onAnalysisComplete(comp.id, result);
            } catch (err) {
                setError(`Failed on ${comp.name || comp.url}: ${err.message}`);
                break;
            }
        }
        setAnalyzingAll(false);
        setAnalyzingId(null);
        setAnalyzeProgress('');
    };

    const handlePlan = async () => {
        if (!activeCompetitorId) return;
        setPlanning(true);
        setError('');
        try {
            const result = await generatePlan(activeCompetitorId);
            onPlanComplete(activeCompetitorId, result);
        } catch (err) {
            setError(err.message || 'Planning failed');
        } finally {
            setPlanning(false);
        }
    };

    const severityColor = (sev) => {
        switch (sev) {
            case 'existential': return '#ff4444';
            case 'moderate': return 'var(--accent-warning)';
            case 'minor': return 'var(--accent-secondary)';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div className="animate-fade-in-up">
            {/* Step Indicator */}
            <div className="steps">
                <div className="step completed">✅ 1. DNA</div>
                <div className="step-connector" />
                <div className="step completed">✅ 2. Scout</div>
                <div className="step-connector" />
                <div className="step active">🔬 3. Analyze</div>
                <div className="step-connector" />
                <div className="step">📊 4. Dashboard</div>
            </div>

            <h1 className="page-title">Intelligence Analysis</h1>
            <p className="page-subtitle">
                Run differential reasoning to extract threats, opportunities, and generate a tactical roadmap.
            </p>

            {/* All Competitors Overview */}
            <div className="glass-card--static" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="section-title">
                    🎯 Competitors ({analyzedCount}/{readyCompetitors.length} analyzed)
                </div>

                <div className="competitor-list">
                    {readyCompetitors.map((comp) => {
                        const hasAnalysis = !!analysisDataMap[comp.id];
                        const isAnalyzing = analyzingId === comp.id;
                        return (
                            <div
                                className={`competitor-row ${activeCompetitorId === comp.id ? 'active' : ''}`}
                                key={comp.id}
                                onClick={() => onSelectCompetitor(comp.id)}
                            >
                                <div className="competitor-row-info">
                                    <span className="competitor-row-name">{comp.name || comp.url}</span>
                                    <span className="competitor-row-url">{comp.url}</span>
                                </div>
                                <div className="competitor-row-meta">
                                    {isAnalyzing ? (
                                        <span className="badge" style={{ background: 'var(--accent-warning)', color: '#000' }}>
                                            <span className="loading-spinner" style={{ width: 12, height: 12, borderWidth: 2, marginRight: 4 }} />
                                            Analyzing...
                                        </span>
                                    ) : hasAnalysis ? (
                                        <span className="badge badge-opportunity">✅ Analyzed</span>
                                    ) : (
                                        <button
                                            className="btn btn-primary"
                                            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                            onClick={(e) => { e.stopPropagation(); onSelectCompetitor(comp.id); handleAnalyze(comp.id); }}
                                            disabled={analyzing || analyzingAll}
                                        >
                                            ⚡ Analyze
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Analyze All Button */}
                {pendingCount > 0 && (
                    <div style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
                        {analyzingAll ? (
                            <div className="loading-state" style={{ gap: 'var(--space-sm)' }}>
                                <div className="loading-spinner" />
                                <p>{analyzeProgress}</p>
                            </div>
                        ) : (
                            <button
                                className="btn btn-primary btn-lg"
                                onClick={handleAnalyzeAll}
                                disabled={analyzing}
                                id="analyze-all-btn"
                            >
                                ⚡ Analyze All {pendingCount} Pending Competitor{pendingCount !== 1 ? 's' : ''}
                            </button>
                        )}
                    </div>
                )}

                {/* All done → go to dashboard */}
                {pendingCount === 0 && analyzedCount > 0 && !analyzingAll && (
                    <div style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
                        <p style={{ color: 'var(--accent-success)', marginBottom: 'var(--space-sm)', fontWeight: 600 }}>
                            ✅ All {analyzedCount} competitors analyzed!
                        </p>
                        <button className="btn btn-success btn-lg" onClick={() => navigate('/dashboard')} id="go-to-dashboard-from-analysis">
                            📊 View Dashboard →
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="glass-card--static" style={{ borderColor: 'var(--accent-danger)', marginBottom: 'var(--space-lg)' }}>
                    <p style={{ color: 'var(--accent-danger)' }}>❌ {error}</p>
                </div>
            )}

            {/* Analysis Results for selected competitor */}
            {analysisData && (
                <div className="animate-fade-in-up">
                    <div className="section-title" style={{ marginTop: 'var(--space-lg)' }}>
                        ⚡ Intelligence Signals — {analysisData.competitor_name}
                    </div>

                    {/* Signal Cards */}
                    <div className="stagger-children" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        {(analysisData.signals || []).map((signal, i) => (
                            <div className="glass-card" key={signal.id || i}>
                                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', marginBottom: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                            <span className={`badge badge-${signal.signal_type}`}>
                                                {signal.signal_type === 'threat' ? '⚠️' : '🟢'} {signal.signal_type}
                                            </span>
                                            <span className={`badge badge-${signal.severity}`}>
                                                {signal.severity}
                                            </span>
                                            <span className="badge" style={{ background: 'var(--bg-glass)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                                                {signal.category}
                                            </span>
                                        </div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-xs)' }}>
                                            {signal.title}
                                        </h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                                            {signal.description}
                                        </p>
                                    </div>

                                    {/* Score bars */}
                                    <div style={{ minWidth: 140, display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                        <div>
                                            <div className="label">Relevance</div>
                                            <div className="score-bar">
                                                <div className="score-bar-track">
                                                    <div
                                                        className="score-bar-fill"
                                                        style={{
                                                            width: `${signal.relevance}%`,
                                                            background: `linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))`,
                                                        }}
                                                    />
                                                </div>
                                                <div className="score-bar-value">{Math.round(signal.relevance)}</div>
                                            </div>
                                        </div>
                                        <div>
                                            <div className="label">Confidence</div>
                                            <div className="score-bar">
                                                <div className="score-bar-track">
                                                    <div
                                                        className="score-bar-fill"
                                                        style={{
                                                            width: `${signal.confidence}%`,
                                                            background: severityColor(signal.severity),
                                                        }}
                                                    />
                                                </div>
                                                <div className="score-bar-value">{Math.round(signal.confidence)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Evidence */}
                                {signal.evidence?.length > 0 && (
                                    <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
                                        <div className="label" style={{ marginBottom: 'var(--space-xs)' }}>Evidence</div>
                                        {signal.evidence.map((ev, j) => (
                                            <div key={j} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                                                📍 <em>"{ev.quote?.substring(0, 120)}..."</em>
                                                {ev.source_url && (
                                                    <a href={ev.source_url} target="_blank" rel="noopener" style={{ marginLeft: 'var(--space-sm)' }}>
                                                        [{ev.page_type || 'source'}]
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Feature Comparison */}
                    {analysisData.feature_comparison && (
                        <div style={{ marginTop: 'var(--space-xl)' }}>
                            <div className="section-title">🔧 Feature Comparison</div>
                            <div className="grid-2">
                                <div className="glass-card--static">
                                    <h4 style={{ color: 'var(--accent-success)', marginBottom: 'var(--space-sm)', fontSize: '0.9rem' }}>✅ Your Advantages</h4>
                                    <ul style={{ paddingLeft: 'var(--space-md)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        {(analysisData.feature_comparison.your_advantages || []).map((f, i) => (
                                            <li key={i}>{f}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="glass-card--static">
                                    <h4 style={{ color: 'var(--accent-danger)', marginBottom: 'var(--space-sm)', fontSize: '0.9rem' }}>⚠️ Their Advantages</h4>
                                    <ul style={{ paddingLeft: 'var(--space-md)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        {(analysisData.feature_comparison.their_advantages || []).map((f, i) => (
                                            <li key={i}>{f}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Generate Plan Button */}
                    {!planData && (
                        <div style={{ marginTop: 'var(--space-xl)', textAlign: 'center' }}>
                            {planning ? (
                                <div className="loading-state">
                                    <div className="loading-spinner" />
                                    <p>Generating 4-week tactical roadmap...</p>
                                </div>
                            ) : (
                                <button className="btn btn-success btn-lg" onClick={handlePlan} id="generate-plan-btn">
                                    📋 Generate Tactical Roadmap
                                </button>
                            )}
                        </div>
                    )}

                    {/* Plan Results */}
                    {planData && (
                        <div className="animate-fade-in-up" style={{ marginTop: 'var(--space-xl)' }}>
                            <div className="section-title">📋 4-Week Tactical Roadmap</div>

                            <div className="timeline">
                                {(planData.roadmap || []).map((week, i) => (
                                    <div className="timeline-week" key={i}>
                                        <div className="timeline-week-header">
                                            <span className="timeline-week-label">Week {week.week}</span>
                                            <span className="timeline-week-theme">{week.theme}</span>
                                        </div>
                                        <div className="timeline-tasks">
                                            {(week.tasks || []).map((task, j) => (
                                                <div className="timeline-task" key={j}>
                                                    <div className="timeline-task-header">
                                                        <span className="timeline-task-title">{task.title}</span>
                                                        <span className={`badge badge-${task.task_type}`}>{task.task_type}</span>
                                                    </div>
                                                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-xs)' }}>
                                                        {task.description}
                                                    </p>
                                                    <div className="timeline-task-meta">
                                                        <span>👤 {task.owner}</span>
                                                        <span>•</span>
                                                        <span style={{ color: task.priority === 'critical' ? 'var(--accent-danger)' : 'var(--text-muted)' }}>
                                                            {task.priority}
                                                        </span>
                                                        <span>•</span>
                                                        <span>📏 {task.success_metric}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginTop: 'var(--space-xl)', textAlign: 'center' }}>
                                <button
                                    className="btn btn-primary btn-lg"
                                    onClick={() => navigate('/dashboard')}
                                    id="go-to-dashboard-btn"
                                >
                                    📊 View Full Dashboard →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
