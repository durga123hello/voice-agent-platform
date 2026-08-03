"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import * as mediasoupClient from "mediasoup-client";

const BACKEND_URL = "http://localhost:3000";
const WS_BACKEND_URL = "ws://localhost:3000";

interface AgentConfig {
  id: string;
  name: string | null;
  systemPrompt: string;
  llmModel: string;
  voicePreference: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  isStreaming?: boolean;
}

interface QueueItem {
  buffer: AudioBuffer;
  chunkIndex: number;
  recvTime: number;
}

class AudioQueuePlayer {
  private audioCtx: AudioContext | null = null;
  private queue: QueueItem[] = [];
  public isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private onSpeakingStateChange: (speaking: boolean) => void;
  private onPlaybackComplete: () => void;
  public onPlaybackStart?: () => void;
  public onChunkStart?: (chunkIndex: number, durationMs: number, recvTime: number) => void;
  public onChunkEnd?: (chunkIndex: number) => void;
  public onPlaybackError?: (chunkIndex: number, errorMsg: string) => void;

  constructor(
    onSpeakingStateChange: (speaking: boolean) => void,
    onPlaybackComplete: () => void
  ) {
    this.onSpeakingStateChange = onSpeakingStateChange;
    this.onPlaybackComplete = onPlaybackComplete;
  }

  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  async playChunk(base64Audio: string, chunkIndex: number) {
    this.init();
    const recvTime = Date.now();

    try {
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;

      const audioBuffer = await this.audioCtx!.decodeAudioData(arrayBuffer);
      this.queue.push({ buffer: audioBuffer, chunkIndex, recvTime });
      this.playNext();
    } catch (e: any) {
      console.error("Error decoding audio chunk:", e);
      if (this.onPlaybackError) {
        this.onPlaybackError(chunkIndex, e?.message || "Audio decode error");
      }
    }
  }

  stop() {
    this.queue = [];
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {}
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.onSpeakingStateChange(false);
  }

  private playNext() {
    if (!this.audioCtx || this.isPlaying || this.queue.length === 0) return;
    this.isPlaying = true;
    this.onSpeakingStateChange(true);
    
    if (this.onPlaybackStart) {
      this.onPlaybackStart();
    }

    const item = this.queue.shift()!;
    const buffer = item.buffer;
    const chunkIndex = item.chunkIndex;
    const recvTime = item.recvTime;
    const durationMs = Math.round(buffer.duration * 1000);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);
    this.currentSource = source;

    if (this.onChunkStart) {
      this.onChunkStart(chunkIndex, durationMs, recvTime);
    }

    source.onended = () => {
      this.isPlaying = false;
      this.currentSource = null;
      
      if (this.onChunkEnd) {
        this.onChunkEnd(chunkIndex);
      }

      if (this.queue.length === 0) {
        this.onSpeakingStateChange(false);
        this.onPlaybackComplete();
      } else {
        this.playNext();
      }
    };

    source.start(0);
  }
}

