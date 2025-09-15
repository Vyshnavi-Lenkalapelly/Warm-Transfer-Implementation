"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { X, Wifi, WifiOff, Volume2, Signal } from 'lucide-react';
import { Room } from 'livekit-client';

interface CallMetricsProps {
  room: Room | null;
  callId?: string;
  onClose: () => void;
}

interface ConnectionQuality {
  quality: 'excellent' | 'good' | 'poor' | 'disconnected';
  latency: number;
  packetLoss: number;
  bandwidth: {
    up: number;
    down: number;
  };
}

export function CallMetrics({ room, callId, onClose }: CallMetricsProps) {
  const [metrics, setMetrics] = useState<ConnectionQuality>({
    quality: 'good',
    latency: 0,
    packetLoss: 0,
    bandwidth: { up: 0, down: 0 }
  });

  useEffect(() => {
    if (!room) return;

    const updateMetrics = () => {
      // Mock metrics - in real app, get from LiveKit room stats
      const mockMetrics: ConnectionQuality = {
        quality: ['excellent', 'good', 'poor'][Math.floor(Math.random() * 3)] as any,
        latency: Math.floor(Math.random() * 100) + 20,
        packetLoss: Math.random() * 5,
        bandwidth: {
          up: Math.floor(Math.random() * 1000) + 500,
          down: Math.floor(Math.random() * 2000) + 1000
        }
      };
      setMetrics(mockMetrics);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 2000);

    return () => clearInterval(interval);
  }, [room]);

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'poor': return 'text-yellow-600';
      case 'disconnected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'excellent': return <Signal className="w-5 h-5 text-green-600" />;
      case 'good': return <Wifi className="w-5 h-5 text-blue-600" />;
      case 'poor': return <Wifi className="w-5 h-5 text-yellow-600" />;
      case 'disconnected': return <WifiOff className="w-5 h-5 text-red-600" />;
      default: return <Wifi className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="fixed top-16 right-4 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Call Metrics</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Connection Quality */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getQualityIcon(metrics.quality)}
            <span className="text-sm font-medium text-gray-700">Connection Quality</span>
          </div>
          <span className={`text-sm font-medium capitalize ${getQualityColor(metrics.quality)}`}>
            {metrics.quality}
          </span>
        </div>

        {/* Latency */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Latency</span>
          <span className="text-sm font-medium text-gray-900">{metrics.latency}ms</span>
        </div>

        {/* Packet Loss */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Packet Loss</span>
          <span className="text-sm font-medium text-gray-900">
            {metrics.packetLoss.toFixed(1)}%
          </span>
        </div>

        {/* Bandwidth */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Upload</span>
            <span className="text-sm font-medium text-gray-900">
              {(metrics.bandwidth.up / 1000).toFixed(1)} Mbps
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Download</span>
            <span className="text-sm font-medium text-gray-900">
              {(metrics.bandwidth.down / 1000).toFixed(1)} Mbps
            </span>
          </div>
        </div>

        {/* Participants */}
        {room && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Participants</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Total Participants</span>
                <span className="text-gray-900 font-medium">{room.numParticipants}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Connection State</span>
                <span className="text-gray-900 font-medium capitalize">{room.state}</span>
              </div>
            </div>
          </div>
        )}

        {/* Call Information */}
        {callId && (
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Call Information</h4>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Call ID: {callId}</div>
              <div>Room: {room?.name || 'Unknown'}</div>
              <div>State: {room?.state || 'Unknown'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CallMetrics;