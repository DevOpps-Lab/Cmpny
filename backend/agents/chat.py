import json
import google.generativeai as genai
from config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)

CHAT_SYSTEM_PROMPT = """You are Compy AI, an elite Competitive Intelligence Analyst embedded inside the Compy platform.
You have been given a full intelligence dossier on a competitor. 
Your job is to answer strategic sales, marketing, and product questions from the user's team in a concise, direct, and actionable manner.
You are talking to a founder or a sales leader. Be sharp. No fluff. No disclaimers.

## COMPETITOR INTELLIGENCE DOSSIER
Competitor Name: {competitor_name}
Competitor URL: {competitor_url}

### Pricing
Model: {pricing_model}
Community Sentiment on Pricing: {pricing_complaints}
Community Price Perception: {community_price_perception}

### Where We Win (Feature Gaps)
{we_win}

### Where They Win (Feature Gaps)
{they_win}

### Community Sentiment
Overall Score: {sentiment_score}/100
Trend: {sentiment_trend}
Top Praise: {top_praise}
Top Complaints: {top_complaints}

### Competitor's Strategic Positioning
{positioning}

## IMPORTANT GUIDELINES
- Answer questions only based on the intelligence dossier above.
- If asked to write an email or sales script, do so. Keep it short and punchy.
- If you don't have enough data to answer, say "I don't have enough intel on that yet."
- Never make up data that is not in the dossier.
- Keep responses short (max 150 words) unless the user explicitly asks for something longer.
"""

async def chat_with_analyst(context: dict, history: list, user_message: str) -> str:
    system_prompt = CHAT_SYSTEM_PROMPT.format(
        competitor_name=context.get("competitor_name", "Unknown"),
        competitor_url=context.get("competitor_url", "Unknown"),
        pricing_model=context.get("pricing_model", "Unknown"),
        pricing_complaints=", ".join(context.get("pricing_complaints", [])),
        community_price_perception=context.get("community_price_perception", "Unknown"),
        we_win="\n".join([f"- {f}" for f in context.get("we_win", [])]) or "None identified",
        they_win="\n".join([f"- {f}" for f in context.get("they_win", [])]) or "None identified",
        sentiment_score=context.get("sentiment_score", "N/A"),
        sentiment_trend=context.get("sentiment_trend", "N/A"),
        top_praise=", ".join(context.get("top_praise", [])),
        top_complaints=", ".join(context.get("top_complaints", [])),
        positioning=context.get("positioning", "Unknown"),
    )

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=system_prompt
    )

    # Convert history to Gemini format
    gemini_history = []
    for msg in history:
        gemini_history.append({
            "role": "user" if msg["role"] == "user" else "model",
            "parts": [msg["content"]]
        })

    chat = model.start_chat(history=gemini_history)
    response = await chat.send_message_async(user_message)
    return response.text
