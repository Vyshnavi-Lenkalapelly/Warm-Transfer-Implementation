"use client"

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Room } from "livekit-client";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function RoomPage() {
  const searchParams = useSearchParams();
  const identity = searchParams.get('identity') || '';
  const room = searchParams.get('room') || '';
  
  const [status, setStatus] = useState("idle");
  const roomRef = useRef<Room | null>(null);
  const [participants, setParticipants] = useState<Array<{identity: string, sid: string}>>([]);
  const [transferInfo, setTransferInfo] = useState<any>(null);
  const [agentB, setAgentB] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (!identity || !room) return;
    join();
  }, [identity, room]);

  async function join() {
    setStatus("🔄 Requesting token...");
    try {
      const res = await fetch(`${BACKEND}/api/v1/warm-transfer/join-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity, room }),
      });
      
      if (!res.ok) {
        throw new Error(`Token request failed: ${res.status}`);
      }
      
      const data = await res.json();
      const token = data.token;
      const livekitUrl = data.livekit_url || "wss://project-warm-transfer-implementation-jmsg4oli.livekit.cloud";

      setStatus("🔗 Connecting to LiveKit...");
      const lkRoom = new Room();
      roomRef.current = lkRoom;
      
      await lkRoom.connect(livekitUrl, token, {
        autoSubscribe: true,
      });

      // Enable microphone by default
      try {
        await lkRoom.localParticipant.setMicrophoneEnabled(true);
        await lkRoom.localParticipant.setCameraEnabled(true);
      } catch (e) {
        console.warn("Failed to enable mic/camera:", e);
      }

      // Set up event listeners
      lkRoom.on("participantConnected", () => updateParticipants(lkRoom));
      lkRoom.on("participantDisconnected", () => updateParticipants(lkRoom));
      lkRoom.on("trackPublished", () => updateParticipants(lkRoom));
      lkRoom.on("trackUnpublished", () => updateParticipants(lkRoom));

      updateParticipants(lkRoom);
      setStatus("✅ Connected successfully!");
    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Failed: ${e.message}`);
    }
  }

  function updateParticipants(lkRoom: Room) {
    const list: Array<{identity: string, sid: string}> = [];
    for (const [sid, p] of lkRoom.participants) {
      list.push({ identity: p.identity, sid });
    }
    // Include local participant
    list.push({ identity: lkRoom.localParticipant.identity, sid: "local" });
    setParticipants(list);
  }

  async function startWarmTransfer() {
    if (!roomRef.current) {
      alert("❌ Not connected to room");
      return;
    }
    if (!agentB.trim()) {
      alert("❌ Please enter Agent B identity");
      return;
    }

    setIsTransferring(true);
    setStatus("🔄 Starting warm transfer...");

    const payload = {
      current_room: room,
      agent_a_identity: identity,
      agent_b_identity: agentB.trim(),
      caller_identity: participants.find(p => p.identity.includes('caller'))?.identity || identity
    };

    try {
      const res = await fetch(`${BACKEND}/api/v1/transfers/start-warm-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        throw new Error(`Transfer request failed: ${res.status}`);
      }
      
      const data = await res.json();
      setTransferInfo(data);

      // Show AI-generated summary
      alert(`🤖 AI Call Summary:\n\n${data.summary}`);

      // Handle room switching based on participant role
      if (identity === payload.caller_identity) {
        // Caller automatically joins transfer room
        await roomRef.current.disconnect();
        setStatus("🔄 Joining transfer room as caller...");
        const lkRoom = new Room();
        await lkRoom.connect(data.livekit_url, data.caller_token);
        roomRef.current = lkRoom;
        updateParticipants(lkRoom);
        setStatus("✅ Joined transfer room as caller");
      } else if (identity === payload.agent_b_identity) {
        // Agent B joins transfer room
        await roomRef.current.disconnect();
        setStatus("🔄 Joining transfer room as Agent B...");
        const lkRoom = new Room();
        await lkRoom.connect(data.livekit_url, data.agent_b_token);
        roomRef.current = lkRoom;
        updateParticipants(lkRoom);
        setStatus("✅ Joined transfer room as Agent B");
      } else if (identity === payload.agent_a_identity) {
        // Agent A joins briefly to read summary then can leave
        setStatus("✅ Transfer initiated successfully! You can now leave the call.");
      }

    } catch (e: any) {
      console.error(e);
      setStatus(`❌ Transfer failed: ${e.message}`);
      alert(`❌ Transfer failed: ${e.message}`);
    } finally {
      setIsTransferring(false);
    }
  }

  async function leaveRoom() {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      setStatus("👋 Left room");
      setParticipants([]);
    }
  }

  async function toggleMute() {
    if (roomRef.current) {
      const enabled = roomRef.current.localParticipant.isMicrophoneEnabled;
      await roomRef.current.localParticipant.setMicrophoneEnabled(!enabled);
    }
  }

  async function toggleVideo() {
    if (roomRef.current) {
      const enabled = roomRef.current.localParticipant.isCameraEnabled;
      await roomRef.current.localParticipant.setCameraEnabled(!enabled);
    }
  }

  const isConnected = roomRef.current?.state === 'connected';
  const isMuted = roomRef.current ? !roomRef.current.localParticipant.isMicrophoneEnabled : false;
  const isVideoOff = roomRef.current ? !roomRef.current.localParticipant.isCameraEnabled : false;

  return (
    <div style={{ 
      padding: '30px', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      color: 'white'
    }}>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto',
        background: 'rgba(255,255,255,0.95)',
        borderRadius: '20px',
        padding: '30px',
        color: '#333',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            margin: '0 0 10px 0',
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 'bold'
          }}>
            🎥 LiveKit Warm Transfer
          </h1>
          <p style={{ margin: 0, fontSize: '16px', color: '#666' }}>
            <strong>Room:</strong> {room} • <strong>Identity:</strong> {identity}
          </p>
        </div>

        {/* Status */}
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '10px', 
          marginBottom: '25px',
          textAlign: 'center',
          fontSize: '16px',
          fontWeight: '500'
        }}>
          📡 Status: {status}
        </div>

        {/* Participants */}
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '15px', color: '#333' }}>
            👥 Participants ({participants.length})
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '10px' 
          }}>
            {participants.map(p => (
              <div key={p.sid} style={{
                padding: '12px',
                backgroundColor: p.sid === 'local' ? '#e3f2fd' : '#f5f5f5',
                borderRadius: '8px',
                border: p.sid === 'local' ? '2px solid #2196F3' : '1px solid #ddd',
                fontSize: '14px'
              }}>
                {p.identity} {p.sid === "local" && <strong>(You)</strong>}
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
          gap: '15px', 
          marginBottom: '25px' 
        }}>
          <button 
            onClick={toggleMute}
            disabled={!isConnected}
            style={{
              padding: '12px',
              backgroundColor: isMuted ? '#f44336' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              opacity: isConnected ? 1 : 0.5
            }}
          >
            {isMuted ? '🔇 Unmute' : '🎤 Mute'}
          </button>

          <button 
            onClick={toggleVideo}
            disabled={!isConnected}
            style={{
              padding: '12px',
              backgroundColor: isVideoOff ? '#f44336' : '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: isConnected ? 'pointer' : 'not-allowed',
              opacity: isConnected ? 1 : 0.5
            }}
          >
            {isVideoOff ? '📷 Camera On' : '📹 Camera Off'}
          </button>

          <button 
            onClick={leaveRoom}
            style={{
              padding: '12px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🚪 Leave Room
          </button>
        </div>

        {/* Warm Transfer Section */}
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#fff3e0', 
          border: '2px solid #ff9800', 
          borderRadius: '12px',
          marginBottom: '25px'
        }}>
          <h3 style={{ fontSize: '18px', margin: '0 0 15px 0', color: '#f57c00' }}>
            🔄 Warm Transfer
          </h3>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Agent B Identity (transfer to):
            </label>
            <input 
              value={agentB} 
              onChange={(e) => setAgentB(e.target.value)}
              placeholder="Enter agent ID (e.g., agent-002)"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button 
            onClick={startWarmTransfer}
            disabled={!isConnected || isTransferring || !agentB.trim()}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: isTransferring ? '#ccc' : '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: (isConnected && !isTransferring && agentB.trim()) ? 'pointer' : 'not-allowed',
              opacity: (isConnected && !isTransferring && agentB.trim()) ? 1 : 0.5
            }}
          >
            {isTransferring ? '🔄 Transferring...' : '🚀 Start Warm Transfer'}
          </button>
        </div>

        {/* Transfer Info */}
        {transferInfo && (
          <div style={{ 
            padding: '20px', 
            backgroundColor: '#e8f5e8', 
            border: '2px solid #4CAF50', 
            borderRadius: '12px'
          }}>
            <h3 style={{ fontSize: '18px', margin: '0 0 15px 0', color: '#2e7d32' }}>
              ✅ Transfer Information
            </h3>
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '15px', 
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              overflow: 'auto',
              maxHeight: '200px'
            }}>
              {JSON.stringify(transferInfo, null, 2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}