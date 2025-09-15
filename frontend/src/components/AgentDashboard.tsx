"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { 
  User, 
  Phone, 
  PhoneOff, 
  Clock, 
  Star, 
  Users, 
  Activity,
  Settings,
  LogOut,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  email: string;
  status: 'available' | 'busy' | 'away' | 'offline';
  currentCalls: number;
  maxCalls: number;
  todayStats: {
    callsHandled: number;
    averageCallTime: number;
    customerSatisfaction: number;
    transfersReceived: number;
  };
  skills: string[];
  department: string;
  lastActivity: Date;
}

interface Call {
  id: string;
  customerName: string;
  customerPhone: string;
  startTime: Date;
  duration: number;
  status: 'active' | 'hold' | 'transferring';
  type: 'inbound' | 'outbound';
  priority: 'low' | 'medium' | 'high';
}

interface AgentDashboardProps {
  agentId: string;
  onStartCall?: () => void;
  onJoinRoom?: (roomName: string) => void;
}

export function AgentDashboard({ agentId, onStartCall, onJoinRoom }: AgentDashboardProps) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [activeCalls, setActiveCalls] = useState<Call[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<Agent['status']>('available');

  useEffect(() => {
    // Mock agent data
    const mockAgent: Agent = {
      id: agentId,
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
      status: 'available',
      currentCalls: 0,
      maxCalls: 3,
      todayStats: {
        callsHandled: 12,
        averageCallTime: 8.5,
        customerSatisfaction: 4.8,
        transfersReceived: 3
      },
      skills: ['Customer Support', 'Technical Support', 'Billing'],
      department: 'Support',
      lastActivity: new Date()
    };

    const mockCalls: Call[] = [
      {
        id: '1',
        customerName: 'John Smith',
        customerPhone: '+1-555-0123',
        startTime: new Date(Date.now() - 5 * 60 * 1000),
        duration: 5,
        status: 'active',
        type: 'inbound',
        priority: 'medium'
      }
    ];

    setAgent(mockAgent);
    setActiveCalls(mockCalls);
  }, [agentId]);

  const handleStatusChange = (status: Agent['status']) => {
    setSelectedStatus(status);
    if (agent) {
      setAgent({ ...agent, status });
    }
  };

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'available': return 'text-green-600 bg-green-100';
      case 'busy': return 'text-red-600 bg-red-100';
      case 'away': return 'text-yellow-600 bg-yellow-100';
      case 'offline': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'available': return <CheckCircle className="w-4 h-4" />;
      case 'busy': return <XCircle className="w-4 h-4" />;
      case 'away': return <AlertCircle className="w-4 h-4" />;
      case 'offline': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-gray-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
              <p className="text-gray-600">{agent.email}</p>
              <div className="flex items-center space-x-2 mt-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(agent.status)}`}>
                  {getStatusIcon(agent.status)}
                  <span className="ml-1 capitalize">{agent.status}</span>
                </span>
                <span className="text-sm text-gray-500">
                  {agent.currentCalls}/{agent.maxCalls} active calls
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Status Selector */}
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusChange(e.target.value as Agent['status'])}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="away">Away</option>
              <option value="offline">Offline</option>
            </select>

            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>

            <Button variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Phone className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Calls Today</p>
              <p className="text-2xl font-bold text-gray-900">{agent.todayStats.callsHandled}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Avg Call Time</p>
              <p className="text-2xl font-bold text-gray-900">{agent.todayStats.averageCallTime}m</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Star className="w-8 h-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Satisfaction</p>
              <p className="text-2xl font-bold text-gray-900">{agent.todayStats.customerSatisfaction}/5</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Transfers</p>
              <p className="text-2xl font-bold text-gray-900">{agent.todayStats.transfersReceived}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Calls and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Calls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Active Calls</h2>
              <span className="text-sm text-gray-500">{activeCalls.length} active</span>
            </div>
          </div>

          <div className="p-6">
            {activeCalls.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No active calls</p>
                <Button 
                  className="mt-4" 
                  onClick={onStartCall}
                >
                  Start New Call
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeCalls.map(call => (
                  <div key={call.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          call.status === 'active' ? 'bg-green-500' : 
                          call.status === 'hold' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}></div>
                        <div>
                          <h3 className="font-medium text-gray-900">{call.customerName}</h3>
                          <p className="text-sm text-gray-600">{call.customerPhone}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(call.priority)}`}>
                          {call.priority}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDuration(call.duration)}
                        </span>
                        <Button variant="outline" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>

          <div className="p-6 space-y-4">
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={onStartCall}
            >
              <Phone className="w-4 h-4 mr-3" />
              Start New Call
            </Button>

            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => onJoinRoom?.('lobby')}
            >
              <Users className="w-4 h-4 mr-3" />
              Join Team Room
            </Button>

            <Button 
              className="w-full justify-start" 
              variant="outline"
            >
              <Activity className="w-4 h-4 mr-3" />
              View Analytics
            </Button>

            <Button 
              className="w-full justify-start" 
              variant="outline"
            >
              <Clock className="w-4 h-4 mr-3" />
              Call History
            </Button>
          </div>

          {/* Skills */}
          <div className="p-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {agent.skills.map(skill => (
                <span key={skill} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentDashboard;