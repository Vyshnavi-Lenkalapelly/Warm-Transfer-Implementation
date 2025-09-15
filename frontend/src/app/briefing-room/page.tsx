"use client"

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import { Button } from '@/components/ui/Button';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff,
  MessageSquare,
  CheckCircle
} from 'lucide-react';

export default function BriefingRoom() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const room = searchParams.get('room');
  
  const [isConnected, setIsConnected] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [briefingComplete, setBriefingComplete] = useState(false);

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_WS_URL || 'wss://project-warm-transfer-implementation-jmsg4oli.livekit.cloud';

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
  };

  const completeBriefing = () => {
    setBriefingComplete(true);
    // In a real app, this would notify the main application
    if (window.opener) {
      window.opener.postMessage({ type: 'briefing_complete' }, '*');
    }
    
    setTimeout(() => {
      window.close();
    }, 2000);
  };

  if (!token || !room) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid Briefing Room</h1>
          <p>Missing token or room information.</p>
        </div>
      </div>
    );
  }

  if (briefingComplete) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Briefing Complete</h1>
          <p>You can now close this window.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <LiveKitRoom
        video={isVideoEnabled}
        audio={isAudioEnabled}
        token={token}
        serverUrl={serverUrl}
        onConnected={() => setIsConnected(true)}
        onDisconnected={() => setIsConnected(false)}
        className="h-screen"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-black/70 backdrop-blur-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-blue-400" />
                <span className="font-medium">Agent Briefing Room</span>
              </div>
              {isConnected && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-400">Connected</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Video Area */}
        <div className="relative h-full pt-16 pb-20">
          <VideoConference />
          <RoomAudioRenderer />
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="bg-black/70 backdrop-blur-sm border-t border-gray-700 p-4">
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant={isAudioEnabled ? "ghost" : "destructive"}
                size="lg"
                onClick={toggleAudio}
                className="rounded-full w-12 h-12 text-white hover:bg-white/10"
              >
                {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>

              <Button
                variant={isVideoEnabled ? "ghost" : "destructive"}
                size="lg"
                onClick={toggleVideo}
                className="rounded-full w-12 h-12 text-white hover:bg-white/10"
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>

              <Button
                onClick={completeBriefing}
                className="bg-green-600 hover:bg-green-700 px-6"
                disabled={!isConnected}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete Briefing
              </Button>

              <Button
                variant="destructive"
                size="lg"
                onClick={() => window.close()}
                className="rounded-full w-12 h-12"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Briefing Guide */}
        <div className="absolute top-20 right-4 w-80 bg-black/80 backdrop-blur-sm rounded-lg p-4 z-20">
          <h3 className="font-semibold text-white mb-3">Briefing Checklist</h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Customer's main issue or concern
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Steps already taken to resolve
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Customer's emotional state/tone
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Important account or case details
            </li>
            <li className="flex items-start">
              <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              Recommended next actions
            </li>
          </ul>
        </div>
      </LiveKitRoom>
    </div>
  );
}