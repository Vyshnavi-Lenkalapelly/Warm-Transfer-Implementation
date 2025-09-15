"use client"

import { useState, useCallback, useRef } from 'react';

interface CallState {
  isActive: boolean;
  isConnected: boolean;
  roomName: string | null;
  token: string | null;
  participants: string[];
  duration: number;
  quality: 'excellent' | 'good' | 'poor' | 'disconnected';
}

interface UseCallOptions {
  onCallStart?: (callData: any) => void;
  onCallEnd?: () => void;
  onParticipantJoined?: (participant: string) => void;
  onParticipantLeft?: (participant: string) => void;
}

export function useCall(options: UseCallOptions = {}) {
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    isConnected: false,
    roomName: null,
    token: null,
    participants: [],
    duration: 0,
    quality: 'disconnected'
  });

  const startTimeRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startCall = useCallback(async (roomName: string, token?: string) => {
    try {
      // In real app, get token from backend if not provided
      const callToken = token || `mock-token-${Date.now()}`;
      
      setCallState(prev => ({
        ...prev,
        isActive: true,
        roomName,
        token: callToken,
        quality: 'good'
      }));

      startTimeRef.current = Date.now();
      
      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setCallState(prev => ({
            ...prev,
            duration: elapsed
          }));
        }
      }, 1000);

      options.onCallStart?.({ roomName, token: callToken });
    } catch (error) {
      console.error('Failed to start call:', error);
    }
  }, [options]);

  const endCall = useCallback(() => {
    setCallState({
      isActive: false,
      isConnected: false,
      roomName: null,
      token: null,
      participants: [],
      duration: 0,
      quality: 'disconnected'
    });

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    startTimeRef.current = null;
    options.onCallEnd?.();
  }, [options]);

  const joinCall = useCallback(async (roomName: string, token: string) => {
    try {
      setCallState(prev => ({
        ...prev,
        isConnected: true,
        roomName,
        token,
        quality: 'good'
      }));
    } catch (error) {
      console.error('Failed to join call:', error);
    }
  }, []);

  const addParticipant = useCallback((participantId: string) => {
    setCallState(prev => ({
      ...prev,
      participants: [...prev.participants, participantId]
    }));
    options.onParticipantJoined?.(participantId);
  }, [options]);

  const removeParticipant = useCallback((participantId: string) => {
    setCallState(prev => ({
      ...prev,
      participants: prev.participants.filter(p => p !== participantId)
    }));
    options.onParticipantLeft?.(participantId);
  }, [options]);

  const updateQuality = useCallback((quality: CallState['quality']) => {
    setCallState(prev => ({
      ...prev,
      quality
    }));
  }, []);

  return {
    callState,
    startCall,
    endCall,
    joinCall,
    addParticipant,
    removeParticipant,
    updateQuality
  };
}