"use client"

import { useState, useCallback, useEffect } from 'react';

interface Agent {
  id: string;
  name: string;
  email: string;
  status: 'available' | 'busy' | 'away' | 'offline';
  currentCalls: number;
  maxCalls: number;
  skills: string[];
  department: string;
  todayStats: {
    callsHandled: number;
    averageCallTime: number;
    customerSatisfaction: number;
    transfersReceived: number;
  };
}

interface UseAgentOptions {
  agentId?: string;
  onStatusChange?: (status: Agent['status']) => void;
}

export function useAgent(options: UseAgentOptions = {}) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock agent data - in real app, fetch from API
  useEffect(() => {
    const fetchAgent = async () => {
      try {
        setIsLoading(true);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const mockAgent: Agent = {
          id: options.agentId || 'agent-001',
          name: 'Sarah Johnson',
          email: 'sarah.johnson@company.com',
          status: 'available',
          currentCalls: 0,
          maxCalls: 3,
          skills: ['Customer Support', 'Technical Support', 'Billing'],
          department: 'Support',
          todayStats: {
            callsHandled: 12,
            averageCallTime: 8.5,
            customerSatisfaction: 4.8,
            transfersReceived: 3
          }
        };

        setAgent(mockAgent);
        setError(null);
      } catch (err) {
        setError('Failed to load agent data');
        console.error('Error fetching agent:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgent();
  }, [options.agentId]);

  const updateStatus = useCallback(async (newStatus: Agent['status']) => {
    if (!agent) return;

    try {
      // In real app, send to backend
      setAgent(prev => prev ? { ...prev, status: newStatus } : null);
      options.onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Failed to update agent status:', error);
    }
  }, [agent, options]);

  const incrementCallCount = useCallback(() => {
    setAgent(prev => prev ? {
      ...prev,
      currentCalls: prev.currentCalls + 1,
      status: prev.currentCalls + 1 >= prev.maxCalls ? 'busy' : prev.status
    } : null);
  }, []);

  const decrementCallCount = useCallback(() => {
    setAgent(prev => prev ? {
      ...prev,
      currentCalls: Math.max(0, prev.currentCalls - 1),
      status: prev.currentCalls - 1 < prev.maxCalls ? 'available' : prev.status
    } : null);
  }, []);

  const updateTodayStats = useCallback((stats: Partial<Agent['todayStats']>) => {
    setAgent(prev => prev ? {
      ...prev,
      todayStats: { ...prev.todayStats, ...stats }
    } : null);
  }, []);

  const isAvailable = agent?.status === 'available' && agent.currentCalls < agent.maxCalls;
  const isBusy = agent?.status === 'busy' || (agent && agent.currentCalls >= agent.maxCalls);

  return {
    agent,
    isLoading,
    error,
    isAvailable,
    isBusy,
    updateStatus,
    incrementCallCount,
    decrementCallCount,
    updateTodayStats
  };
}