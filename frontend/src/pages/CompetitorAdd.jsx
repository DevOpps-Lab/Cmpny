import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { addCompetitor, subscribeToStream, getCompetitor } from '../utils/api';

export default function CompetitorAdd({ companyId, onComplete, competitorId }) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [logs, setLogs] = useState([]);
    const [crawlDone, setCrawlDone] = useState(false);
    const [currentCompetitor, setCurrentCompetitor] = useState(null);
    const terminalRef = useRef(null);
    const navigate = useNavigate();

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    const getLogType = (event) => {
        switch (event) {
            case 'crawl': return 'info';
            case 'classified': return 'success';
            case 'ranking': return 'warning';
            case 'error': return 'error';
            case 'done': return 'success';
            default: return 'default';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!url.trim()) return;

        setLoading(true);
        setError('');
        setLogs([]);
        setCrawlDone(false);

        try {
            const comp = await addCompetitor(url.trim(), companyId);
            setCurrentCompetitor(comp);
            onComplete(comp);

            // Subscribe to SSE stream using job_id for reliable connection
            const unsubscribe = subscribeToStream(comp.id, (event) => {
                console.log('SSE event:', event);
                const logEntry = {
                    time: new Date().toLocaleTimeString(),
                    type: getLogType(event.event),
                    message: event.data?.message || '',
                    details: [],
                };

                // Add classification details
                if (event.data?.page_type) {
                    logEntry.details.push(event.data.page_type);
                }
                if (event.data?.strategic_score) {
                    logEntry.details.push(event.data.strategic_score);
                }

                setLogs(prev => [...prev, logEntry]);

                if (event.event === 'done') {
                    setCrawlDone(true);
                    setLoading(false);
                    // Refresh competitor data
                    getCompetitor(comp.id).then(setCurrentCompetitor).catch(() => { });
                }
            });

            // Cleanup on unmount
            return () => unsubscribe();
        } catch (err) {
            setError(err.message || 'Failed to add competitor');
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in-up">
            {/* Step Indicator */}
            <div className="steps">
                <div className="step completed">✅ 1. Company DNA</div>
                <div className="step-connector" />
                <div className="step active">🕵️ 2. Scout</div>
                <div className="step-connector" />
                <div className="step">🔬 3. Analyze</div>
                <div className="step-connector" />
                <div className="step">📊 4. Dashboard</div>
            </div>

            <h1 className="page-title">Add a Competitor</h1>
            <p className="page-subtitle">
                Enter a competitor's website. Compy will intelligently crawl and classify their strategic pages.
            </p>

            {/* URL Input */}
            <form onSubmit={handleSubmit} style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="input-group">
                    <input
                        type="text"
                        className="input"
                        placeholder="https://competitor.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={loading}
                        id="competitor-url-input"
                    />
                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={loading || !url.trim()}
                        id="scout-btn"
                    >
                        {loading ? (
                            <>
                                <span className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                                Scouting...
                            </>
                        ) : (
                            <>🕵️ Start Scout</>
                        )}
                    </button>
                </div>
            </form>

            {error && (
                <div className="glass-card--static" style={{ borderColor: 'var(--accent-danger)', marginBottom: 'var(--space-lg)' }}>
                    <p style={{ color: 'var(--accent-danger)' }}>❌ {error}</p>
                </div>
            )}

            {/* Live Terminal */}
            {logs.length > 0 && (
                <div className="terminal animate-fade-in">
                    <div className="terminal-header">
                        <div className="terminal-dot terminal-dot--red" />
                        <div className="terminal-dot terminal-dot--yellow" />
                        <div className="terminal-dot terminal-dot--green" />
                        <div className="terminal-title">
                            Scout Agent — {loading ? '🔴 LIVE' : '✅ Complete'} — {currentCompetitor?.page_count || logs.filter(l => l.type === 'success').length} pages
                        </div>
                    </div>
                    <div className="terminal-body" ref={terminalRef}>
                        {logs.map((log, i) => (
                            <div key={i}>
                                <div className={`terminal-line terminal-line--${log.type}`}>
                                    <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>[{log.time}]</span>
                                    {log.message}
                                </div>
                                {log.details.map((detail, j) => (
                                    <div key={j} className="terminal-line terminal-line--default" style={{ paddingLeft: 24 }}>
                                        {detail}
                                    </div>
                                ))}
                            </div>
                        ))}
                        {loading && (
                            <div className="terminal-line terminal-line--info" style={{ animation: 'pulse 1.5s infinite' }}>
                                █ Waiting for next page...
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Continue Button */}
            {crawlDone && (
                <div style={{ marginTop: 'var(--space-xl)', textAlign: 'center' }} className="animate-fade-in-up">
                    <p style={{ marginBottom: 'var(--space-md)', color: 'var(--text-secondary)' }}>
                        ✅ Crawled <strong style={{ color: 'var(--accent-success)' }}>{currentCompetitor?.page_count || '?'}</strong> strategic pages
                    </p>
                    <button
                        className="btn btn-success btn-lg"
                        onClick={() => navigate('/analysis')}
                        id="go-to-analysis-btn"
                    >
                        🔬 Next: Analyze Intelligence →
                    </button>
                </div>
            )}
        </div>
    );
}
