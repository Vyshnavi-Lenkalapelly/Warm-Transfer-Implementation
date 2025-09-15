"use client"

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { 
  LiveKitRoom, 
  VideoConference, 
  useLocalParticipant,
  useTracks,
  useRoomContext,
  AudioTrack,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  Chat
} from "@livekit/components-react";
import { Track, Room, RemoteParticipant } from "livekit-client";
import "./call.css";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

// Speech recognition hook with manual enablement
function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = "";
        let finalText = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalText) {
          setFinalTranscript(prev => prev + finalText);
          setTranscript(prev => prev + finalText);
        }
        
        // Show interim results in real-time
        setTranscript(prev => prev + interimTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Automatically restart if no speech detected
          setTimeout(() => {
            if (isListening) {
              startListening();
            }
          }, 1000);
        }
      };

      recognitionRef.current.onend = () => {
        // Automatically restart if still supposed to be listening
        if (isListening) {
          setTimeout(() => {
            startListening();
          }, 100);
        }
      };
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        setIsListening(true);
        recognitionRef.current.start();
        console.log('🎤 Speech recognition started manually');
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setIsListening(false);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      setIsListening(false);
      recognitionRef.current.stop();
      console.log('🔇 Speech recognition stopped');
    }
  };

  const clearTranscript = () => {
    setTranscript("");
    setFinalTranscript("");
  };

  return { 
    transcript: finalTranscript || transcript, 
    isListening, 
    startListening, 
    stopListening, 
    clearTranscript,
    finalTranscript 
  };
}

