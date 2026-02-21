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

    # Define the Email Sending Tool
    send_email_tool = {
        "function_declarations": [
            {
                "name": "send_email",
                "description": "Send a sales or intelligence email to a specific recipient.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "recipient_email": {
                            "type": "STRING",
                            "description": "The exact email address to send to."
                        },
                        "subject": {
                            "type": "STRING",
                            "description": "A catchy, relevant subject line."
                        },
                        "body": {
                            "type": "STRING",
                            "description": "The body of the email. Keep it plain text but well formatted with newlines. Be extremely persuasive based on the competitor intel."
                        }
                    },
                    "required": ["recipient_email", "subject", "body"]
                }
            }
        ]
    }

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=system_prompt,
        tools=send_email_tool
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

    # Check if the model decided to call the send_email function
    if response.parts and hasattr(response.parts[0], 'function_call') and response.parts[0].function_call:
        fc = response.parts[0].function_call
        if fc.name == "send_email":
            args = fc.args
            recipient = args.get("recipient_email")
            subject = args.get("subject")
            body = args.get("body")
            
            # Use the existing sales router logic to dispatch the email
            from routers.sales import SalesSendRequest, send_sales_email
            req = SalesSendRequest(recipient_email=recipient, subject=subject, body=body)
            # Actually trigger the send
            try:
                import sys
                print(f"\\n\\033[1;33m[AGENT] Chatbot executing send_email_tool...\\033[0m", file=sys.stderr)
                send_result = await send_sales_email(req)
                status_msg = send_result.get("message", "Success")
                return f"📧 **Email Sent!**\\n\\nI've successfully dispatched the email to **{recipient}** with the subject *'{subject}'*.\\n\\n*(System Status: {status_msg})*"
            except Exception as e:
                return f"❌ **Email Delivery Failed:** {str(e)}"

    return response.text
