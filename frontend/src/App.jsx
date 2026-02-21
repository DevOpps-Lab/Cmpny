import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Onboarding from './pages/Onboarding';
import CompetitorAdd from './pages/CompetitorAdd';
import Analysis from './pages/Analysis';
import Dashboard from './pages/Dashboard';
import CompareView from './pages/CompareView';

function App() {
    const [companyId, setCompanyId] = useState(null);
    const [competitorId, setCompetitorId] = useState(null);
    const [companyData, setCompanyData] = useState(null);
    const [analysisData, setAnalysisData] = useState(null);
    const [planData, setPlanData] = useState(null);

    return (
        <BrowserRouter>
            <div className="app-layout">
                <nav className="navbar">
                    <div className="navbar-brand">
                        <div className="logo">⚡</div>
                        <span>Compy</span>
                    </div>
                    <ul className="navbar-nav">
                        <li><NavLink to="/" end>Onboard</NavLink></li>
                        <li>
                            <NavLink to="/competitor" className={!companyId ? 'disabled' : ''}>
                                Scout
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/analysis" className={!competitorId ? 'disabled' : ''}>
                                Analyze
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/dashboard" className={!competitorId ? 'disabled' : ''}>
                                Dashboard
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/compare" className={!companyId ? 'disabled' : ''}>
                                Compare
                            </NavLink>
                        </li>
                    </ul>
                </nav>

                <div className="page-container">
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <Onboarding
                                    onComplete={(company) => {
                                        setCompanyId(company.id);
                                        setCompanyData(company);
                                    }}
                                    companyData={companyData}
                                />
                            }
                        />
                        <Route
                            path="/competitor"
                            element={
                                companyId ? (
                                    <CompetitorAdd
                                        companyId={companyId}
                                        onComplete={(comp) => setCompetitorId(comp.id)}
                                        competitorId={competitorId}
                                    />
                                ) : (
                                    <Navigate to="/" replace />
                                )
                            }
                        />
                        <Route
                            path="/analysis"
                            element={
                                competitorId ? (
                                    <Analysis
                                        competitorId={competitorId}
                                        onAnalysisComplete={setAnalysisData}
                                        onPlanComplete={setPlanData}
                                        analysisData={analysisData}
                                        planData={planData}
                                    />
                                ) : (
                                    <Navigate to="/" replace />
                                )
                            }
                        />
                        <Route
                            path="/dashboard"
                            element={
                                competitorId ? (
                                    <Dashboard
                                        competitorId={competitorId}
                                        companyData={companyData}
                                        analysisData={analysisData}
                                        planData={planData}
                                    />
                                ) : (
                                    <Navigate to="/" replace />
                                )
                            }
                        />
                        <Route
                            path="/compare"
                            element={
                                companyId ? (
                                    <CompareView
                                        companyId={companyId}
                                        companyData={companyData}
                                    />
                                ) : (
                                    <Navigate to="/" replace />
                                )
                            }
                        />
                    </Routes>
                </div>
            </div>
        </BrowserRouter>
    );
}

export default App;