// Dashboard component for call metrics
function CallDashboard() {
  const [callStartTime] = useState(new Date());
  const [callDuration, setCallDuration] = useState(0);
  const [totalCalls] = useState(1); // Current call
  const [isCallActive, setIsCallActive] = useState(true);
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isCallActive) {
      interval = setInterval(() => {
        const now = new Date();
        const duration = Math.floor((now.getTime() - callStartTime.getTime()) / 1000);
        setCallDuration(duration);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [callStartTime, isCallActive]);

  // Monitor room connection state
  useEffect(() => {
    if (room) {
      const handleDisconnected = (reason?: any) => {
        console.log('🔻 Call ended - stopping timer. Reason:', reason);
        setIsCallActive(false);
      };

      const handleConnected = () => {
        console.log('🔗 Call connected - starting timer');
        setIsCallActive(true);
      };

      const handleReconnecting = () => {
        console.log('🔄 Call reconnecting...');
      };

      const handleReconnected = () => {
        console.log('✅ Call reconnected - timer continuing');
        setIsCallActive(true);
      };

      // Listen to all relevant room events
      room.on('disconnected', handleDisconnected);
      room.on('connected', handleConnected);
      room.on('reconnecting', handleReconnecting);
      room.on('reconnected', handleReconnected);

      // Also check current connection state
      if (room.state === 'connected') {
        setIsCallActive(true);
      } else if (room.state === 'disconnected') {
        setIsCallActive(false);
      }

      return () => {
        room.off('disconnected', handleDisconnected);
        room.off('connected', handleConnected);
        room.off('reconnecting', handleReconnecting);
        room.off('reconnected', handleReconnected);
      };
    } else {
      // No room means not connected
      setIsCallActive(false);
    }
  }, [room]);

  // Also monitor the room object itself
  useEffect(() => {
    if (!room) {
      console.log('📵 No room object - call not active');
      setIsCallActive(false);
    }
  }, [room]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const participantCount = room?.numParticipants || 0;

  return (
    <div className="dashboard-section">
      <div className="dashboard-title">📊 Call Dashboard</div>
      <div className="dashboard-metrics">
        <div className="metric-card">
          <div className="metric-value">{totalCalls}</div>
          <div className="metric-label">Active Call</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{formatDuration(callDuration)}</div>
          <div className="metric-label">Duration</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{participantCount + 1}</div>
          <div className="metric-label">Participants</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">HD</div>
          <div className="metric-label">Quality</div>
        </div>
      </div>
      <div className="call-status-indicator">
        <div className={`status-dot ${isCallActive ? 'active' : 'inactive'}`}></div>
        <div className="status-text">
          {isCallActive 
            ? `Call Active - ${localParticipant?.identity || 'Agent1'} connected`
            : 'Call Ended'
          }
        </div>
      </div>
    </div>
  );
}

// Main component for call controls and transfer
function CallControls() {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [transferStatus, setTransferStatus] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [availableAgents] = useState([
    { id: "agent_b", name: "Agent B - Billing Specialist" },
    { id: "agent_c", name: "Agent C - Technical Support" },
    { id: "agent_d", name: "Agent D - Supervisor" }
  ]);
  
  const { transcript, isListening, startListening, stopListening, clearTranscript, finalTranscript } = useSpeechRecognition();

  // Debug: Log room state changes
  useEffect(() => {
    console.log('🎯 Room object in CallControls:', room?.name, 'State:', room?.state);
  }, [room]);

  // Auto-generate summary when transcript reaches certain length (ONLY if listening is active)
  useEffect(() => {
    if (isListening && finalTranscript && finalTranscript.split(' ').length > 5) {
      // Automatically generate AI summary when enough speech is captured AND user has enabled listening
      generateAISummary();
    }
  }, [finalTranscript, isListening]);

  const generateAISummary = async () => {
    if (!finalTranscript.trim()) return;

    try {
      setTransferStatus("🤖 AI analyzing conversation...");
      
      // Use the working endpoint
      const response = await fetch(`${BACKEND}/api/v1/warm-transfer/start-warm-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_room: room.name,
          agent_a_identity: localParticipant?.identity || "Agent A",
          agent_b_identity: "agent_b", 
          caller_identity: "Customer",
          conversation_transcript: finalTranscript
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiSummary(data.summary);
        setTransferStatus("✅ AI summary ready! Transfer buttons enabled.");
        console.log('AI Summary generated:', data.summary);
      } else {
        // Fallback: Enable transfer anyway with basic summary
        setAiSummary("Customer conversation recorded. Ready for specialist transfer.");
        setTransferStatus("✅ Transfer ready!");
      }
    } catch (error) {
      console.error('AI summary failed:', error);
      // Fallback: Enable transfer anyway
      setAiSummary("Conversation captured. Transfer available.");
      setTransferStatus("✅ Transfer ready!");
    }
  };

  // Toggle microphone
  const toggleMute = async () => {
    if (localParticipant) {
      const audioTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
      if (audioTrack) {
        if (isMuted) {
          await audioTrack.unmute();
          setIsMuted(false);
        } else {
          await audioTrack.mute();
          setIsMuted(true);
        }
      }
    }
  };

  // Toggle video
  const toggleVideo = async () => {
    if (localParticipant) {
      const videoTrack = localParticipant.getTrackPublication(Track.Source.Camera);
      if (videoTrack) {
        if (isVideoOff) {
          await localParticipant.setCameraEnabled(true);
          setIsVideoOff(false);
        } else {
          await localParticipant.setCameraEnabled(false);
          setIsVideoOff(true);
        }
      }
    }
  };

  // Start warm transfer with speech recognition
  const startWarmTransfer = async (targetAgentId: string) => {
    try {
      setTransferStatus("Initiating transfer...");
      
      // Use transcript or create basic one
      const conversationData = finalTranscript || transcript || "Customer service conversation in progress.";

      console.log('Starting transfer with data:', {
        current_room: room.name,
        agent_a_identity: localParticipant?.identity || "Agent A",
        agent_b_identity: targetAgentId,
        caller_identity: "Customer",
        conversation_transcript: conversationData
      });

      // Call backend to start warm transfer with transcript
      const response = await fetch(`${BACKEND}/api/v1/warm-transfer/start-warm-transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_room: room.name,
          agent_a_identity: localParticipant?.identity || "Agent A", 
          agent_b_identity: targetAgentId,
          caller_identity: "Customer",
          conversation_transcript: conversationData
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Transfer failed: ${errorData}`);
      }

      const data = await response.json();
      setAiSummary(data.summary);
      setTransferStatus(`✅ Transfer initiated! Agent ${targetAgentId} is joining with AI briefing...`);
      
      console.log("Transfer successful:", data);
      
      // Show success message with details
      alert(`Transfer Success!\n\nAgent ${targetAgentId} is joining with this AI summary:\n\n"${data.summary}"\n\nTransfer room: ${data.transfer_room}`);
      
    } catch (error) {
      console.error('Transfer failed:', error);
      setTransferStatus(`❌ Transfer failed: ${error}`);
      alert(`Transfer failed: ${error}`);
    }
  };

  // Force enable transfers (backup button)
  const forceEnableTransfer = () => {
    const basicSummary = finalTranscript || transcript || "Customer conversation - manual transfer initiated";
    setAiSummary(basicSummary);
    setTransferStatus("✅ Transfer manually enabled!");
  };

  // Disconnect from call
  const disconnectCall = () => {
    if (room) {
      console.log('🔴 Disconnecting from call...');
      // Stop listening first
      if (isListening) {
        stopListening();
      }
      // Disconnect from room
      room.disconnect();
      // Force redirect after disconnect
      setTimeout(() => {
        console.log('🏠 Redirecting to home page...');
        window.location.href = '/';
      }, 1000);
    }
  };

  return (
    <div className="call-controls">
      {/* Workflow Status */}
      <div className="workflow-status">
        <h4 className="workflow-title">📋 Workflow Steps:</h4>
        <div className="workflow-steps">
          <div className="workflow-step">
            <span className="step-icon text-green-400">✅</span>
            <span className="step-text">Step 1: Call Connected (Video & Audio Active)</span>
          </div>
          <div className="workflow-step">
            <span className={`step-icon ${isListening ? "text-green-400" : "text-yellow-400"}`}>
              {isListening ? "✅" : "⏳"}
            </span>
            <span className="step-text">Step 2: Enable AI Listening {isListening ? "(Active)" : "(Click button below)"}</span>
          </div>
          <div className="workflow-step">
            <span className={`step-icon ${transcript ? "text-green-400" : "text-gray-400"}`}>
              {transcript ? "✅" : "⚪"}
            </span>
            <span className="step-text">Step 3: Have Conversation {transcript ? "(In Progress)" : "(Start talking)"}</span>
          </div>
          <div className="workflow-step">
            <span className={`step-icon ${(aiSummary || transcript) ? "text-green-400" : "text-gray-400"}`}>
              {(aiSummary || transcript) ? "✅" : "⚪"}
            </span>
            <span className="step-text">Step 4: Initiate Warm Transfer {(aiSummary || transcript) ? "(Ready)" : "(Complete steps above)"}</span>
          </div>
        </div>
      </div>

      <div className="controls-row">
        <button
          onClick={toggleMute}
          className={`control-button btn-mute ${isMuted ? 'muted' : ''}`}
        >
          {isMuted ? '🔇 Unmute' : '🎤 Mute'}
        </button>
        
        <button
          onClick={toggleVideo}
          className={`control-button btn-video ${isVideoOff ? 'off' : ''}`}
        >
          {isVideoOff ? '📷 Video On' : '📹 Video Off'}
        </button>

        <button
          onClick={clearTranscript}
          className="control-button btn-clear"
        >
          🗑️ Clear Transcript
        </button>

        <button
          onClick={disconnectCall}
          className="control-button btn-disconnect"
        >
          🔴 End Call
        </button>
      </div>

      {/* Step 2: AI Listening Control */}
      {!isListening && (
        <div className="ai-enable-section">
          <div className="ai-enable-title">🎙️ Step 2: Enable AI Listening</div>
          <div className="ai-enable-desc">Click below to start AI-powered conversation analysis</div>
          <button
            onClick={startListening}
            className="btn-enable-ai"
          >
            🚀 Enable AI Listening
          </button>
        </div>
      )}

      {/* Auto-listening Status */}
      {isListening && (
        <div className="ai-listening-section">
          <div className="ai-listening-title">🎤 AI Listening Active - Step 3: Start Talking</div>
          <div className="ai-listening-desc">
            AI is now listening and will automatically process your conversation
          </div>
          <button
            onClick={stopListening}
            className="btn-stop-ai"
          >
            🔇 Stop AI Listening
          </button>
        </div>
      )}

      {/* Live Transcript Display */}
      {transcript && (
        <div className="transcript-section">
          <div className="transcript-title">
            📝 Live Speech-to-Text Transcript 
            {isListening && <span className="recording-indicator"></span>}
          </div>
          <div className="transcript-content">
            {transcript}
            {isListening && <span className="cursor-blink">|</span>}
          </div>
          <div className="transcript-stats">
            📊 Words captured: {transcript.split(' ').length} • Auto-AI analysis: {transcript.split(' ').length > 5 ? '✅ Ready' : '⏳ Keep talking...'}
          </div>
        </div>
      )}

      {/* Transfer Section */}
      <div className="transfer-section">
        <h3 className="transfer-title">🔄 Warm Transfer</h3>
        
        {transferStatus && (
          <div className="transfer-status">
            {transferStatus}
          </div>
        )}

        {/* Force Enable Transfer Button (if needed) */}
        {!aiSummary && transcript && (
          <div>
            <button
              onClick={forceEnableTransfer}
              className="btn-force-enable"
            >
              🚀 Enable Transfer Now (Manual)
            </button>
          </div>
        )}

        <div className="transfer-buttons">
          {availableAgents.map(agent => (
            <button
              key={agent.id}
              onClick={() => startWarmTransfer(agent.id)}
              className={`transfer-button ${
                (aiSummary || transcript) ? 'enabled' : 'disabled'
              }`}
              disabled={!(aiSummary || transcript)}
            >
              {(aiSummary || transcript) ? '🚀' : '⏳'} Transfer to {agent.name}
            </button>
          ))}
        </div>

        {!aiSummary && !transcript && !isListening && (
          <div className="transfer-info info-blue">
            📋 Follow the workflow steps above to enable transfer
          </div>
        )}

        {!aiSummary && !transcript && isListening && (
          <div className="transfer-info info-yellow">
            🎤 AI is listening - start talking to proceed to Step 3
          </div>
        )}

        {transcript && !aiSummary && (
          <div className="transfer-info info-green">
            ✅ Conversation detected! Keep talking for auto-AI analysis, or click "Enable Transfer Now"
          </div>
        )}

        {aiSummary && (
          <div className="transfer-info info-green">
            🚀 All steps complete! Ready for warm transfer
          </div>
        )}

        {/* AI Summary Display */}
        {aiSummary && (
          <div className="ai-summary-section">
            <div className="ai-summary-title">🤖 AI Call Summary:</div>
            <div className="ai-summary-content">
              {aiSummary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CallPage() {
  const searchParams = useSearchParams();
  const identity = searchParams.get("identity") || "Agent1";
  const roomName = searchParams.get("room") || "main-call-room";
  
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getToken = async () => {
      try {
        const response = await fetch(`${BACKEND}/api/v1/warm-transfer/join-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity, room: roomName })
        });
        
        if (!response.ok) {
          throw new Error('Failed to get token');
        }
        
        const data = await response.json();
        setToken(data.token);
      } catch (error) {
        console.error('Token fetch failed:', error);
      } finally {
        setLoading(false);
      }
    };

    getToken();
  }, [identity, roomName]);

  if (loading) {
    return (
      <div className="call-page">
        <div className="call-container">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '70vh',
            flexDirection: 'column',
            color: 'white'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              border: '3px solid rgba(255, 255, 255, 0.3)',
              borderTop: '3px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '20px'
            }}></div>
            <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>Connecting to call...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="call-page">
        <div className="call-container">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            minHeight: '70vh',
            flexDirection: 'column',
            color: 'white',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', color: '#e53e3e', marginBottom: '16px' }}>❌ Connection Failed</div>
            <div style={{ fontSize: '1.1rem' }}>Unable to get access token. Please check backend connection.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="call-page">
      <div className="call-container">
        <h1 className="call-header">
          🎯 Warm Transfer Call - {identity} in {roomName}
        </h1>
        
        <LiveKitRoom
          video={true}
          audio={true}
          token={token}
          serverUrl="wss://project-warm-transfer-implementation-jmsg4oli.livekit.cloud"
          data-lk-theme="default"
          style={{ height: '70vh' }}
          onConnected={() => {
            console.log('✅ Connected to room:', roomName);
          }}
          onDisconnected={(reason) => {
            console.log('🔻 Disconnected from room. Reason:', reason);
            // Could add navigation back to home or show disconnect message
            setTimeout(() => {
              console.log('📱 Call ended - you can close this window or rejoin');
            }, 1000);
          }}
          onError={(error) => {
            console.error('❌ Room connection error:', error);
          }}
        >
          <div className="call-grid">
            {/* Video Conference Area */}
            <div className="video-section">
              <VideoConference />
              <RoomAudioRenderer />
            </div>
            
            {/* Controls and Chat Area */}
            <div className="controls-section">
              <CallDashboard />
              <CallControls />
              <div className="chat-section">
                <h3 className="chat-title">💬 Chat</h3>
                <Chat />
              </div>
            </div>
          </div>
        </LiveKitRoom>
      </div>
    </div>
  );
}