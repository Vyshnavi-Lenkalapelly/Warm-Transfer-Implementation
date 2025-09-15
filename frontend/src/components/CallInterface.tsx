"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { 
  LiveKitRoom, 
  VideoConference,
  RoomAudioRenderer,
  useTracks,
  useLocalParticipant,
  useRoomContext
} from '@livekit/components-react';
import { Room, RoomEvent, Participant, Track } from 'livekit-client';
import { Button } from '@/components/ui/Button';
import { TransferPanel } from '@/components/TransferPanel';
import { CallControls } from '@/components/CallControls';
import { CallMetrics } from '@/components/CallMetrics';
import { AIAssistant } from '@/components/AIAssistant';
import { WarmTransferPanel } from '@/components/WarmTransferPanel';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff,
  UserPlus,
  ArrowRight,
  MessageSquare,
  BarChart3
} from 'lucide-react';

interface CallInterfaceProps {
  roomName: string;
  token: string;
  serverUrl?: string;
  onDisconnect?: () => void;
  onTransferRequest?: (transferData: any) => void;
  callId?: string;
  agentId?: string;
}

export function CallInterface({
  roomName,
  token,
  serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://warm-transfer-sys-7kc6ksqn.livekit.cloud',
  onDisconnect,
  onTransferRequest,
  callId,
  agentId
}: CallInterfaceProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callStartTime] = useState(Date.now());

  // Update call duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [callStartTime]);

  const handleRoomConnected = useCallback(() => {
    setIsConnected(true);
    console.log('Room connected:', roomName);
  }, [roomName]);

  const handleRoomUpdate = useCallback((room: Room) => {
    setRoom(room);
    
    // Set up event listeners
    room.on(RoomEvent.ParticipantConnected, (participant: Participant) => {
      console.log('Participant connected:', participant.identity);
    });
    
    room.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
      console.log('Participant disconnected:', participant.identity);
    });
    
    room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: Participant) => {
      console.log('Data received from:', participant?.identity);
    });
  }, []);

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    setRoom(null);
    onDisconnect?.();
  }, [onDisconnect]);

  const toggleAudio = useCallback(async () => {
    if (room) {
      await room.localParticipant.setMicrophoneEnabled(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  }, [room, isAudioEnabled]);

  const toggleVideo = useCallback(async () => {
    if (room) {
      await room.localParticipant.setCameraEnabled(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [room, isVideoEnabled]);

  const handleTransfer = useCallback((transferData: any) => {
    onTransferRequest?.(transferData);
    setShowTransferPanel(false);
  }, [onTransferRequest]);

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Component to handle room events inside LiveKitRoom context
  const RoomEventHandler = () => {
    const room = useRoomContext();
    const { localParticipant } = useLocalParticipant();
    
    useEffect(() => {
      if (room && !isConnected) {
        setRoom(room);
        setIsConnected(true);
        
        // Set initial audio/video state based on room
        setIsAudioEnabled(localParticipant.isMicrophoneEnabled);
        setIsVideoEnabled(localParticipant.isCameraEnabled);
        
        room.on(RoomEvent.ParticipantConnected, (participant: Participant) => {
          console.log('Participant connected:', participant.identity);
        });
        
        room.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
          console.log('Participant disconnected:', participant.identity);
        });
        
        room.on(RoomEvent.LocalTrackPublished, (track) => {
          console.log('Local track published:', track.kind);
        });
        
        room.on(RoomEvent.LocalTrackUnpublished, (track) => {
          console.log('Local track unpublished:', track.kind);
        });
      }
    }, [room, localParticipant, isConnected]);
    
    // Monitor audio/video state changes
    useEffect(() => {
      if (localParticipant) {
        const handleTrackMuted = (track: any) => {
          if (track.kind === Track.Kind.Audio) {
            setIsAudioEnabled(false);
          } else if (track.kind === Track.Kind.Video) {
            setIsVideoEnabled(false);
          }
        };
        
        const handleTrackUnmuted = (track: any) => {
          if (track.kind === Track.Kind.Audio) {
            setIsAudioEnabled(true);
          } else if (track.kind === Track.Kind.Video) {
            setIsVideoEnabled(true);
          }
        };
        
        localParticipant.on('trackMuted', handleTrackMuted);
        localParticipant.on('trackUnmuted', handleTrackUnmuted);
        
        return () => {
          localParticipant.off('trackMuted', handleTrackMuted);
          localParticipant.off('trackUnmuted', handleTrackUnmuted);
        };
      }
    }, [localParticipant]);
    
    return null;
  };

  return (
    <div className="call-interface bg-gray-900 text-white">
      <LiveKitRoom
        video={isVideoEnabled}
        audio={isAudioEnabled}
        token={token}
        serverUrl={serverUrl}
        onConnected={handleRoomConnected}
        onDisconnected={() => setIsConnected(false)}
        options={{
          adaptiveStream: true,
          dynacast: true,
        }}
        className="h-full"
        onError={(error) => {
          console.error('LiveKit room error:', error);
          alert(`Connection error: ${error.message}. Please try again.`);
        }}
      >
        {/* Header */}
        <div className="call-header p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-4 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Live Call</span>
              </div>
              <span className="text-sm text-gray-300">
                Duration: {formatDuration(callDuration)}
              </span>
            </div>
            
            <div className="btn-group">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMetrics(!showMetrics)}
                className="text-white hover:bg-white/10 flex-shrink-0"
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Metrics</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAIAssistant(!showAIAssistant)}
                className="text-white hover:bg-white/10 flex-shrink-0"
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">AI</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTransferPanel(!showTransferPanel)}
                className="text-white hover:bg-white/10 flex-shrink-0"
              >
                <UserPlus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Transfer</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Main Video Area */}
        <div className="video-container">
          <VideoConference />
          <RoomAudioRenderer />
          <RoomEventHandler />
        </div>

        {/* Call Controls */}
        <div className="call-controls">
          <div className="border-t border-gray-700 p-4">
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant={isAudioEnabled ? "ghost" : "destructive"}
                size="lg"
                onClick={toggleAudio}
                className="rounded-full w-12 h-12 text-white hover:bg-white/10 flex-shrink-0"
              >
                {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>

              <Button
                variant={isVideoEnabled ? "ghost" : "destructive"}
                size="lg"
                onClick={toggleVideo}
                className="rounded-full w-12 h-12 text-white hover:bg-white/10 flex-shrink-0"
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>

              <Button
                variant="destructive"
                size="lg"
                onClick={handleDisconnect}
                className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 flex-shrink-0"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Side Panels */}
        {showTransferPanel && (
          <div className="side-panel">
            <WarmTransferPanel
              callId={callId || 'mock-call-id'}
              currentAgentId={agentId || 'agent-001'}
              onClose={() => setShowTransferPanel(false)}
              onTransferComplete={(data) => {
                console.log('Transfer completed:', data);
                setShowTransferPanel(false);
              }}
            />
          </div>
        )}

        {showAIAssistant && (
          <div className="side-panel">
            <AIAssistant
              callId={callId}
              onClose={() => setShowAIAssistant(false)}
            />
          </div>
        )}

        {showMetrics && (
          <div className="side-panel">
            <CallMetrics
              room={room}
              callId={callId}
              onClose={() => setShowMetrics(false)}
            />
          </div>
        )}
      </LiveKitRoom>
    </div>
  );
}

export default CallInterface;