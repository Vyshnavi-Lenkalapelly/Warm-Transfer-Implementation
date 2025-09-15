"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { 
  X, 
  Search, 
  User, 
  Clock, 
  CheckCircle, 
  ArrowRight,
  Phone,
  MessageSquare,
  Star
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'away';
  skills: string[];
  rating: number;
  currentCalls: number;
  maxCalls: number;
  department: string;
  avatar?: string;
}

interface TransferPanelProps {
  onTransfer: (transferData: any) => void;
  onClose: () => void;
  callId?: string;
  currentAgentId?: string;
}

export function TransferPanel({ 
  onTransfer, 
  onClose, 
  callId, 
  currentAgentId 
}: TransferPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [transferType, setTransferType] = useState<'warm' | 'cold'>('warm');
  const [transferNote, setTransferNote] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock agents data - in real app, fetch from API
  useEffect(() => {
    const mockAgents: Agent[] = [
      {
        id: '1',
        name: 'Sarah Johnson',
        status: 'available',
        skills: ['Customer Support', 'Technical Support'],
        rating: 4.8,
        currentCalls: 0,
        maxCalls: 3,
        department: 'Support',
        avatar: '/avatars/sarah.jpg'
      },
      {
        id: '2',
        name: 'Mike Chen',
        status: 'available',
        skills: ['Sales', 'Product Demo'],
        rating: 4.9,
        currentCalls: 1,
        maxCalls: 4,
        department: 'Sales',
        avatar: '/avatars/mike.jpg'
      },
      {
        id: '3',
        name: 'Emily Rodriguez',
        status: 'busy',
        skills: ['Technical Support', 'Billing'],
        rating: 4.7,
        currentCalls: 2,
        maxCalls: 3,
        department: 'Support',
        avatar: '/avatars/emily.jpg'
      },
      {
        id: '4',
        name: 'David Thompson',
        status: 'available',
        skills: ['Manager', 'Escalations'],
        rating: 4.9,
        currentCalls: 0,
        maxCalls: 2,
        department: 'Management',
        avatar: '/avatars/david.jpg'
      }
    ];

    // Filter out current agent
    const filteredAgents = mockAgents.filter(agent => agent.id !== currentAgentId);
    setAgents(filteredAgents);
    setIsLoading(false);
  }, [currentAgentId]);

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleTransfer = async () => {
    if (!selectedAgent) return;

    const transferData = {
      callId,
      fromAgentId: currentAgentId,
      toAgentId: selectedAgent.id,
      transferType,
      note: transferNote,
      timestamp: new Date().toISOString()
    };

    try {
      await onTransfer(transferData);
    } catch (error) {
      console.error('Transfer failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-red-100 text-red-800';
      case 'away': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="transfer-panel fixed right-0 top-0 bottom-0 w-96 bg-white shadow-xl border-l border-gray-200 z-50">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Transfer Call</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Transfer Type Selection */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex space-x-2">
            <Button
              variant={transferType === 'warm' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTransferType('warm')}
              className="flex-1"
            >
              <Phone className="w-4 h-4 mr-2" />
              Warm Transfer
            </Button>
            <Button
              variant={transferType === 'cold' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTransferType('cold')}
              className="flex-1"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Cold Transfer
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {transferType === 'warm' 
              ? 'Stay on call until agent accepts' 
              : 'Transfer immediately without introduction'
            }
          </p>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search agents by name, department, or skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Agent List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="loading-skeleton h-20 rounded-lg"></div>
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No agents found</p>
            </div>
          ) : (
            filteredAgents.map(agent => (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                  selectedAgent?.id === agent.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 truncate">{agent.name}</h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                        {agent.status}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mt-1">{agent.department}</p>
                    
                    <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                      <div className="flex items-center">
                        <Star className="w-3 h-3 mr-1 text-yellow-400" />
                        {agent.rating}
                      </div>
                      <div className="flex items-center">
                        <Phone className="w-3 h-3 mr-1" />
                        {agent.currentCalls}/{agent.maxCalls}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.skills.slice(0, 2).map(skill => (
                        <span key={skill} className="inline-block px-2 py-1 bg-gray-100 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                      {agent.skills.length > 2 && (
                        <span className="inline-block px-2 py-1 bg-gray-100 text-xs rounded">
                          +{agent.skills.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Transfer Note */}
        {selectedAgent && (
          <div className="border-t border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transfer Note (Optional)
            </label>
            <textarea
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="Add context about the customer or issue..."
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleTransfer} 
              disabled={!selectedAgent}
              className="flex-1"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Transfer Call
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TransferPanel;