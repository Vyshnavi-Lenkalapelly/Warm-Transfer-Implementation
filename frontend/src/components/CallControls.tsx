"use client"

import React from 'react';
import { Button } from '@/components/ui/Button';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Phone, 
  PhoneOff,
  Volume2,
  VolumeX,
  Settings,
  Circle,
  Square
} from 'lucide-react';

interface CallControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeakerEnabled: boolean;
  isRecording: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleSpeaker: () => void;
  onToggleRecording: () => void;
  onEndCall: () => void;
  onSettings?: () => void;
  disabled?: boolean;
}

export function CallControls({
  isAudioEnabled,
  isVideoEnabled,
  isSpeakerEnabled,
  isRecording,
  onToggleAudio,
  onToggleVideo,
  onToggleSpeaker,
  onToggleRecording,
  onEndCall,
  onSettings,
  disabled = false
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center space-x-4 p-4 bg-black/70 backdrop-blur-sm border-t border-gray-700">
      {/* Audio Control */}
      <Button
        variant={isAudioEnabled ? "ghost" : "destructive"}
        size="lg"
        onClick={onToggleAudio}
        disabled={disabled}
        className="rounded-full w-12 h-12 text-white hover:bg-white/10"
        title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
      >
        {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </Button>

      {/* Video Control */}
      <Button
        variant={isVideoEnabled ? "ghost" : "destructive"}
        size="lg"
        onClick={onToggleVideo}
        disabled={disabled}
        className="rounded-full w-12 h-12 text-white hover:bg-white/10"
        title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
      >
        {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </Button>

      {/* Speaker Control */}
      <Button
        variant="ghost"
        size="lg"
        onClick={onToggleSpeaker}
        disabled={disabled}
        className="rounded-full w-12 h-12 text-white hover:bg-white/10"
        title={isSpeakerEnabled ? "Mute speaker" : "Unmute speaker"}
      >
        {isSpeakerEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </Button>

      {/* Recording Control */}
      <Button
        variant={isRecording ? "destructive" : "ghost"}
        size="lg"
        onClick={onToggleRecording}
        disabled={disabled}
        className="rounded-full w-12 h-12 text-white hover:bg-white/10"
        title={isRecording ? "Stop recording" : "Start recording"}
      >
        {isRecording ? <Square className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
      </Button>

      {/* Settings */}
      {onSettings && (
        <Button
          variant="ghost"
          size="lg"
          onClick={onSettings}
          disabled={disabled}
          className="rounded-full w-12 h-12 text-white hover:bg-white/10"
          title="Call settings"
        >
          <Settings className="w-5 h-5" />
        </Button>
      )}

      {/* End Call */}
      <Button
        variant="destructive"
        size="lg"
        onClick={onEndCall}
        disabled={disabled}
        className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 ml-4"
        title="End call"
      >
        <PhoneOff className="w-6 h-6" />
      </Button>
    </div>
  );
}

export default CallControls;