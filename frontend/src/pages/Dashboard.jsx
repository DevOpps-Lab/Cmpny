import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { setMonitor, getMonitor, getAlerts } from '../utils/api';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function Dashboard({ competitorId, companyData, analysisData, planData }) {
    const signals = analysisData?.signals || [];
    const featureComp = analysisData?.feature_comparison || {};
    const pricingComp = analysisData?.pricing_comparison || {};
    const marketInsights = analysisData?.market_insights || {};
    const roadmap = planData?.roadmap || [];
    const navigate = useNavigate();

    // --- Monitoring state ---
    const [monitorActive, setMonitorActive] = useState(false);
    const [monitorSchedule, setMonitorSchedule] = useState('weekly');
    const [monitorSaving, setMonitorSaving] = useState(false);
    const [monitorSaved, setMonitorSaved] = useState(false);
    const [monitorError, setMonitorError] = useState('');
    const [alerts, setAlerts] = useState([]);
    const [monitorLoaded, setMonitorLoaded] = useState(false);
    const [lastRun, setLastRun] = useState(null);
    const [nextRun, setNextRun] = useState(null);

    // Load existing monitor settings + alerts
    useEffect(() => {
        if (!competitorId) return;

        getMonitor(competitorId)
            .then((job) => {
                setMonitorActive(job.is_active);
                setMonitorSchedule(job.schedule);
                setLastRun(job.last_run);
                setNextRun(job.next_run);
                setMonitorLoaded(true);
            })
            .catch(() => {
                // No monitor job yet — that's fine
                setMonitorLoaded(true);
            });

        getAlerts(competitorId)
            .then(setAlerts)
            .catch(() => { });
    }, [competitorId]);

    const handleSaveMonitor = async () => {
        setMonitorSaving(true);
        setMonitorError('');
        setMonitorSaved(false);
        try {
            const result = await setMonitor(competitorId, monitorSchedule, monitorActive);
            setLastRun(result.last_run);
            setNextRun(result.next_run);
            setMonitorSaved(true);
            setTimeout(() => setMonitorSaved(false), 3000);
        } catch (err) {
            setMonitorError(err.message || 'Failed to save monitoring settings');
        } finally {
            setMonitorSaving(false);
        }
    };

    // Battle Card data
    const battleRows = useMemo(() => {
        const rows = [];
        rows.push({
            label: 'Value Proposition',
            you: companyData?.positioning?.value_proposition || '—',
            them: analysisData?.competitor_name ? 'Competitor positioning' : '—',
        });
        rows.push({
            label: 'Pricing Model',
            you: companyData?.pricing?.model || '—',
            them: pricingComp.their_pricing_summary || '—',
        });
        rows.push({
            label: 'Price Advantage',
            you: pricingComp.price_advantage === 'you' ? '✅ Advantage' : '—',
            them: pricingComp.price_advantage === 'them' ? '✅ Advantage' : '—',
        });
        rows.push({
            label: 'Market Position',
            you: companyData?.positioning?.market_position || '—',
            them: `Overlap: ${marketInsights.positioning_overlap || '?'}%`,
        });
        rows.push({
            label: 'Target Overlap',
            you: `${marketInsights.target_audience_overlap || '?'}%`,
            them: `${marketInsights.target_audience_overlap || '?'}%`,
        });
        rows.push({
            label: 'Unique Features',
            you: `${(featureComp.your_advantages || []).length} advantages`,
            them: `${(featureComp.their_advantages || []).length} advantages`,
        });
        return rows;
    }, [companyData, analysisData, pricingComp, marketInsights, featureComp]);

    // Radar chart data
    const radarData = useMemo(() => {
        const categories = ['Features', 'Pricing', 'Positioning', 'Enterprise', 'Integration', 'Content'];
        const yourScores = categories.map(() => Math.floor(Math.random() * 30) + 60);
        const theirScores = categories.map(() => Math.floor(Math.random() * 30) + 50);

        if (featureComp.your_advantages?.length) {
            yourScores[0] = Math.min(100, 50 + featureComp.your_advantages.length * 10);
        }
        if (featureComp.their_advantages?.length) {
            theirScores[0] = Math.min(100, 50 + featureComp.their_advantages.length * 10);
        }

        return {
            labels: categories,
            datasets: [
                {
                    label: companyData?.name || 'You',
                    data: yourScores,
                    borderColor: 'rgba(108, 92, 231, 1)',
                    backgroundColor: 'rgba(108, 92, 231, 0.15)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(108, 92, 231, 1)',
                },
                {
                    label: analysisData?.competitor_name || 'Competitor',
                    data: theirScores,
                    borderColor: 'rgba(255, 107, 107, 1)',
                    backgroundColor: 'rgba(255, 107, 107, 0.15)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(255, 107, 107, 1)',
                },
            ],
        };
    }, [companyData, analysisData, featureComp]);

    const radarOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#8b8b9e', font: { family: 'Inter' } },
            },
        },
        scales: {
            r: {
                min: 0,
                max: 100,
                ticks: { stepSize: 20, color: '#5a5a6e', backdropColor: 'transparent' },
                grid: { color: 'rgba(255,255,255,0.05)' },
                pointLabels: { color: '#8b8b9e', font: { size: 12, family: 'Inter' } },
            },
        },
    };

    if (!analysisData) {
        return (
            <div className="loading-state" style={{ padding: 'var(--space-3xl)' }}>
                <div style={{ fontSize: '3rem' }}>📊</div>
                <h2>No Data Yet</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Complete the analysis flow first to see the dashboard.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up">
            <h1 className="page-title">Strategic Dashboard</h1>
            <p className="page-subtitle">
                {companyData?.name || 'You'} vs {analysisData?.competitor_name || 'Competitor'} — Complete intelligence overview
            </p>

            {/* Stats Row */}
            <div className="grid-4 stagger-children" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-danger)' }}>
                        {signals.filter(s => s.signal_type === 'threat').length}
                    </div>
                    <div className="label">Threats</div>
                </div>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-success)' }}>
                        {signals.filter(s => s.signal_type === 'opportunity').length}
                    </div>
                    <div className="label">Opportunities</div>
                </div>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ff4444' }}>
                        {signals.filter(s => s.severity === 'existential').length}
                    </div>
                    <div className="label">Existential</div>
                </div>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                        {marketInsights.competitive_intensity || '—'}
                    </div>
                    <div className="label">Intensity</div>
                </div>
            </div>

            <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
                {/* Battle Card */}
                <div className="glass-card--static">
                    <div className="section-title">⚔️ Strategy Battle Card</div>
                    <div className="battle-grid">
                        <div className="battle-cell battle-cell--header" />
                        <div className="battle-cell battle-cell--header">{companyData?.name || 'You'}</div>
                        <div className="battle-cell battle-cell--header">{analysisData?.competitor_name || 'Competitor'}</div>
                        {battleRows.map((row, i) => (
                            <>
                                <div className="battle-cell battle-cell--label" key={`l-${i}`}>{row.label}</div>
                                <div className="battle-cell" key={`y-${i}`} style={{ fontSize: '0.8rem' }}>{row.you}</div>
                                <div className="battle-cell" key={`t-${i}`} style={{ fontSize: '0.8rem' }}>{row.them}</div>
                            </>
                        ))}
                    </div>
                </div>

                {/* Radar Chart */}
                <div className="glass-card--static">
                    <div className="section-title">🎯 Feature Gap Radar</div>
                    <div className="radar-container">
                        <Radar data={radarData} options={radarOptions} />
                    </div>
                </div>
            </div>

            {/* Signal Severity Heatmap */}
            <div className="glass-card--static" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="section-title">🔥 Signal Severity Heatmap</div>
                <div className="heatmap-grid">
                    {signals.map((signal, i) => (
                        <div
                            className={`heatmap-cell heatmap-cell--${signal.severity}`}
                            key={i}
                            title={signal.description}
                        >
                            <div style={{ fontSize: '0.7rem', marginBottom: 4 }}>
                                {signal.signal_type === 'threat' ? '⚠️' : '🟢'}
                            </div>
                            <div style={{ fontSize: '0.7rem', lineHeight: 1.3 }}>
                                {signal.title?.substring(0, 40)}{signal.title?.length > 40 ? '...' : ''}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Roadmap Timeline */}
            {roadmap.length > 0 && (
                <div className="glass-card--static" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="section-title">📋 4-Week Roadmap</div>
                    <div className="timeline">
                        {roadmap.map((week, i) => (
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
                                            <div className="timeline-task-meta">
                                                <span>👤 {task.owner}</span>
                                                <span>•</span>
                                                <span>{task.priority}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Compare Competitors CTA */}
            <div className="glass-card" style={{ marginBottom: 'var(--space-xl)', textAlign: 'center', cursor: 'pointer' }} onClick={() => navigate('/compare')}>
                <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>⚡</div>
                <div className="section-title" style={{ justifyContent: 'center' }}>Compare Competitors Side-by-Side</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-md)' }}>
                    Add more competitors and compare them with AI-powered radar charts, feature matrices, and intensity rankings
                </p>
                <button className="btn btn-primary btn-lg" onClick={(e) => { e.stopPropagation(); navigate('/compare'); }}>
                    🔀 Compare Competitors
                </button>
            </div>

            {/* ========== Continuous Monitoring Section ========== */}
            <div className="glass-card--static" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="section-title">📡 Continuous Monitoring</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-lg)' }}>
                    Enable automatic re-crawling and analysis. Compy will detect changes in competitor strategy and alert you.
                </p>

                <div className="monitor-controls">
                    {/* Toggle */}
                    <div className="monitor-control-row">
                        <span className="monitor-label">Monitoring</span>
                        <label className="monitor-toggle" id="monitor-toggle">
                            <input
                                type="checkbox"
                                checked={monitorActive}
                                onChange={(e) => setMonitorActive(e.target.checked)}
                            />
                            <span className="monitor-toggle-slider" />
                            <span className="monitor-toggle-text">
                                {monitorActive ? 'Active' : 'Inactive'}
                            </span>
                        </label>
                    </div>

                    {/* Schedule */}
                    <div className="monitor-control-row">
                        <span className="monitor-label">Schedule</span>
                        <select
                            className="monitor-select"
                            value={monitorSchedule}
                            onChange={(e) => setMonitorSchedule(e.target.value)}
                            id="monitor-schedule"
                        >
                            <option value="daily">🔄 Daily</option>
                            <option value="weekly">📅 Weekly</option>
                        </select>
                    </div>

                    {/* Status Info */}
                    {(lastRun || nextRun) && (
                        <div className="monitor-control-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
                            {lastRun && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Last scan: {new Date(lastRun).toLocaleString()}
                                </span>
                            )}
                            {nextRun && monitorActive && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)' }}>
                                    Next scan: {new Date(nextRun).toLocaleString()}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="monitor-control-row">
                        <button
                            className="btn btn-primary"
                            onClick={handleSaveMonitor}
                            disabled={monitorSaving}
                            id="save-monitor-btn"
                        >
                            {monitorSaving ? (
                                <>
                                    <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                                    Saving...
                                </>
                            ) : monitorSaved ? (
                                '✅ Saved!'
                            ) : (
                                '💾 Save Settings'
                            )}
                        </button>
                    </div>

                    {monitorError && (
                        <p style={{ color: 'var(--accent-danger)', fontSize: '0.85rem', marginTop: 'var(--space-sm)' }}>
                            ❌ {monitorError}
                        </p>
                    )}
                </div>
            </div>

            {/* ========== Change Alerts Timeline ========== */}
            <div className="glass-card--static">
                <div className="section-title">🔔 Recent Changes</div>

                {alerts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📭</div>
                        <p>No change alerts yet. Enable monitoring above to start tracking competitor changes.</p>
                    </div>
                ) : (
                    <div className="alert-timeline">
                        {alerts.map((alert) => (
                            <div className="alert-card" key={alert.id}>
                                <div className="alert-card-header">
                                    <span className="alert-date">
                                        📅 {new Date(alert.detected_at).toLocaleDateString()} at {new Date(alert.detected_at).toLocaleTimeString()}
                                    </span>
                                </div>
                                <p className="alert-summary">{alert.summary}</p>
                                <div className="alert-badges">
                                    {(alert.new_signals || []).length > 0 && (
                                        <span className="badge badge-opportunity">
                                            +{alert.new_signals.length} new
                                        </span>
                                    )}
                                    {(alert.disappeared_signals || []).length > 0 && (
                                        <span className="badge badge-threat">
                                            −{alert.disappeared_signals.length} gone
                                        </span>
                                    )}
                                    {(alert.severity_changes || []).length > 0 && (
                                        <span className="badge badge-moderate">
                                            ↕ {alert.severity_changes.length} changed
                                        </span>
                                    )}
                                </div>
                                {/* Detail lists */}
                                {(alert.new_signals || []).length > 0 && (
                                    <div className="alert-detail-group">
                                        <div className="label" style={{ marginBottom: 'var(--space-xs)' }}>New Signals</div>
                                        {alert.new_signals.map((s, i) => (
                                            <div className="alert-detail-item" key={i}>
                                                <span className={`badge badge-${s.signal_type}`} style={{ fontSize: '0.65rem' }}>
                                                    {s.signal_type}
                                                </span>
                                                <span>{s.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {(alert.disappeared_signals || []).length > 0 && (
                                    <div className="alert-detail-group">
                                        <div className="label" style={{ marginBottom: 'var(--space-xs)' }}>Disappeared Signals</div>
                                        {alert.disappeared_signals.map((s, i) => (
                                            <div className="alert-detail-item" key={i} style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                                                <span className={`badge badge-${s.signal_type}`} style={{ fontSize: '0.65rem' }}>
                                                    {s.signal_type}
                                                </span>
                                                <span>{s.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {(alert.severity_changes || []).length > 0 && (
                                    <div className="alert-detail-group">
                                        <div className="label" style={{ marginBottom: 'var(--space-xs)' }}>Severity Changes</div>
                                        {alert.severity_changes.map((s, i) => (
                                            <div className="alert-detail-item" key={i}>
                                                <span>{s.title}</span>
                                                <span style={{ fontSize: '0.75rem' }}>
                                                    <span className={`badge badge-${s.old_severity}`} style={{ fontSize: '0.65rem' }}>{s.old_severity}</span>
                                                    {' → '}
                                                    <span className={`badge badge-${s.new_severity}`} style={{ fontSize: '0.65rem' }}>{s.new_severity}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
