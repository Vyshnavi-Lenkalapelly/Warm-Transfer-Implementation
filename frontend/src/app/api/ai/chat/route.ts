import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, callId, context } = body;

    // Call the backend API
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/v1/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        callId,
        context
      }),
    });

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('AI chat API error:', error);
    
    // Return a fallback response
    return NextResponse.json({
      response: "I'm here to help! However, I'm currently experiencing some technical difficulties. In the meantime, I recommend focusing on understanding the customer's main concern and documenting any important details for the next agent.",
      suggestions: [
        "Ask clarifying questions about the customer's issue",
        "Document all relevant details",
        "Consider escalating if the issue is complex"
      ]
    });
  }
}