export default function TestVoicePage() {
  // Page state
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected" | "reconnecting" | "ended">("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Real-time transcript/conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [utteranceEndFired, setUtteranceEndFired] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // TTS playback verification states
  const [totalChunksReceived, setTotalChunksReceived] = useState<number>(0);
  const [totalChunksPlayed, setTotalChunksPlayed] = useState<number>(0);
  const [currentPlayingChunkIndex, setCurrentPlayingChunkIndex] = useState<number | null>(null);
  const [totalChunksExpected, setTotalChunksExpected] = useState<number | null>(null);
  const [playbackLifecycleLogs, setPlaybackLifecycleLogs] = useState<string[]>([]);

  // Refs for tracking active WebRTC connection
  const wsRef = useRef<WebSocket | null>(null);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const sendTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const producerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const transcriptAreaRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<AudioQueuePlayer | null>(null);
  const userUtteranceIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const reconnectCountRef = useRef<number>(0);
  const isManualDisconnectRef = useRef<boolean>(false);
  const audioStreamFinishedRef = useRef(false);

  const clientBufferToPlaybackMsRef = useRef<number | null>(null);
  const firstAudioChunkRecvTimeRef = useRef<number | null>(null);
  const rttIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Instantiate the Audio Queue Player on mount
  useEffect(() => {
    const player = new AudioQueuePlayer(
      (speaking) => {
        setIsSpeaking(speaking);
      },
      () => {
        // Playback finished locally. Check if the server has finished sending the audio stream.
        if (audioStreamFinishedRef.current) {
          addLog("Assistant audio playback completed. Sending playback_complete to backend.");
          wsRef.current?.send(JSON.stringify({
            type: "playback_complete",
            clientMetrics: {
              clientBufferToPlaybackMs: clientBufferToPlaybackMsRef.current || 0
            }
          }));
          audioStreamFinishedRef.current = false;
          // Reset turn metrics
          firstAudioChunkRecvTimeRef.current = null;
          clientBufferToPlaybackMsRef.current = null;
        }
      }
    );

    player.onPlaybackStart = () => {
      if (firstAudioChunkRecvTimeRef.current && clientBufferToPlaybackMsRef.current === null) {
        const diff = Date.now() - firstAudioChunkRecvTimeRef.current;
        clientBufferToPlaybackMsRef.current = diff;
        addLog(`[Client Latency] Time from first audio chunk received to start of playback: ${diff}ms`);
      }
    };

    player.onChunkStart = (chunkIndex, durationMs, recvTime) => {
      setCurrentPlayingChunkIndex(chunkIndex);
      const delay = Date.now() - recvTime;
      const logMsg = `Chunk ${chunkIndex} started playing. Duration: ${durationMs}ms. Recv-to-play delay: ${delay}ms.`;
      console.log(`[TTS Playback] ${logMsg}`);
      setPlaybackLifecycleLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${logMsg}`]);
    };

    player.onChunkEnd = (chunkIndex) => {
      setTotalChunksPlayed((prev) => prev + 1);
      setCurrentPlayingChunkIndex(null);
      const logMsg = `Chunk ${chunkIndex} finished playing successfully.`;
      console.log(`[TTS Playback] ${logMsg}`);
      setPlaybackLifecycleLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${logMsg}`]);
      
      // Acknowledge back to backend
      wsRef.current?.send(JSON.stringify({
        type: "chunk_played",
        chunkIndex
      }));
    };

    player.onPlaybackError = (chunkIndex, errorMsg) => {
      const logMsg = `ERROR playing Chunk ${chunkIndex}: ${errorMsg}`;
      console.error(`[TTS Playback] ${logMsg}`);
      setPlaybackLifecycleLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${logMsg}`]);
      
      // Report playback error to backend
      wsRef.current?.send(JSON.stringify({
        type: "playback_error",
        chunkIndex,
        error: errorMsg
      }));
    };

    audioPlayerRef.current = player;
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.stop();
      }
    };
  }, []);

  // Fetch agent configurations on load
  useEffect(() => {
    async function loadConfigs() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/agent-configs`);
        if (!res.ok) throw new Error("Failed to fetch agent configs");
        const data = await res.json();
        setConfigs(data);
        if (data.length > 0) {
          setSelectedConfigId(data[0].id);
        }
      } catch (err: any) {
        setErrorMessage("Error loading configurations. Please make sure the backend is running.");
      }
    }
    loadConfigs();
  }, []);

  // Auto-scroll transcript container to the bottom when messages update
  useEffect(() => {
    if (transcriptAreaRef.current) {
      transcriptAreaRef.current.scrollTop = transcriptAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const addLog = (msg: string) => {
    const timestamped = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log(timestamped);
    setLogs((prev) => [...prev, timestamped]);
  };

  const handleConnect = async () => {
    isManualDisconnectRef.current = false;
    reconnectCountRef.current = 0;
    await connectSession(null);
  };

  const connectSession = async (existingSessionId: string | null) => {
    setErrorMessage(null);
    if (!existingSessionId) {
      setMessages([]);
      setLogs([]);
    }

    if (!selectedConfigId) {
      setErrorMessage("Please select an Agent Configuration first. If none are listed, create one on the Setup Page.");
      setStatus("disconnected");
      return;
    }

    try {
      // Warm up / authorize Audio Context
      if (audioPlayerRef.current) {
        audioPlayerRef.current.init();
      }

      let sessionId = existingSessionId;

      if (!sessionId) {
        setStatus("connecting");
        addLog("Step 1: Creating database session via POST /api/sessions...");

        // 1. Create a real session in PostgreSQL
        const sessionRes = await fetch(`${BACKEND_URL}/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentConfigId: selectedConfigId }),
        });

        if (!sessionRes.ok) {
          const errData = await sessionRes.json();
          throw new Error(errData?.error || "Failed to create session in database.");
        }

        const sessionData = await sessionRes.json();
        sessionId = sessionData.id;
        sessionIdRef.current = sessionId;
        addLog(`Session created successfully. Session ID: ${sessionId}`);
      } else {
        setStatus("reconnecting");
        addLog(`Attempting to reconnect. Reusing Session ID: ${sessionId} (Attempt ${reconnectCountRef.current}/3)`);
      }

      // 2. Open signaling WebSocket
      addLog(`Step 2: Opening signaling WebSocket at ${WS_BACKEND_URL}/ws/sessions/${sessionId}...`);
      const ws = new WebSocket(`${WS_BACKEND_URL}/ws/sessions/${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog("Signaling WebSocket connection opened. Requesting router capabilities...");
        if (reconnectCountRef.current > 0) {
          addLog("Reconnection successful!");
          reconnectCountRef.current = 0;
        }
        ws.send(JSON.stringify({ type: "getRouterRtpCapabilities" }));
      };

      ws.onclose = (event) => {
        addLog(`Signaling WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
        
        if (!isManualDisconnectRef.current) {
          const attempts = reconnectCountRef.current;
          if (attempts < 3) {
            const nextAttempts = attempts + 1;
            reconnectCountRef.current = nextAttempts;
            setStatus("reconnecting");
            
            // Clean up current transports/producers/sockets, but keep sessionId
            handleDisconnect(true);
            
            const delay = nextAttempts * 2000;
            addLog(`Scheduling automatic reconnection attempt ${nextAttempts}/3 in ${delay}ms...`);
            setTimeout(() => {
              connectSession(sessionIdRef.current);
            }, delay);
          } else {
            addLog("Max reconnect attempts reached. Disconnecting.");
            setErrorMessage("Connection lost. Failed to reconnect after 3 attempts.");
            handleDisconnect(false);
          }
        } else {
          handleDisconnect(false);
        }
      };

      ws.onerror = (err) => {
        console.error("Signaling WebSocket error:", err);
        addLog("Signaling WebSocket encountered a network error.");
      };

      ws.onmessage = async (event) => {
        console.log(`[Raw WS Incoming Message]`, event.data);
        
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case "routerRtpCapabilities": {
              addLog("Received Router RTP Capabilities from server. Initializing mediasoup Device...");
              const device = new mediasoupClient.Device();
              await device.load({ routerRtpCapabilities: data.rtpCapabilities });
              deviceRef.current = device;
              addLog(`Device loaded successfully. Loaded = ${device.loaded}. HandlerName: ${device.handlerName}`);
              
              addLog("Requesting WebRTC Send Transport from server...");
              ws.send(JSON.stringify({ type: "createWebRtcTransport" }));
              break;
            }

            case "webRtcTransportCreated": {
              addLog("WebRTC Send Transport configurations received from server. Constructing locally...");
              const { id, iceParameters, iceCandidates, dtlsParameters } = data;
              
              const device = deviceRef.current;
              if (!device) throw new Error("Device not initialized");

              // Create local send transport
              const sendTransport = device.createSendTransport({
                id,
                iceParameters,
                iceCandidates,
                dtlsParameters
              });
              sendTransportRef.current = sendTransport;
              addLog(`Local WebRtcTransport instantiated. ID: ${sendTransport.id}`);

              // Monitor connection and ICE state changes
              sendTransport.on("connectionstatechange", (state) => {
                addLog(`[WebRTC Transport connectionstatechange] Local State: ${state}`);
              });

              // Attempt to hook directly into the underlying peer connection
              try {
                // @ts-ignore
                const pc: RTCPeerConnection = (sendTransport as any)._handler?._pc;
                if (pc) {
                  addLog("Direct RTCPeerConnection reference found. Hooking ICE state events.");
                  pc.oniceconnectionstatechange = () => {
                    addLog(`[Direct PeerConnection ICE state change] State: ${pc.iceConnectionState}`);
                  };
                  pc.onconnectionstatechange = () => {
                    addLog(`[Direct PeerConnection Connection state change] State: ${pc.connectionState}`);
                  };
                }
              } catch (e) {
                console.warn("Could not bind direct peer connection listeners:", e);
              }

              // Handle transport connect DTLS exchange
              sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
                addLog("Local transport emitted 'connect' event. Sending DTLS parameters to server...");
                ws.send(JSON.stringify({
                  type: "connectWebRtcTransport",
                  transportId: sendTransport.id,
                  dtlsParameters
                }));
                
                const onConnected = (evt: MessageEvent) => {
                  const msg = JSON.parse(evt.data);
                  if (msg.type === "webRtcTransportConnected") {
                    addLog("Received confirmation from server: WebRtcTransport connected.");
                    callback();
                    ws.removeEventListener("message", onConnected);
                  } else if (msg.type === "error") {
                    addLog(`Server DTLS connection failed: ${msg.message}`);
                    errback(new Error(msg.message));
                    ws.removeEventListener("message", onConnected);
                  }
                };
                ws.addEventListener("message", onConnected);
              });

              // Handle media production
              sendTransport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
                addLog(`Local transport emitted 'produce' event for kind: ${kind}. Sending RTP parameters to server...`);
                ws.send(JSON.stringify({
                  type: "produce",
                  transportId: sendTransport.id,
                  kind,
                  rtpParameters
                }));

                const onProduced = (evt: MessageEvent) => {
                  const msg = JSON.parse(evt.data);
                  if (msg.type === "produced") {
                    addLog(`Media production established on server. Producer ID: ${msg.id}`);
                    callback({ id: msg.id });
                    setStatus("connected");
                    
                    // Periodically query WebRTC stats for round trip time
                    if (rttIntervalRef.current) {
                      clearInterval(rttIntervalRef.current);
                    }
                    rttIntervalRef.current = setInterval(async () => {
                      const sendTr = sendTransportRef.current;
                      if (!sendTr || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
                      try {
                        // @ts-ignore
                        const pc: RTCPeerConnection = (sendTr as any)._handler?._pc;
                        if (pc) {
                          const stats = await pc.getStats();
                          let rtt: number | null = null;
                          stats.forEach((report) => {
                            if (report.type === "candidate-pair" && typeof report.currentRoundTripTime === "number") {
                              if (report.nominated || report.state === "succeeded" || rtt === null) {
                                rtt = Math.round(report.currentRoundTripTime * 1000);
                              }
                            }
                          });
                          if (rtt !== null) {
                            console.log(`[WebRTC Stats] Measured RTT: ${rtt}ms`);
                            wsRef.current.send(JSON.stringify({
                              type: "webrtc_rtt",
                              rttMs: rtt
                            }));
                          }
                        }
                      } catch (err) {
                        console.error("Failed to read ICE getStats:", err);
                      }
                    }, 3000);

                    ws.removeEventListener("message", onProduced);
                  } else if (msg.type === "error") {
                    addLog(`Server media production failed: ${msg.message}`);
                    errback(new Error(msg.message));
                    ws.removeEventListener("message", onProduced);
                  }
                };
                ws.addEventListener("message", onProduced);
              });

              // Capture microphone and produce
              addLog("Requesting local microphone stream access (getUserMedia)...");
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              micStreamRef.current = stream;
              const track = stream.getAudioTracks()[0];
              
              addLog(`Microphone track successfully captured. Label: "${track.label}", ID: "${track.id}", ReadyState: "${track.readyState}"`);
              
              addLog("Starting media production on local send transport...");
              const producer = await sendTransport.produce({ track });
              producerRef.current = producer;
              addLog(`Local Producer established. Producer ID: ${producer.id}`);
              break;
            }

            case "transcript": {
              const { isFinal, text } = data;
              addLog(`Received Transcript from server: "${text}" (isFinal: ${isFinal})`);
              
              // Barge-in check: If user starts speaking while assistant audio is playing
              if (text.trim() && audioPlayerRef.current?.isPlaying) {
                addLog("[Interruption] User spoke over assistant. Cancelling assistant audio and signaling backend.");
                // 1. Stop local audio queue
                audioPlayerRef.current.stop();
                // 2. Notify backend to cancel OpenAI completions and deepgram TTS streams
                wsRef.current?.send(JSON.stringify({ type: "interrupt" }));
                // Reset client-side latency refs
                firstAudioChunkRecvTimeRef.current = null;
                clientBufferToPlaybackMsRef.current = null;
              }

              setMessages((prev) => {
                const currentId = userUtteranceIdRef.current;

                if (currentId) {
                  // We have an active bubble for this utterance in the chat array
                  if (isFinal) {
                    // Final transcript locks in the bubble. Reset utterance ref.
                    userUtteranceIdRef.current = null;
                    return prev.map((msg) =>
                      msg.id === currentId
                        ? { id: currentId, role: "user" as const, text }
                        : msg
                    );
                  } else {
                    // Interim update replaces the text in-place
                    return prev.map((msg) =>
                      msg.id === currentId
                        ? { ...msg, text }
                        : msg
                    );
                  }
                } else {
                  // No active utterance bubble exists yet for this speech turn
                  const newId = `user-${Date.now()}`;
                  if (isFinal) {
                    // One-shot final transcript: directly append finalized bubble
                    return [
                      ...prev,
                      { id: newId, role: "user" as const, text }
                    ];
                  } else {
                    // Start a new in-progress bubble and register its ID in the ref
                    userUtteranceIdRef.current = newId;
                    return [
                      ...prev,
                      { id: newId, role: "user" as const, text, isStreaming: true }
                    ];
                  }
                }
              });
              break;
            }

            case "utteranceEnd": {
              addLog("[Deepgram Event] Received UtteranceEnd event from backend.");
              setUtteranceEndFired(true);
              setTimeout(() => setUtteranceEndFired(false), 1500);
              break;
            }

            case "llm_start": {
              addLog("Assistant is thinking...");
              setMessages((prev) => [
                ...prev,
                { id: "assistant-streaming", role: "assistant", text: "", isStreaming: true }
              ]);
              break;
            }

            case "llm_chunk": {
              const { text } = data;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === "assistant-streaming"
                    ? { ...msg, text: msg.text + text }
                    : msg
                )
              );
              break;
            }

            case "llm_done": {
              const { fullText } = data;
              addLog("Assistant response completed.");
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === "assistant-streaming"
                    ? { id: `assistant-${Date.now()}`, role: "assistant", text: fullText }
                    : msg
                )
              );
              break;
            }

            case "audio_chunk": {
              const { audio, chunkIndex } = data;
              if (chunkIndex === 1) {
                setTotalChunksReceived(1);
                setTotalChunksPlayed(0);
                setCurrentPlayingChunkIndex(null);
                setTotalChunksExpected(null);
                setPlaybackLifecycleLogs([]);
              } else {
                setTotalChunksReceived((prev) => prev + 1);
              }
              const logMsg = `Received Chunk ${chunkIndex} from server. Size: ${audio.length} base64 chars.`;
              console.log(`[TTS Playback] ${logMsg}`);
              setPlaybackLifecycleLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${logMsg}`]);

              if (!firstAudioChunkRecvTimeRef.current) {
                firstAudioChunkRecvTimeRef.current = Date.now();
              }
              if (audioPlayerRef.current) {
                audioPlayerRef.current.playChunk(audio, chunkIndex);
              }
              break;
            }

            case "tts_done": {
              const { totalChunks } = data;
              addLog(`Received tts_done from server. Total expected chunks: ${totalChunks}.`);
              setTotalChunksExpected(totalChunks);
              audioStreamFinishedRef.current = true;
              // If the queue is already empty (not playing), signal playback_complete immediately
              if (audioPlayerRef.current && !audioPlayerRef.current.isPlaying) {
                addLog("Audio queue is already empty. Signaling playback_complete immediately.");
                wsRef.current?.send(JSON.stringify({
                  type: "playback_complete",
                  clientMetrics: {
                    clientBufferToPlaybackMs: clientBufferToPlaybackMsRef.current || 0
                  }
                }));
                audioStreamFinishedRef.current = false;
                // Reset turn metrics
                firstAudioChunkRecvTimeRef.current = null;
                clientBufferToPlaybackMsRef.current = null;
              }
              break;
            }

            case "error": {
              throw new Error(data.message);
            }

            default:
              console.log("Unhandled WebSocket message type:", data.type);
          }
        } catch (err: any) {
          console.error("Error processing WebSocket message:", err);
          setErrorMessage(err.message || "Failed to negotiate connection.");
          handleDisconnect(false);
        }
      };

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to establish WebRTC connection.");
      handleDisconnect(false);
    }
  };

  const handleDisconnect = (keepSession = false) => {
    if (!keepSession) {
      setStatus("disconnected");
      sessionIdRef.current = null;
    }
    
    // Stop local mic stream
    if (micStreamRef.current) {
      addLog("Stopping all local microphone tracks...");
      micStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        addLog(`Stopped track: ${track.label}`);
      });
      micStreamRef.current = null;
    }

    // Stop and clear audio playback queue
    if (audioPlayerRef.current) {
      addLog("Stopping and clearing assistant audio player...");
      audioPlayerRef.current.stop();
    }

    if (rttIntervalRef.current) {
      clearInterval(rttIntervalRef.current);
      rttIntervalRef.current = null;
    }

    // Close mediasoup components
    if (producerRef.current) {
      addLog("Closing local media producer...");
      try {
        producerRef.current.close();
      } catch (e) {
        console.warn("Error closing media producer:", e);
      }
      producerRef.current = null;
    }
    if (sendTransportRef.current) {
      addLog("Closing WebRTC Send Transport...");
      try {
        sendTransportRef.current.close();
      } catch (e) {
        console.warn("Error closing WebRTC transport:", e);
      }
      sendTransportRef.current = null;
    }
    deviceRef.current = null;

    // Close WebSocket
    if (wsRef.current) {
      addLog("Closing WebSocket connection...");
      wsRef.current.onclose = null; // Prevent double trigger reconnect loop on manual close
      wsRef.current.close();
      wsRef.current = null;
    }

    userUtteranceIdRef.current = null;
    audioStreamFinishedRef.current = false;
    
    addLog("Cleanup finished.");
  };

  const handleEndInterview = async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    
    // 1. Instantly stop all local mic tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    // 2. Instantly stop playing audio
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
    }

    // 3. Close Mediasoup components locally
    if (producerRef.current) {
      try { producerRef.current.close(); } catch(e) {}
      producerRef.current = null;
    }
    if (sendTransportRef.current) {
      try { sendTransportRef.current.close(); } catch(e) {}
      sendTransportRef.current = null;
    }
    deviceRef.current = null;

    // 4. Close signaling socket
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent reconnect triggers
      wsRef.current.close();
      wsRef.current = null;
    }

    // 5. Update state to "ended"
    setStatus("ended");
    addLog("Session ended by user.");

    // 6. Call POST /api/sessions/:id/end on the backend asynchronously
    try {
      await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/end`, {
        method: "POST",
      });
      addLog("Backend session status marked completed successfully.");
    } catch (err) {
      console.error("Failed to mark session completed on backend:", err);
    }
  };

  return (
    <div className="container">
      <h1>Voice AI Agent Platform — WebRTC Voice Loop</h1>
      
      <div style={{ marginBottom: "20px", display: "flex", gap: "12px" }}>
        <Link href="/" className="btn btn-secondary">
          &larr; Back to Setup Page
        </Link>
        <Link href="/sessions" className="btn btn-secondary">
          View Session History &rarr;
        </Link>
      </div>

      {status === "ended" && sessionIdRef.current && (
        <div className="alert alert-success" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <strong>Interview Completed!</strong> The conversation has been saved.
          </div>
          <Link href={`/sessions/${sessionIdRef.current}`} className="btn btn-primary" style={{ padding: "6px 12px", fontSize: "14px" }}>
            View Detailed Transcript &rarr;
          </Link>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-error">
          {errorMessage}
        </div>
      )}

      <div className="card">
        <h2>1. Start a Voice Session</h2>
        <div className="form-group">
          <label htmlFor="agent-config-select">Select Agent Configuration</label>
          <select
            id="agent-config-select"
            value={selectedConfigId}
            onChange={(e) => setSelectedConfigId(e.target.value)}
            disabled={status !== "disconnected"}
          >
            {configs.length === 0 ? (
              <option value="">No configurations found. Create one first!</option>
            ) : (
              configs.map((config) => (
                <option key={config.id} value={config.id}>
                  {config.name ? `${config.name} (${config.id.slice(0, 8)})` : config.id}
                </option>
              ))
            )}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {status === "disconnected" ? (
            <button className="btn btn-success" onClick={handleConnect} disabled={configs.length === 0}>
              Connect Microphone
            </button>
          ) : status === "ended" ? (
            <button className="btn btn-secondary" onClick={() => setStatus("disconnected")}>
              Start New Session
            </button>
          ) : (
            <>
              <button
                className="btn btn-danger"
                onClick={() => {
                  isManualDisconnectRef.current = true;
                  handleDisconnect(false);
                }}
              >
                Disconnect
              </button>

              <button
                className="btn"
                style={{ backgroundColor: "#8250df", color: "#ffffff" }}
                onClick={handleEndInterview}
              >
                End Interview
              </button>
            </>
          )}

          <div
            className={`voice-status ${
              status === "connected"
                ? "status-connected"
                : status === "connecting" || status === "reconnecting"
                ? "status-connecting"
                : "status-disconnected"
            }`}
            style={
              status === "reconnecting"
                ? {
                    backgroundColor: "rgba(255, 165, 0, 0.15)",
                    color: "orange",
                    border: "1px solid rgba(255, 165, 0, 0.3)"
                  }
                : undefined
            }
          >
            {status === "connected" && <div className="pulse-indicator"></div>}
            {status === "reconnecting" && (
              <div
                className="pulse-indicator"
                style={{
                  backgroundColor: "orange",
                  boxShadow: "0 0 0 0 rgba(255, 165, 0, 0.7)",
                  animation: "pulse-orange 1.5s infinite"
                }}
              ></div>
            )}
            <span>
              {status === "connected"
                ? "Connected"
                : status === "connecting"
                ? "Connecting..."
                : status === "reconnecting"
                ? `Reconnecting (Attempt ${reconnectCountRef.current}/3)...`
                : "Disconnected"}
            </span>
          </div>

          {utteranceEndFired && (
            <div
              className="voice-status"
              style={{
                backgroundColor: "rgba(88, 166, 255, 0.2)",
                color: "#58a6ff",
                border: "1px solid rgba(88, 166, 255, 0.4)"
              }}
            >
              ⚡ UtteranceEnd Fired
            </div>
          )}

          {isSpeaking && (
            <div
              className="voice-status"
              style={{
                backgroundColor: "rgba(255, 165, 0, 0.2)",
                color: "orange",
                border: "1px solid rgba(255, 165, 0, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <div
                className="pulse-indicator"
                style={{
                  backgroundColor: "orange",
                  boxShadow: "0 0 0 0 rgba(255, 165, 0, 0.7)",
                  animation: "pulse-orange 1s infinite"
                }}
              ></div>
              <span>🔊 Assistant Speaking {currentPlayingChunkIndex !== null && `(Chunk ${currentPlayingChunkIndex} of ${totalChunksExpected !== null ? totalChunksExpected : "..."})`}</span>
            </div>
          )}
        </div>
      </div>

      {/* Real-time transcript display */}
      <div className="card">
        <h2>2. Live Conversation Output</h2>
        <div
          ref={transcriptAreaRef}
          className="transcript-area"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            height: "350px",
            overflowY: "auto",
            padding: "16px",
            backgroundColor: "#0d0f12",
            border: "1px solid var(--border-color)",
            borderRadius: "6px"
          }}
        >
          {messages.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
              Conversation will appear here... Speak into your microphone to start.
            </div>
          )}
          
          {messages.map((m) => {
            const isUser = m.role === "user";
            const isInProgress = m.id === "user-in-progress" || m.isStreaming;
            
            return (
              <div
                key={m.id}
                style={{
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  backgroundColor: isInProgress
                    ? "rgba(255, 255, 255, 0.05)"
                    : isUser
                    ? "rgba(35, 134, 54, 0.15)"
                    : "rgba(88, 166, 255, 0.1)",
                  border: `1px solid ${
                    isInProgress
                      ? "var(--border-color)"
                      : isUser
                      ? "rgba(35, 134, 54, 0.4)"
                      : "rgba(88, 166, 255, 0.3)"
                  }`,
                  borderRadius: "8px",
                  padding: "10px 14px",
                  maxWidth: "80%",
                  wordBreak: "break-word",
                  fontStyle: isInProgress ? "italic" : "normal",
                  opacity: isInProgress ? 0.75 : 1
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "bold",
                    color: isInProgress
                      ? "var(--text-muted)"
                      : isUser
                      ? "#56d364"
                      : "#58a6ff",
                    marginBottom: "4px"
                  }}
                >
                  {isUser ? (isInProgress ? "User (speaking)" : "User") : "Assistant"}
                </div>
                <div style={{ color: "#ffffff", fontSize: "15px" }}>
                  {m.text}
                  {isInProgress && (
                    <span
                      className="pulse-indicator"
                      style={{
                        display: "inline-block",
                        marginLeft: "6px",
                        width: "8px",
                        height: "8px"
                      }}
                    ></span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Debug Logs */}
      <div className="card">
        <h2>3. Debug Console Logs</h2>
        <div
          style={{
            backgroundColor: "#0d0f12",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            height: "200px",
            overflowY: "auto",
            padding: "12px",
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#88cc88"
          }}
        >
          {logs.length === 0 ? "Console is empty." : logs.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      </div>

      {/* TTS Delivery & Playback Verification */}
      <div className="card">
        <h2>4. TTS Playback Verification</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "4px" }}>
          Confirms that each TTS audio chunk is successfully delivered, decoded, and played back by the browser.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginTop: "16px" }}>
          <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "12px", backgroundColor: "#0d0f12" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Chunks Received</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#58a6ff", marginTop: "4px" }}>{totalChunksReceived}</div>
          </div>
          <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "12px", backgroundColor: "#0d0f12" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Chunks Successfully Played</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: totalChunksPlayed === totalChunksReceived && totalChunksReceived > 0 ? "#56d364" : "#ffffff", marginTop: "4px" }}>{totalChunksPlayed}</div>
          </div>
          <div style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "12px", backgroundColor: "#0d0f12" }}>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Current Playback State</div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: currentPlayingChunkIndex !== null ? "#ffb454" : "var(--text-muted)", marginTop: "8px" }}>
              {currentPlayingChunkIndex !== null ? `Playing chunk ${currentPlayingChunkIndex} of ${totalChunksExpected !== null ? totalChunksExpected : "..."}` : "Idle"}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "16px" }}>
          <h4 style={{ margin: "0 0 8px 0", color: "#ffffff", fontSize: "13px" }}>Playback Lifecycle Events</h4>
          <div
            style={{
              backgroundColor: "#0d0f12",
              border: "1px solid var(--border-color)",
              borderRadius: "6px",
              height: "120px",
              overflowY: "auto",
              padding: "10px",
              fontFamily: "monospace",
              fontSize: "12px",
              color: "#58a6ff"
            }}
          >
            {playbackLifecycleLogs.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No lifecycle events yet.</div>
            ) : (
              playbackLifecycleLogs.map((log, i) => <div key={i}>{log}</div>)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
