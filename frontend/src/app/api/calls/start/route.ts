import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caller_name, caller_phone, caller_info, priority, agent_id } = body;

    // Call the backend API
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/v1/calls/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caller_name,
        caller_phone,
        caller_info,
        priority,
        agent_id
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start call');
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Start call API error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start call' },
      { status: 500 }
    );
  }
}