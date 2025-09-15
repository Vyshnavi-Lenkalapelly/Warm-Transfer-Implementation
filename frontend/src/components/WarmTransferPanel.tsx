"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { 
  UserPlus, 
  Phone, 
  Users, 
  CheckCircle, 
  Clock,
  ArrowRight,
  MessageSquare,
  X
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'offline';
  department: string;
  skills: string[];
}

interface WarmTransferPanelProps {
  callId: string;
  currentAgentId: string;
  onClose: () => void;
  onTransferComplete?: (transferData: any) => void;
}

interface TransferState {
  stage: 'selecting' | 'initiated' | 'briefing' | 'transferring' | 'completed';
  transferId?: string;
  targetAgent?: Agent;
  transferRoomToken?: string;
  originalRoomToken?: string;
  summary?: string;
}

export function WarmTransferPanel({ 
  callId, 
  currentAgentId, 
  onClose, 
  onTransferComplete 
}: WarmTransferPanelProps) {
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [transferState, setTransferState] = useState<TransferState>({
    stage: 'selecting'
  });
  const [transferReason, setTransferReason] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchAvailableAgents();
  }, []);

  const fetchAvailableAgents = async () => {
    try {
      const response = await fetch('/api/agents/available');
      if (response.ok) {
        const agents = await response.json();
        setAvailableAgents(agents.filter((agent: Agent) => agent.id !== currentAgentId));
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      // Mock data for development
      setAvailableAgents([
        { id: 'agent-002', name: 'Mike Johnson', status: 'available', department: 'Technical Support', skills: ['Technical', 'Billing'] },
        { id: 'agent-003', name: 'Lisa Chen', status: 'available', department: 'Customer Success', skills: ['Sales', 'Account Management'] },
        { id: 'agent-004', name: 'David Smith', status: 'available', department: 'Billing', skills: ['Billing', 'Finance'] }
      ]);
    }
  };

  const initiateTransfer = async (targetAgentId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/warm-transfer/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: callId,
          source_agent_id: currentAgentId,
          target_agent_id: targetAgentId,
          reason: transferReason,
          transfer_notes: transferNotes
        })
      });

      if (!response.ok) {
        throw new Error('Failed to initiate transfer');
      }

      const data = await response.json();
      const targetAgent = availableAgents.find(agent => agent.id === targetAgentId);

      setTransferState({
        stage: 'initiated',
        transferId: data.transfer_id,
        targetAgent,
        transferRoomToken: data.data.source_agent_token,
        summary: data.data.call_summary?.summary
      });

      // In a real app, notify the target agent
      console.log('Transfer initiated:', data);

    } catch (error) {
      console.error('Transfer initiation failed:', error);
      alert('Failed to initiate transfer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const joinBriefingRoom = () => {
    if (transferState.transferRoomToken) {
      // Open briefing room in new window/modal
      window.open(
        `/briefing-room?token=${transferState.transferRoomToken}&room=${transferState.transferId}`,
        'briefing',
        'width=800,height=600'
      );
      
      setTransferState(prev => ({ ...prev, stage: 'briefing' }));
    }
  };

  const completeBriefing = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/warm-transfer/complete-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transfer_id: transferState.transferId,
          stage: 'briefing_complete'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to complete briefing');
      }

      const data = await response.json();
      
      setTransferState(prev => ({
        ...prev,
        stage: 'transferring',
        originalRoomToken: data.data.target_agent_token
      }));

      // Notify that Agent B can now join original room
      console.log('Briefing completed:', data);

    } catch (error) {
      console.error('Failed to complete briefing:', error);
      alert('Failed to complete briefing. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeTransfer = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/warm-transfer/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transfer_id: transferState.transferId,
          stage: 'completed'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to finalize transfer');
      }

      const data = await response.json();
      
      setTransferState(prev => ({ ...prev, stage: 'completed' }));
      
      // Call completion callback
      onTransferComplete?.(data);
      
      // Close panel after brief delay
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Failed to finalize transfer:', error);
      alert('Failed to finalize transfer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStage = () => {
    switch (transferState.stage) {
      case 'selecting':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer Reason
              </label>
              <select 
                value={transferReason} 
                onChange={(e) => setTransferReason(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">Select reason...</option>
                <option value="technical">Technical Issue</option>
                <option value="billing">Billing Inquiry</option>
                <option value="escalation">Escalation Required</option>
                <option value="specialist">Needs Specialist</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes for receiving agent
              </label>
              <textarea
                value={transferNotes}
                onChange={(e) => setTransferNotes(e.target.value)}
                placeholder="Brief context about the customer's issue..."
                className="w-full p-2 border border-gray-300 rounded-md h-20"
              />
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Available Agents</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {availableAgents.map(agent => (
                  <div 
                    key={agent.id}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => initiateTransfer(agent.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{agent.name}</div>
                        <div className="text-sm text-gray-500">{agent.department}</div>
                        <div className="text-xs text-gray-400">
                          Skills: {agent.skills.join(', ')}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-green-600">Available</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'initiated':
        return (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mx-auto">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Transfer Initiated</h3>
              <p className="text-gray-600 mt-1">
                Ready to brief {transferState.targetAgent?.name}
              </p>
            </div>
            
            {transferState.summary && (
              <div className="bg-gray-50 p-4 rounded-lg text-left">
                <h4 className="font-medium text-gray-900 mb-2">AI-Generated Call Summary</h4>
                <p className="text-sm text-gray-600">{transferState.summary}</p>
              </div>
            )}

            <Button 
              onClick={joinBriefingRoom}
              className="w-full"
              disabled={isLoading}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Join Briefing Room
            </Button>
          </div>
        );

      case 'briefing':
        return (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mx-auto">
              <MessageSquare className="w-8 h-8 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Briefing in Progress</h3>
              <p className="text-gray-600 mt-1">
                Brief {transferState.targetAgent?.name} about the customer's situation
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg text-left">
              <h4 className="font-medium text-blue-900 mb-2">Briefing Checklist</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Customer's main issue/concern</li>
                <li>• Steps already taken</li>
                <li>• Customer's emotional state</li>
                <li>• Any important account details</li>
                <li>• Recommended next actions</li>
              </ul>
            </div>

            <Button 
              onClick={completeBriefing}
              className="w-full"
              disabled={isLoading}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Briefing
            </Button>
          </div>
        );

      case 'transferring':
        return (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto">
              <ArrowRight className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Ready to Transfer</h3>
              <p className="text-gray-600 mt-1">
                {transferState.targetAgent?.name} can now join the customer call
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800">
                Once {transferState.targetAgent?.name} has joined the customer call and is ready, 
                you can exit the call to complete the transfer.
              </p>
            </div>

            <Button 
              onClick={finalizeTransfer}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={isLoading}
            >
              <Phone className="w-4 h-4 mr-2" />
              Exit Call & Complete Transfer
            </Button>
          </div>
        );

      case 'completed':
        return (
          <div className="space-y-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Transfer Completed</h3>
              <p className="text-gray-600 mt-1">
                Customer is now with {transferState.targetAgent?.name}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-96 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col max-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <UserPlus className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Warm Transfer</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Progress Indicator */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          {['selecting', 'initiated', 'briefing', 'transferring', 'completed'].map((stage, index) => (
            <React.Fragment key={stage}>
              <div className={`w-3 h-3 rounded-full ${
                transferState.stage === stage ? 'bg-blue-600' : 
                index < ['selecting', 'initiated', 'briefing', 'transferring', 'completed'].indexOf(transferState.stage) 
                  ? 'bg-green-500' : 'bg-gray-300'
              }`} />
              {index < 4 && <div className="flex-1 h-0.5 bg-gray-200" />}
            </React.Fragment>
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-1 capitalize">
          {transferState.stage.replace('_', ' ')}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 overflow-y-auto">
        {renderStage()}
      </div>
    </div>
  );
}

export default WarmTransferPanel;