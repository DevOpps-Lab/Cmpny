"""Analyst Engine — Differential reasoning for threat/opportunity extraction."""

import json
import google.generativeai as genai
from config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)

ANALYSIS_PROMPT = """You are an elite competitive intelligence analyst. You have two inputs:

1. YOUR COMPANY (the user's company):
{company_profile}

2. COMPETITOR PAGES (scraped and classified):
{competitor_pages}

Perform DIFFERENTIAL REASONING — compare the competitor's strategy, features, pricing, and positioning AGAINST the user's company.

Return valid JSON ONLY with this structure:
{{
  "competitor_name": "Detected competitor name",
  "signals": [
    {{
      "signal_type": "threat" or "opportunity",
      "category": "feature_gap" | "pricing" | "market_shift" | "positioning" | "enterprise" | "integration" | "security" | "content_strategy",
      "title": "Clear, actionable signal title",
      "description": "2-3 sentence explanation of why this matters",
      "severity": "existential" | "moderate" | "minor",
      "relevance": 0-100,
      "confidence": 0-100,
      "evidence": [
        {{"source_url": "URL where this was found", "quote": "Key quote or data point", "page_type": "Page type"}}
      ]
    }}
  ],
  "feature_comparison": {{
    "your_advantages": ["Features/capabilities you have that they don't"],
    "their_advantages": ["Features/capabilities they have that you don't"],
    "shared_features": ["Features you both have"],
    "feature_gaps": [
      {{"feature": "Feature name", "gap_severity": "critical" | "moderate" | "minor", "description": "What's missing"}}
    ]
  }},
  "pricing_comparison": {{
    "your_pricing_summary": "Summary of your pricing",
    "their_pricing_summary": "Summary of their pricing",
    "price_advantage": "you" | "them" | "comparable",
    "key_differences": ["Notable pricing strategy differences"]
  }},
  "market_insights": {{
    "positioning_overlap": 0-100,
    "target_audience_overlap": 0-100,
    "competitive_intensity": "high" | "medium" | "low",
    "market_trends": ["Relevant market trends observed"]
  }}
}}

RULES:
- Only include signals with confidence >= 40
- Every signal MUST have at least one evidence item
- Be specific, not generic — cite actual features, prices, and strategies
- Focus on ACTIONABLE intelligence, not observations
- Identify at least 3 threats and 3 opportunities if the data supports it"""


async def run_analyst(company_profile: dict, competitor_pages: list[dict]) -> dict:
    """
    Run differential analysis comparing company DNA vs competitor data.
    
    Args:
        company_profile: User's company DNA dict
        competitor_pages: List of {url, title, content_md, page_type, strategic_score}
    
    Returns:
        Full analysis dict with signals, feature comparison, pricing comparison, market insights
    """
    # Build company profile summary
    company_text = json.dumps({
        "name": company_profile.get("name", ""),
        "summary": company_profile.get("summary", ""),
        "features": company_profile.get("features", []),
        "icp": company_profile.get("icp", {}),
        "positioning": company_profile.get("positioning", {}),
        "pricing": company_profile.get("pricing", {}),
    }, indent=2)

    # Build competitor pages summary — prioritize high-strategic-score pages
    sorted_pages = sorted(competitor_pages, key=lambda p: p.get("strategic_score", 0), reverse=True)
    
    competitor_text = ""
    for page in sorted_pages[:20]:  # Top 20 strategic pages
        content = page["content_md"][:3000]  # Limit per page
        competitor_text += f"\n\n--- [{page['page_type']}] {page['title']} ({page['url']}) ---\n{content}"

    # Truncate total if needed
    if len(competitor_text) > 60000:
        competitor_text = competitor_text[:60000]

    model = genai.GenerativeModel("gemini-2.5-flash")
    response = await model.generate_content_async(
        ANALYSIS_PROMPT.format(
            company_profile=company_text,
            competitor_pages=competitor_text
        ),
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )

    try:
        result = json.loads(response.text)
    except json.JSONDecodeError:
        text = response.text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            result = json.loads(text[start:end])
        else:
            result = {"signals": [], "feature_comparison": {}, "pricing_comparison": {}, "market_insights": {}}

    return result


SCORING_PROMPT = """You are a competitive intelligence analyst. Based on these intelligence signals about a competitor, score them on each dimension from 0 to 10.

SIGNALS:
{signals_text}

Return valid JSON ONLY:
{{
  "features": 0-10,
  "pricing": 0-10,
  "market_position": 0-10,
  "growth_signals": 0-10,
  "enterprise_readiness": 0-10,
  "community": 0-10
}}

Scoring guide:
- features: Breadth & depth of product capabilities
- pricing: Competitiveness & flexibility of pricing
- market_position: Brand strength & market share indicators
- growth_signals: Evidence of rapid growth or expansion
- enterprise_readiness: Security, compliance, scale features
- community: Developer community, ecosystem, integrations"""


async def score_competitor_dimensions(signals: list[dict]) -> dict:
    """
    Use Gemini to score a competitor on 6 strategic axes based on their signals.
    Returns dict with keys: features, pricing, market_position, growth_signals, enterprise_readiness, community
    Each value is 0-10.
    """
    if not signals:
        return {
            "features": 5, "pricing": 5, "market_position": 5,
            "growth_signals": 5, "enterprise_readiness": 5, "community": 5,
        }

    # Summarize signals for the prompt
    signals_text = ""
    for s in signals[:15]:  # Cap at 15 to save tokens
        signals_text += f"- [{s.get('signal_type', '')}] [{s.get('severity', '')}] {s.get('title', '')}: {s.get('description', '')}\n"

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = await model.generate_content_async(
            SCORING_PROMPT.format(signals_text=signals_text),
            generation_config=genai.GenerationConfig(
                temperature=0.2,
                response_mime_type="application/json",
            ),
        )
        result = json.loads(response.text)
        # Clamp values to 0-10
        for key in ["features", "pricing", "market_position", "growth_signals", "enterprise_readiness", "community"]:
            result[key] = max(0, min(10, int(result.get(key, 5))))
        return result
    except Exception as e:
        print(f"[ANALYST] Scoring failed: {e}")
        return {
            "features": 5, "pricing": 5, "market_position": 5,
            "growth_signals": 5, "enterprise_readiness": 5, "community": 5,
        }
