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
import { setMonitor, getMonitor, getAlerts, generateSalesSequence, sendSalesEmail } from '../utils/api';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function Dashboard({
    competitors,
    activeCompetitorId,
    onSelectCompetitor,
    companyData,
    analysisDataMap,
    planDataMap,
}) {
    const analysisData = analysisDataMap[activeCompetitorId] || null;
    const planData = planDataMap[activeCompetitorId] || null;
    const competitorId = activeCompetitorId;

    // Use the new JSON schema structure
    const threats = analysisData?.signals?.threats || [];
    const opportunities = analysisData?.signals?.opportunities || [];
    const allSignals = [...threats.map(t => ({ ...t, type: 'threat' })), ...opportunities.map(o => ({ ...o, type: 'opportunity' }))];

    const featureGaps = analysisData?.feature_gap_analysis || {};
    const pricingIntel = analysisData?.pricing_intelligence || {};
    const sentiment = analysisData?.community_sentiment || {};
    const radar = analysisData?.radar_scores || {};
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

    // Load monitor settings when active competitor changes
    useEffect(() => {
        if (!competitorId) return;
        setMonitorLoaded(false);
        setAlerts([]);

        getMonitor(competitorId)
            .then((job) => {
                setMonitorActive(job.is_active);
                setMonitorSchedule(job.schedule);
                setLastRun(job.last_run);
                setNextRun(job.next_run);
                setMonitorLoaded(true);
            })
            .catch(() => setMonitorLoaded(true));

        getAlerts(competitorId).then(setAlerts).catch(() => { });
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

    // --- Sales Sequence state ---
    const [salesSequence, setSalesSequence] = useState(null);
    const [generatingSales, setGeneratingSales] = useState(false);
    const [salesError, setSalesError] = useState('');

    const handleGenerateSales = async () => {
        setGeneratingSales(true);
        setSalesError('');
        try {
            // Map the feature gap objects into simple strings for the sales prompt
            const weWinStr = (featureGaps.we_win || []).map(f => f.feature || f.area || JSON.stringify(f));

            const result = await generateSalesSequence(competitorId, {
                competitor_name: analysisData?.competitor_name || "Competitor",
                pricing_model: pricingIntel.model || "Unknown",
                pricing_complaints: pricingIntel.pricing_complaints || [],
                we_win_features: weWinStr
            });
            setSalesSequence(result.sequence);
        } catch (err) {
            setSalesError(err.message || 'Failed to generate sequence');
        } finally {
            setGeneratingSales(false);
        }
    };

    const [recipientEmail, setRecipientEmail] = useState('');
    const [sendingEmail, setSendingEmail] = useState(false);
    const [sendSuccess, setSendSuccess] = useState('');

    const handleSendEmail = async () => {
        if (!recipientEmail || !salesSequence || salesSequence.length === 0) return;
        setSendingEmail(true);
        setSendSuccess('');
        setSalesError('');
        try {
            const touch1 = salesSequence[0];
            const result = await sendSalesEmail(recipientEmail, touch1.subject, touch1.body);
            setSendSuccess(result.message);
            setRecipientEmail('');
            setTimeout(() => setSendSuccess(''), 5000);
        } catch (err) {
            setSalesError(err.message || 'Failed to send email');
        } finally {
            setSendingEmail(false);
        }
    };

    // Battle Card data based on new schema
    const battleRows = useMemo(() => {
        const rows = [];
        rows.push({ label: 'Value Proposition', you: companyData?.positioning?.value_proposition || '—', them: '—' });
        rows.push({ label: 'Pricing Model', you: companyData?.pricing?.model || '—', them: pricingIntel.model || '—' });
        rows.push({ label: 'Price Perception', you: '—', them: pricingIntel.community_price_perception || '—' });
        rows.push({ label: 'Key Features We Win', you: `${(featureGaps.we_win || []).length} features`, them: '—' });
        rows.push({ label: 'Key Features They Win', you: '—', them: `${(featureGaps.they_win || []).length} features` });
        rows.push({ label: 'Community Sentiment', you: '—', them: `${sentiment.overall_score || 0}/100 (${sentiment.sentiment_trend || 'Unknown'})` });
        return rows;
    }, [companyData, analysisData, pricingIntel, featureGaps, sentiment]);

    // Radar chart data using REAL AI data
    const radarData = useMemo(() => {
        const categories = ['Features', 'Pricing', 'Market Pos', 'Growth', 'Enterprise', 'Community'];

        // Assume you are solid 8/10s across the board by default as a baseline if you want, 
        // or parse from companyData if it existed.
        const yourScores = [80, 80, 70, 80, 60, 70];

        // AI returns radar scores natively now! Convert 0-10 or 0-100 format safely
        const normalize = (val) => {
            const v = Number(val) || 0;
            return v <= 10 ? v * 10 : v;
        };
        const theirScores = [
            normalize(radar.features),
            normalize(radar.pricing),
            normalize(radar.market_position),
            normalize(radar.growth_trajectory),
            normalize(radar.enterprise_readiness),
            normalize(radar.community_strength)
        ];

        return {
            labels: categories,
            datasets: [
                { label: companyData?.name || 'You', data: yourScores, borderColor: 'rgba(108, 92, 231, 1)', backgroundColor: 'rgba(108, 92, 231, 0.15)', borderWidth: 2, pointBackgroundColor: 'rgba(108, 92, 231, 1)' },
                { label: analysisData?.competitor_name || 'Competitor', data: theirScores, borderColor: 'rgba(255, 107, 107, 1)', backgroundColor: 'rgba(255, 107, 107, 0.15)', borderWidth: 2, pointBackgroundColor: 'rgba(255, 107, 107, 1)' },
            ],
        };
    }, [companyData, analysisData, radar]);

    const radarOptions = {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { color: '#8b8b9e', font: { family: 'Inter' } } } },
        scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, color: '#5a5a6e', backdropColor: 'transparent' }, grid: { color: 'rgba(255,255,255,0.05)' }, pointLabels: { color: '#8b8b9e', font: { size: 12, family: 'Inter' } } } },
    };

    // Analyzed competitors for tabs
    const analyzedCompetitors = competitors.filter((c) => !!analysisDataMap[c.id]);

    if (!analysisData) {
        return (
            <div className="animate-fade-in-up">
                <h1 className="page-title">Strategic Dashboard</h1>

                {/* Competitor Tabs */}
                {analyzedCompetitors.length > 1 && (
                    <div className="competitor-tabs" style={{ marginBottom: 'var(--space-xl)' }}>
                        {analyzedCompetitors.map((comp) => (
                            <button
                                key={comp.id}
                                className={`competitor-tab ${activeCompetitorId === comp.id ? 'active' : ''}`}
                                onClick={() => onSelectCompetitor(comp.id)}
                            >
                                {comp.name || comp.url}
                            </button>
                        ))}
                    </div>
                )}

                <div className="loading-state" style={{ padding: 'var(--space-3xl)' }}>
                    <div style={{ fontSize: '3rem' }}>📊</div>
                    <h2>No Data Yet</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Complete the analysis flow first to see the dashboard.</p>
                </div>
            </div>
        );
    }

    const criticalThreats = threats.filter(t => t.severity_score >= 80).length;

    return (
        <div className="animate-fade-in-up">
            <h1 className="page-title">Strategic Dashboard</h1>

            {/* Competitor Tabs */}
            {analyzedCompetitors.length > 1 && (
                <div className="competitor-tabs" style={{ marginBottom: 'var(--space-xl)' }}>
                    {analyzedCompetitors.map((comp) => (
                        <button
                            key={comp.id}
                            className={`competitor-tab ${activeCompetitorId === comp.id ? 'active' : ''}`}
                            onClick={() => onSelectCompetitor(comp.id)}
                        >
                            {comp.name || comp.url}
                        </button>
                    ))}
                </div>
            )}

            <p className="page-subtitle">
                {companyData?.name || 'You'} vs {analysisData?.competitor_name || 'Competitor'} — Complete intelligence overview
            </p>

            {/* Stats Row */}
            <div className="grid-4 stagger-children" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-danger)' }}>{threats.length}</div>
                    <div className="label">Total Threats</div>
                </div>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-success)' }}>{opportunities.length}</div>
                    <div className="label">Total Opportunities</div>
                </div>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ff4444' }}>{criticalThreats}</div>
                    <div className="label">Critical Threats</div>
                </div>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{sentiment.overall_score || 0}%</div>
                    <div className="label">Sentiment Score</div>
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
                            <div key={`row-${i}`} style={{ display: 'contents' }}>
                                <div className="battle-cell battle-cell--label">{row.label}</div>
                                <div className="battle-cell" style={{ fontSize: '0.8rem' }}>{row.you}</div>
                                <div className="battle-cell" style={{ fontSize: '0.8rem' }}>{row.them}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Radar Chart */}
                <div className="glass-card--static">
                    <div className="section-title">🎯 AI Feature Radar</div>
                    <div className="radar-container">
                        <Radar data={radarData} options={radarOptions} />
                    </div>
                </div>
            </div>

            {/* Inferred Roadmap (NEW based on jobs data) */}
            {(analysisData.inferred_roadmap || []).length > 0 && (
                <div className="glass-card--static" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="section-title">🔮 Inferred Roadmap (via Job Postings & News)</div>
                    <div className="grid-2">
                        {analysisData.inferred_roadmap.map((item, i) => (
                            <div key={i} className="glass-card">
                                <h4 style={{ color: 'var(--accent-danger)', fontSize: '0.9rem', marginBottom: 'var(--space-xs)' }}>
                                    Building: {item.inference}
                                </h4>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                                    {item.reasoning}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    <span>📍 {item.source_signal}</span>
                                    <span>⏱ {item.timeline_estimate}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pricing Intelligence */}
            {pricingIntel.tiers_found?.length > 0 && (
                <div className="glass-card--static" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="section-title">💰 Pricing Intelligence ({pricingIntel.model})</div>
                    <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                        {pricingIntel.tiers_found.map((tier, i) => (
                            <div key={i} className="glass-card" style={{ flex: '1 1 200px' }}>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>{tier.name}</div>
                                <div style={{ color: 'var(--accent-primary)', fontSize: '1.25rem', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>{tier.price}</div>
                                <ul style={{ paddingLeft: 'var(--space-md)', fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                                    {(tier.key_limits || []).map((limit, j) => (
                                        <li key={j}>{limit}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    {pricingIntel.pricing_complaints?.length > 0 && (
                        <div style={{ marginTop: 'var(--space-md)', background: 'rgba(255, 68, 68, 0.1)', padding: 'var(--space-sm)', borderRadius: 'var(--radius)', borderLeft: '4px solid var(--accent-danger)' }}>
                            <strong style={{ fontSize: '0.85rem', color: 'var(--accent-danger)' }}>Community Complaints:</strong>
                            <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, marginBottom: 0 }}>
                                {pricingIntel.pricing_complaints.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Signal Heatmap */}
            <div className="glass-card--static" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="section-title">🔥 Signal Severity Heatmap</div>
                <div className="heatmap-grid">
                    {allSignals.map((signal, i) => {
                        const sevLevel = signal.type === 'threat' ? (signal.severity_score >= 80 ? 'existential' : 'moderate') : 'opportunity';
                        return (
                            <div className={`heatmap-cell heatmap-cell--${sevLevel}`} key={i} title={signal.description}>
                                <div style={{ fontSize: '0.7rem', marginBottom: 4 }}>{signal.type === 'threat' ? '⚠️' : '🟢'}</div>
                                <div style={{ fontSize: '0.7rem', lineHeight: 1.3 }}>{signal.title?.substring(0, 40)}{signal.title?.length > 40 ? '...' : ''}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Roadmap Timeline */}
            {roadmap.length > 0 && (
                <div className="glass-card--static" style={{ marginBottom: 'var(--space-xl)' }}>
                    <div className="section-title">📋 Recommended 4-Week Action Plan</div>
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
                    Compare all your competitors with AI-powered radar charts, feature matrices, and intensity rankings
                </p>
                <button className="btn btn-primary btn-lg" onClick={(e) => { e.stopPropagation(); navigate('/compare'); }}>
                    🔀 Compare Competitors
                </button>
            </div>

            {/* ========== Sales Email Generator ========== */}
            <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🎯 AI Sales Outbound Sequence</span>
                    <button
                        className="btn btn-primary"
                        onClick={handleGenerateSales}
                        disabled={generatingSales}
                        style={{ backgroundColor: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }}
                    >
                        {generatingSales ? (
                            <><span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Writing...</>
                        ) : '✍️ Generate Sequence'}
                    </button>
                </div>

                {!salesSequence && !generatingSales && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Convert this competitive intelligence into a 3-touch outbound email sequence.
                        The AI will target {analysisData.competitor_name}'s customers by exploiting their specific pricing complaints and feature gaps.
                    </p>
                )}

                {salesError && <p style={{ color: 'var(--accent-danger)', marginTop: 'var(--space-sm)' }}>❌ {salesError}</p>}

                {salesSequence && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                        {salesSequence.map((email, idx) => (
                            <div key={idx} style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: 'var(--radius-md)',
                                padding: 'var(--space-md)'
                            }}>
                                <div style={{ fontWeight: '600', color: 'var(--accent-primary)', marginBottom: 'var(--space-xs)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Touch {email.touch}
                                </div>
                                <div style={{ fontSize: '0.9rem', marginBottom: 'var(--space-sm)', color: 'var(--text-primary)' }}>
                                    <strong>Subject:</strong> {email.subject}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                    {email.body}
                                </div>
                            </div>
                        ))}

                        {/* Send Email Action Area */}
                        <div style={{ marginTop: 'var(--space-md)', padding: 'var(--space-md)', background: 'rgba(108, 92, 231, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(108, 92, 231, 0.2)' }}>
                            <div style={{ fontWeight: '600', marginBottom: 'var(--space-sm)', color: 'var(--text-primary)' }}>🚀 Automate Outreach</div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>Approve this sequence and instantly dispatch Touch 1 to a prospect.</p>

                            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                                <input
                                    type="email"
                                    className="input-field"
                                    placeholder="prospect@company.com"
                                    value={recipientEmail}
                                    onChange={(e) => setRecipientEmail(e.target.value)}
                                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}
                                    disabled={sendingEmail}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSendEmail}
                                    disabled={sendingEmail || !recipientEmail}
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    {sendingEmail ? (
                                        <><span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sending...</>
                                    ) : '📤 Send Touch 1'}
                                </button>
                            </div>
                            {sendSuccess && (
                                <div style={{ marginTop: 'var(--space-sm)', color: 'var(--accent-success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    ✅ {sendSuccess}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ========== Continuous Monitoring Section ========== */}
            <div className="glass-card--static" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="section-title">📡 Continuous Monitoring</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-lg)' }}>
                    Enable automatic re-crawling and analysis. Compy will detect changes in competitor strategy and alert you.
                </p>
                <div className="monitor-controls">
                    <div className="monitor-control-row">
                        <span className="monitor-label">Monitoring</span>
                        <label className="monitor-toggle" id="monitor-toggle">
                            <input type="checkbox" checked={monitorActive} onChange={(e) => setMonitorActive(e.target.checked)} />
                            <span className="monitor-toggle-slider" />
                            <span className="monitor-toggle-text">{monitorActive ? 'Active' : 'Inactive'}</span>
                        </label>
                    </div>
                    <div className="monitor-control-row">
                        <span className="monitor-label">Schedule</span>
                        <select className="monitor-select" value={monitorSchedule} onChange={(e) => setMonitorSchedule(e.target.value)} id="monitor-schedule">
                            <option value="daily">🔄 Daily</option>
                            <option value="weekly">📅 Weekly</option>
                        </select>
                    </div>
                    {(lastRun || nextRun) && (
                        <div className="monitor-control-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-xs)' }}>
                            {lastRun && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last scan: {new Date(lastRun).toLocaleString()}</span>}
                            {nextRun && monitorActive && <span style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)' }}>Next scan: {new Date(nextRun).toLocaleString()}</span>}
                        </div>
                    )}
                    <div className="monitor-control-row">
                        <button className="btn btn-primary" onClick={handleSaveMonitor} disabled={monitorSaving} id="save-monitor-btn">
                            {monitorSaving ? (<><span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving...</>) : monitorSaved ? '✅ Saved!' : '💾 Save Settings'}
                        </button>
                    </div>
                    {monitorError && <p style={{ color: 'var(--accent-danger)', fontSize: '0.85rem', marginTop: 'var(--space-sm)' }}>❌ {monitorError}</p>}
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
                                    <span className="alert-date">📅 {new Date(alert.detected_at).toLocaleDateString()} at {new Date(alert.detected_at).toLocaleTimeString()}</span>
                                </div>
                                <p className="alert-summary">{alert.summary}</p>
                                <div className="alert-badges">
                                    {(alert.new_signals || []).length > 0 && <span className="badge badge-opportunity">+{alert.new_signals.length} new</span>}
                                    {(alert.disappeared_signals || []).length > 0 && <span className="badge badge-threat">−{alert.disappeared_signals.length} gone</span>}
                                    {(alert.severity_changes || []).length > 0 && <span className="badge badge-moderate">↕ {alert.severity_changes.length} changed</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
