"use client"

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { 
  X, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Lightbulb,
  FileText,
  Clock,
  Zap
} from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'suggestion';
  content: string;
  timestamp: Date;
  metadata?: {
    confidence?: number;
    category?: string;
  };
}

interface AIAssistantProps {
  callId?: string;
  onClose: () => void;
}

export function AIAssistant({ callId, onClose }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'suggestions' | 'summary'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize with welcome message and suggestions
  useEffect(() => {
    const welcomeMessage: Message = {
      id: '1',
      type: 'assistant',
      content: 'Hello! I\'m your AI assistant. I can help you with call context, suggest responses, or provide customer insights. How can I assist you today?',
      timestamp: new Date()
    };

    const suggestions: Message[] = [
      {
        id: '2',
        type: 'suggestion',
        content: 'Customer seems frustrated - suggest empathy approach',
        timestamp: new Date(),
        metadata: { confidence: 0.85, category: 'emotion' }
      },
      {
        id: '3',
        type: 'suggestion',
        content: 'Previous interaction shows billing inquiry pattern',
        timestamp: new Date(),
        metadata: { confidence: 0.92, category: 'history' }
      },
      {
        id: '4',
        type: 'suggestion',
        content: 'Consider offering product upgrade based on usage',
        timestamp: new Date(),
        metadata: { confidence: 0.78, category: 'sales' }
      }
    ];

    setMessages([welcomeMessage, ...suggestions]);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      // Call the backend AI service
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend,
          callId: callId,
          context: 'call_assistance'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response || generateAIResponse(messageToSend),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('AI chat error:', error);
      
      // Fallback to mock response
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: generateAIResponse(messageToSend),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateAIResponse = (input: string): string => {
    const responses = [
      "Based on the call context, I recommend acknowledging the customer's concern first, then explaining the available options clearly.",
      "I've analyzed similar cases and found that offering a step-by-step solution works best in this situation.",
      "The customer's tone suggests they need reassurance. Consider using phrases like 'I understand your concern' and 'Let me help you resolve this.'",
      "I notice this customer has had 3 previous interactions about billing. You might want to offer to escalate to a billing specialist.",
      "Based on the conversation flow, this seems like a good opportunity to suggest our premium support package."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessage = (message: Message) => {
    const isUser = message.type === 'user';
    const isSuggestion = message.type === 'suggestion';

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} space-x-2`}>
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? 'bg-blue-500 ml-2' : isSuggestion ? 'bg-yellow-500' : 'bg-gray-500'
          }`}>
            {isUser ? (
              <User className="w-4 h-4 text-white" />
            ) : isSuggestion ? (
              <Lightbulb className="w-4 h-4 text-white" />
            ) : (
              <Bot className="w-4 h-4 text-white" />
            )}
          </div>
          
          <div className={`px-4 py-2 rounded-lg ${
            isUser 
              ? 'bg-blue-500 text-white' 
              : isSuggestion 
                ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
          }`}>
            <div className="text-sm">{message.content}</div>
            {message.metadata && (
              <div className="text-xs mt-1 opacity-75">
                {message.metadata.category && (
                  <span className="capitalize">{message.metadata.category}</span>
                )}
                {message.metadata.confidence && (
                  <span className="ml-2">
                    Confidence: {Math.round(message.metadata.confidence * 100)}%
                  </span>
                )}
              </div>
            )}
            <div className="text-xs mt-1 opacity-60">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-96 h-[600px] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">AI Assistant</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'chat', label: 'Chat', icon: Bot },
          { id: 'suggestions', label: 'Suggestions', icon: Lightbulb },
          { id: 'summary', label: 'Summary', icon: FileText }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 h-[400px]">
              {messages.filter(m => m.type !== 'suggestion').map(renderMessage)}
              {isLoading && (
                <div className="flex justify-start mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-gray-100 px-4 py-2 rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about this call..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  size="sm"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'suggestions' && (
          <div className="p-4 h-[480px] overflow-y-auto space-y-3">
            {messages.filter(m => m.type === 'suggestion').map(message => (
              <div key={message.id} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Lightbulb className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-yellow-800">{message.content}</p>
                    {message.metadata && (
                      <div className="flex items-center space-x-4 mt-2 text-xs text-yellow-600">
                        <span className="capitalize">{message.metadata.category}</span>
                        <span>
                          {Math.round((message.metadata.confidence || 0) * 100)}% confidence
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="p-4 h-[480px] overflow-y-auto">
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Call Overview
                </h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>Duration: 5 minutes 23 seconds</p>
                  <p>Status: Active</p>
                  <p>Participants: 2</p>
                </div>
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2 flex items-center">
                  <Zap className="w-4 h-4 mr-2" />
                  Key Points
                </h4>
                <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                  <li>Customer inquiry about billing discrepancy</li>
                  <li>Previous account history reviewed</li>
                  <li>Resolution steps discussed</li>
                </ul>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-medium text-purple-900 mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Next Actions
                </h4>
                <ul className="text-sm text-purple-800 space-y-1 list-disc list-inside">
                  <li>Follow up with billing department</li>
                  <li>Send confirmation email</li>
                  <li>Schedule callback if needed</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIAssistant;