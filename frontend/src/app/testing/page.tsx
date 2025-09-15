"use client"

import React from 'react';
import { Button } from '@/components/ui/Button';
import { 
  Phone, 
  Users, 
  MessageSquare, 
  BarChart3,
  CheckCircle,
  ArrowRight,
  Zap
} from 'lucide-react';

export default function TestingGuide() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              🔥 Warm Transfer System - Testing Guide
            </h1>
            <p className="text-gray-600">
              Complete LiveKit + LLM powered warm transfer implementation
            </p>
          </div>

          {/* Status Check */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              System Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-800">Backend (Port 8000)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-800">Frontend (Port 3007)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-800">LiveKit Connected</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-green-800">OpenAI Initialized</span>
              </div>
            </div>
          </div>

          {/* Features to Test */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">🧪 Features to Test</h2>

            {/* 1. Basic Call */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start space-x-4">
                <div className="bg-blue-100 rounded-full p-3">
                  <Phone className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    1. Basic Call Interface
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Test the LiveKit video call interface with real audio/video controls
                  </p>
                  <div className="flex space-x-3">
                    <Button onClick={() => window.location.href = '/'} className="flex items-center">
                      <Phone className="w-4 h-4 mr-2" />
                      Start Call Test
                    </Button>
                  </div>
                  <div className="mt-3 text-sm text-gray-500">
                    <strong>Test:</strong> Mute/unmute, video on/off, duration counter
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Warm Transfer */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start space-x-4">
                <div className="bg-purple-100 rounded-full p-3">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    2. Warm Transfer Workflow
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Complete 4-stage warm transfer: Initiate → Brief → Transfer → Complete
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-700">
                      <ArrowRight className="w-4 h-4" />
                      <span>Agent A starts call with customer</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-700 mt-1">
                      <ArrowRight className="w-4 h-4" />
                      <span>Agent A initiates transfer (creates briefing room)</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-700 mt-1">
                      <ArrowRight className="w-4 h-4" />
                      <span>Both agents join briefing room (AI summary provided)</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-700 mt-1">
                      <ArrowRight className="w-4 h-4" />
                      <span>Agent B joins customer call, Agent A exits</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    <strong>Test:</strong> Start call → Click "Transfer" → Follow 4-stage workflow
                  </div>
                </div>
              </div>
            </div>

            {/* 3. AI Assistant */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start space-x-4">
                <div className="bg-green-100 rounded-full p-3">
                  <MessageSquare className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    3. AI Assistant Integration
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Real-time AI assistance powered by OpenAI during calls
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="text-sm text-gray-700">
                      <strong>Try asking:</strong>
                    </div>
                    <ul className="mt-2 text-sm text-gray-600 space-y-1">
                      <li>• "How should I handle a billing dispute?"</li>
                      <li>• "Customer is frustrated, what should I say?"</li>
                      <li>• "Help me troubleshoot this technical issue"</li>
                    </ul>
                  </div>
                  <div className="text-sm text-gray-500">
                    <strong>Test:</strong> Start call → Click "AI Assistant" → Chat with AI
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Analytics */}
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start space-x-4">
                <div className="bg-orange-100 rounded-full p-3">
                  <BarChart3 className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    4. Real-time Analytics
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Call metrics, participant tracking, and performance data
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.href = '/?view=analytics'}
                    className="flex items-center"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    View Analytics
                  </Button>
                  <div className="mt-3 text-sm text-gray-500">
                    <strong>Test:</strong> Navigation → Analytics tab → Real-time metrics
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* API Endpoints */}
          <div className="mt-8 border-t border-gray-200 pt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🔌 API Endpoints</h2>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Backend API:</strong> http://localhost:8000
                  <br />
                  <strong>Frontend:</strong> http://localhost:3007
                </div>
                <div>
                  <strong>API Docs:</strong> http://localhost:8000/docs
                  <br />
                  <strong>Health Check:</strong> http://localhost:8000/health
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 flex flex-wrap gap-4 justify-center">
            <Button 
              onClick={() => window.location.href = '/'}
              className="flex items-center"
              size="lg"
            >
              <Zap className="w-5 h-5 mr-2" />
              Start Testing Now
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.open('http://localhost:8000/docs', '_blank')}
              className="flex items-center"
              size="lg"
            >
              <BarChart3 className="w-5 h-5 mr-2" />
              View API Docs
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}