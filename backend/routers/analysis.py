"""Analysis router — Run analyst engine and retrieve signals."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Competitor, CrawledPage, Signal, Company
from agents.analyst import run_analyst

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


class SignalResponse(BaseModel):
    id: int
    signal_type: str
    category: str
    title: str
    description: str
    severity: str
    relevance: float
    confidence: float
    evidence: list

    class Config:
        from_attributes = True


class AnalysisResult(BaseModel):
    competitor_name: str
    signals: list[SignalResponse]
    feature_comparison: dict
    pricing_comparison: dict
    market_insights: dict


@router.post("/run/{competitor_id}")
async def run_analysis(competitor_id: int, db: AsyncSession = Depends(get_db)):
    """Run the full analyst engine on a competitor's crawled data."""
    # Get competitor
    result = await db.execute(select(Competitor).where(Competitor.id == competitor_id))
    competitor = result.scalar_one_or_none()
    if not competitor:
        raise HTTPException(status_code=404, detail="Competitor not found")
    if competitor.status not in ("crawled", "done"):
        raise HTTPException(status_code=400, detail="Competitor must be fully crawled first")

    # Get company profile
    result = await db.execute(select(Company).where(Company.id == competitor.company_id))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Get crawled pages
    result = await db.execute(
        select(CrawledPage)
        .where(CrawledPage.competitor_id == competitor_id)
        .order_by(CrawledPage.strategic_score.desc())
    )
    pages = result.scalars().all()

    if not pages:
        raise HTTPException(status_code=400, detail="No crawled pages found")

    # Build inputs
    company_profile = {
        "name": company.name,
        "summary": company.summary,
        "features": company.features,
        "icp": company.icp,
        "positioning": company.positioning,
        "pricing": company.pricing,
    }

    page_dicts = [
        {
            "url": p.url,
            "title": p.title,
            "content_md": p.content_md,
            "page_type": p.page_type,
            "strategic_score": p.strategic_score,
        }
        for p in pages
    ]

    # Run analysis
    try:
        analysis = await run_analyst(company_profile, page_dicts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    # Update competitor name if detected
    comp_name = analysis.get("competitor_name", "")
    if comp_name and not competitor.name:
        competitor.name = comp_name

    # Store signals
    signals_data = analysis.get("signals", [])
    stored_signals = []
    for sig_data in signals_data:
        signal = Signal(
            signal_type=sig_data.get("signal_type", "opportunity"),
            category=sig_data.get("category", ""),
            title=sig_data.get("title", ""),
            description=sig_data.get("description", ""),
            severity=sig_data.get("severity", "moderate"),
            relevance=sig_data.get("relevance", 50),
            confidence=sig_data.get("confidence", 50),
            evidence=sig_data.get("evidence", []),
            competitor_id=competitor_id,
        )
        db.add(signal)
        stored_signals.append(signal)

    competitor.status = "analyzed"
    await db.commit()

    # Refresh signals to get IDs
    for s in stored_signals:
        await db.refresh(s)

    return {
        "competitor_name": comp_name,
        "signals": stored_signals,
        "feature_comparison": analysis.get("feature_comparison", {}),
        "pricing_comparison": analysis.get("pricing_comparison", {}),
        "market_insights": analysis.get("market_insights", {}),
    }


@router.get("/{competitor_id}/signals", response_model=list[SignalResponse])
async def get_signals(competitor_id: int, db: AsyncSession = Depends(get_db)):
    """Get all signals for a competitor."""
    result = await db.execute(
        select(Signal)
        .where(Signal.competitor_id == competitor_id)
        .order_by(Signal.relevance.desc())
    )
    return result.scalars().all()
