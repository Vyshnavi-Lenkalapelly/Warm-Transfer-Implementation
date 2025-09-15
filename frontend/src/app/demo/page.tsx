"use client"

import { useState } from "react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function DemoPage() {
  const [step, setStep] = useState(1);
  const [demoData, setDemoData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const runDemo = async () => {
    setLoading(true);
    setStep(1);

    try {
      // Step 1: Agent A starts recording
      setStep(1);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 2: Conversation happens (simulated)
      setStep(2);
      const transcript = `Agent A: Hello, how can I help you today?

Customer: Hi, I'm having trouble with my billing account. My payment failed last week and I can't access my important work documents.

Agent A: I understand your concern. Let me check your account status. I can see there was a payment issue, but this requires our billing specialist to resolve properly.

Customer: Okay, I really need this fixed today as I have important work documents in my account.

Agent A: Absolutely, I'm going to transfer you to our billing specialist who can resolve this immediately. They'll have all the details of our conversation.`;

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 3: AI processes transcript and starts transfer
      setStep(3);
      const transferResponse = await fetch(`${BACKEND}/api/v1/warm-transfer/start-warm-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_room: 'demo-call-room',
          agent_a_identity: 'Agent A',
          agent_b_identity: 'Agent B',
          caller_identity: 'Customer',
          conversation_transcript: transcript
        })
      });

      const transferData = await transferResponse.json();
      setDemoData({ ...demoData, transfer: transferData, transcript });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 4: Agent B joins
      setStep(4);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 5: Complete transfer
      setStep(5);
      const completeResponse = await fetch(`${BACKEND}/api/v1/warm-transfer/complete-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transfer_room: transferData.transfer_room,
          caller_identity: 'Customer',
          agent_b_identity: 'Agent B'
        })
      });

      const completeData = await completeResponse.json();
      setDemoData({ ...demoData, transfer: transferData, complete: completeData, transcript });

      setStep(6);

    } catch (error) {
      console.error('Demo failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="step-content">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl">👤</div>
              <div>
                <h3 className="text-xl font-bold">Agent A</h3>
                <p className="text-gray-300">Starting voice recording...</p>
                <div className="flex items-center space-x-2 mt-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm">Recording Active</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <div className="space-y-4">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl">👤</div>
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-2xl">🗣️</div>
              </div>
              <h3 className="text-xl font-bold">Live Conversation</h3>
              <div className="bg-gray-800 p-4 rounded-lg max-h-64 overflow-y-auto">
                {demoData.transcript && (
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap">
                    {demoData.transcript}
                  </pre>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm">AI listening and processing...</span>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-2xl">🤖</div>
                <div>
                  <h3 className="text-xl font-bold">AI Processing</h3>
                  <p className="text-gray-300">Generating call summary...</p>
                </div>
              </div>
              {demoData.transfer && (
                <div className="bg-green-900 p-4 rounded-lg">
                  <h4 className="font-bold mb-2">AI Call Summary:</h4>
                  <p className="text-sm text-gray-200">{demoData.transfer.summary}</p>
                </div>
              )}
              <div className="bg-blue-900 p-4 rounded-lg">
                <h4 className="font-bold mb-2">Transfer Room Created:</h4>
                <p className="text-sm text-gray-200">
                  Room: {demoData.transfer?.transfer_room}
                </p>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl mb-2">👤</div>
                  <p className="text-sm">Agent A</p>
                </div>
                <div className="text-4xl">➡️</div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center text-2xl mb-2">👨‍💼</div>
                  <p className="text-sm">Agent B</p>
                </div>
              </div>
              <h3 className="text-xl font-bold text-center">Agent B Joining Transfer Room</h3>
              <div className="bg-orange-900 p-4 rounded-lg">
                <h4 className="font-bold mb-2">Briefing Agent B:</h4>
                <p className="text-sm text-gray-200">
                  "The customer has billing issues - payment failed last week and can't access documents. 
                  Account verified, needs specialist attention. Customer is cooperative and urgent."
                </p>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="step-content">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-center">Completing Transfer</h3>
              <div className="flex items-center justify-center space-x-8">
                <div className="text-center opacity-50">
                  <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center text-2xl mb-2">👤</div>
                  <p className="text-sm">Agent A (Leaving)</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-2xl mb-2">🗣️</div>
                  <p className="text-sm">Customer</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center text-2xl mb-2">👨‍💼</div>
                  <p className="text-sm">Agent B</p>
                </div>
              </div>
              <div className="bg-green-900 p-4 rounded-lg">
                <h4 className="font-bold mb-2">Transfer Complete!</h4>
                <p className="text-sm text-gray-200">
                  Final Room: {demoData.complete?.final_room}
                </p>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="step-content">
            <div className="text-center space-y-4">
              <div className="text-6xl">✅</div>
              <h3 className="text-2xl font-bold text-green-400">Warm Transfer Complete!</h3>
              <div className="bg-green-900 p-6 rounded-lg">
                <h4 className="font-bold mb-4">Summary:</h4>
                <ul className="text-left space-y-2 text-sm">
                  <li>✅ Voice conversation recorded and processed</li>
                  <li>✅ AI generated intelligent call summary</li>
                  <li>✅ Agent B briefed with context</li>
                  <li>✅ Smooth handoff completed</li>
                  <li>✅ Customer continues with Agent B</li>
                </ul>
              </div>
              <button 
                onClick={runDemo} 
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold"
              >
                Run Demo Again
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">
          🎯 Warm Transfer System Demo
        </h1>
        
        <div className="max-w-4xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm">Step {step} of 6</span>
              <span className="text-sm">{Math.round((step / 6) * 100)}% Complete</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(step / 6) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Step Content */}
          <div className="bg-gray-800 rounded-lg p-8 min-h-96">
            {renderStep()}
          </div>

          {/* Controls */}
          {step === 1 && (
            <div className="text-center mt-8">
              <button 
                onClick={runDemo} 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-8 py-4 rounded-lg font-bold text-lg"
              >
                {loading ? 'Running Demo...' : 'Start Warm Transfer Demo'}
              </button>
            </div>
          )}

          {/* Tech Stack */}
          <div className="mt-12 bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">🛠️ Technology Stack</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl mb-2">🎤</div>
                <p className="font-bold">Speech Recognition</p>
                <p className="text-gray-400">Web Speech API</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">🤖</div>
                <p className="font-bold">AI Summarization</p>
                <p className="text-gray-400">OpenAI GPT-3.5</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">📹</div>
                <p className="font-bold">Video Calls</p>
                <p className="text-gray-400">LiveKit</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">⚡</div>
                <p className="font-bold">Backend</p>
                <p className="text-gray-400">FastAPI + Python</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}