from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
import logging

from app.services.ai_service import AIService
from app.core.database import get_db
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    callId: Optional[str] = None
    context: Optional[str] = "general"

class SummaryRequest(BaseModel):
    call_id: str
    context: str

class ChatResponse(BaseModel):
    response: str
    suggestions: Optional[list] = []

class SummaryResponse(BaseModel):
    summary: str
    status: str

@router.post("/generate-summary", response_model=SummaryResponse)
async def generate_summary(
    request: SummaryRequest,
    db: Session = Depends(get_db)
):
    """Generate AI summary from live speech transcript"""
    try:
        ai_service = AIService()
        
        logger.info(f"🤖 Generating live speech summary for call {request.call_id}")
        
        summary = await ai_service.generate_call_summary(
            call_id=request.call_id,
            context=request.context
        )
        
        return SummaryResponse(
            summary=summary,
            status="success"
        )
        
    except Exception as e:
        logger.error(f"❌ AI summary generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Summary generation failed: {str(e)}")

@router.post("/chat", response_model=ChatResponse)
async def ai_chat(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """Handle AI chat requests from the frontend"""
    try:
        ai_service = AIService()
        
        # Get call context if callId is provided
        call_context = {}
        if request.callId:
            # In a real implementation, you would fetch call data from the database
            call_context = {
                "call_id": request.callId,
                "context": "active_call"
            }
        
        # Generate AI response based on context
        if request.context == "call_assistance":
            response_text = await ai_service.generate_call_assistance(
                message=request.message,
                call_context=call_context
            )
        else:
            response_text = await ai_service.generate_response(
                message=request.message,
                context=request.context
            )
        
        # Generate suggestions based on the conversation
        suggestions = await ai_service.generate_suggestions(
            message=request.message,
            response=response_text,
            context=request.context
        )
        
        return ChatResponse(
            response=response_text,
            suggestions=suggestions
        )
        
    except Exception as e:
        logger.error(f"AI chat error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate AI response"
        )

@router.post("/suggestions")
async def get_ai_suggestions(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """Get AI suggestions for the current call context"""
    try:
        ai_service = AIService()
        
        suggestions = await ai_service.get_context_suggestions(
            call_id=request.callId,
            current_message=request.message
        )
        
        return {"suggestions": suggestions}
        
    except Exception as e:
        logger.error(f"AI suggestions error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get AI suggestions"
        )

@router.post("/analyze-sentiment")
async def analyze_sentiment(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """Analyze sentiment of the conversation"""
    try:
        ai_service = AIService()
        
        sentiment = await ai_service.analyze_sentiment(request.message)
        
        return {"sentiment": sentiment}
        
    except Exception as e:
        logger.error(f"Sentiment analysis error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to analyze sentiment"
        )

class SummaryRequest(BaseModel):
    call_id: str
    context: Optional[str] = "Customer support call"

class SummaryResponse(BaseModel):
    summary: str
    key_points: list

@router.post("/test-openai")
async def test_openai_connection():
    """Test OpenAI connection and API key"""
    try:
        ai_service = AIService()
        
        # Simple test prompt
        test_prompt = "Say 'Hello, OpenAI is working!' in a friendly way."
        
        if ai_service.providers.get("openai"):
            response = await ai_service._generate_openai(test_prompt)
            return {
                "status": "success",
                "message": "OpenAI connection working",
                "response": response,
                "provider": "openai"
            }
        else:
            return {
                "status": "error",
                "message": "OpenAI provider not initialized",
                "providers": list(ai_service.providers.keys())
            }
            
    except Exception as e:
        logger.error(f"OpenAI test failed: {str(e)}")
        return {
            "status": "error",
            "message": f"OpenAI test failed: {str(e)}",
            "error_type": type(e).__name__
        }

@router.post("/generate-summary", response_model=SummaryResponse)
async def generate_call_summary(
    request: SummaryRequest,
    db: Session = Depends(get_db)
):
    """Generate AI summary for call transfer"""
    try:
        ai_service = AIService()
        
        # Generate comprehensive call summary
        summary = await ai_service.generate_call_summary(
            call_id=request.call_id,
            context=request.context
        )
        
        key_points = [
            "Customer issue has been documented",
            "Previous solutions attempted",
            "Current escalation reason",
            "Recommended next steps"
        ]
        
        return SummaryResponse(
            summary=summary,
            key_points=key_points
        )
        
    except Exception as e:
        logger.error(f"Summary generation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate summary"
        )

class VoiceSummaryRequest(BaseModel):
    briefing_room: str
    summary: str
    target_agent_id: str

@router.post("/speak-summary")
async def speak_summary_to_agent(
    request: VoiceSummaryRequest,
    db: Session = Depends(get_db)
):
    """AI speaks summary to target agent via text-to-speech"""
    try:
        ai_service = AIService()
        
        # Generate spoken summary for the target agent
        result = await ai_service.speak_call_summary(
            briefing_room=request.briefing_room,
            summary=request.summary,
            target_agent_id=request.target_agent_id
        )
        
        return {
            "success": True,
            "message": "AI is speaking summary to target agent",
            "duration_seconds": result.get("duration", 5)
        }
        
    except Exception as e:
        logger.error(f"Voice summary error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to speak summary"
        )