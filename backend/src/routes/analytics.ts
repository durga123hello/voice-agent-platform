import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../db/client';
import { DEFAULT_TENANT_ID } from '../index';

const router = Router();

function getPercentile(list: number[], percentile: number): number {
  if (list.length === 0) return 0;
  const sorted = [...list].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * (percentile / 100));
  return sorted[index] || 0;
}

router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configId = req.query.configId as string | undefined;
    const excludeActiveZeroTurns = req.query.excludeActiveZeroTurns !== 'false'; // defaults to true

    // 1. Fetch all sessions under the default tenant, including events and assistant messages
    const sessions = await prisma.session.findMany({
      where: { tenantId: DEFAULT_TENANT_ID },
      include: {
        messages: {
          where: { role: 'assistant' }
        },
        sessionEvents: true,
        agentConfigVersion: {
          include: {
            agentConfig: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    // 2. Extract available configs list for dropdown
    const uniqueConfigsMap = new Map<string, string>();
    sessions.forEach(s => {
      const cfg = s.agentConfigVersion?.agentConfig;
      if (cfg) {
        uniqueConfigsMap.set(cfg.id, cfg.name || 'Unnamed Agent');
      }
    });
    const availableConfigs = Array.from(uniqueConfigsMap.entries()).map(([id, name]) => ({ id, name }));

    // 3. Filter sessions list for the table
    const tableSessions = configId
      ? sessions.filter(s => s.agentConfigVersion?.agentConfig?.id === configId)
      : sessions;

    // 4. Filter sessions list for aggregates calculation
    const aggregateSessions = tableSessions.filter(s => {
      if (excludeActiveZeroTurns) {
        // Exclude active sessions that have 0 assistant turns
        if (s.status === 'active' && s.messages.length === 0) {
          return false;
        }
      }
      return true;
    });

    const totalSessions = aggregateSessions.length;

    // 5. Completion rate / Status breakdown
    let completedCount = 0;
    let abortedCount = 0;
    let activeCount = 0;

    // 6. Durations
    let totalDurationMs = 0;
    let durationCount = 0;

    // 7. Turns
    let totalTurns = 0;

    // 8. Events counts
    let totalInterruptions = 0;
    let totalSilenceNudges = 0;
    let totalReconnects = 0;

    // 9. Latencies lists
    const firstTokenLatencies: number[] = [];
    const firstAudioLatencies: number[] = [];
    const totalTurnLatencies: number[] = [];

    // Component-level durations lists
    const sttLatencies: number[] = [];
    const llmLatencies: number[] = [];
    const ttsLatencies: number[] = [];
    const firstTokenCheckLatencies: number[] = [];

    // Sub-component level durations lists
    const networkToOpenAiLatencies: number[] = [];
    const generationLatencies: number[] = [];
    const networkToDeepgramTtsLatencies: number[] = [];
    const audioRelayToClientLatencies: number[] = [];
    const clientBufferToPlaybackLatencies: number[] = [];
    const deepgramNetworkAndEndpointingLatencies: number[] = [];
    const localPipelineLatencies: number[] = [];
    const deepgramNetworkRttLatencies: number[] = [];
    const deepgramProcessingLatencies: number[] = [];
    const interimTranscriptCounts: number[] = [];
    const webrtcRttLatencies: number[] = [];

    // 10. Token Usage
    let totalTokens = 0;

    // 11. Reliability & Behavioral-Health Metrics
    let openaiErrorCount = 0;
    let deepgramSttErrorCount = 0;
    let deepgramTtsErrorCount = 0;
    let playbackErrorCount = 0;

    let abortedTurnSum = 0;
    let abortedElapsedTimeSum = 0;
    let abortedWithEventCount = 0;

    let totalBargeInRateSum = 0;
    let bargeInRateSessionCount = 0;

    let completedNudgesSum = 0;
    let completedSessionsForNudges = 0;

    let abortedNudgesSum = 0;
    let abortedSessionsForNudges = 0;

    aggregateSessions.forEach((s) => {
      // Status breakdown
      if (s.status === 'completed') completedCount++;
      else if (s.status === 'aborted') abortedCount++;
      else activeCount++;

      // Session Duration (completed/aborted sessions only)
      if (s.endedAt && s.startedAt) {
        totalDurationMs += s.endedAt.getTime() - s.startedAt.getTime();
        durationCount++;
      }

      // Turn Counts
      const turnsCount = s.messages.length;
      totalTurns += turnsCount;

      let sessionInterruptions = 0;
      let sessionSilenceNudges = 0;

      s.sessionEvents.forEach((evt) => {
        if (evt.eventType === 'interruption') {
          totalInterruptions++;
          sessionInterruptions++;
        } else if (evt.eventType === 'silence_prompt') {
          totalSilenceNudges++;
          sessionSilenceNudges++;
        } else if (evt.eventType === 'reconnect') {
          totalReconnects++;
        } else if (evt.eventType === 'token_usage' && evt.metadata) {
          const meta = evt.metadata as any;
          const tokensUsed = meta.totalTokens || 0;
          totalTokens += tokensUsed;
        } else if (evt.eventType === 'turn_latency' && evt.metadata) {
          const meta = evt.metadata as any;
          if (typeof meta.utteranceEndToFirstTokenMs === 'number') {
            firstTokenLatencies.push(meta.utteranceEndToFirstTokenMs);
          }
          if (typeof meta.firstTokenToFirstAudioMs === 'number') {
            firstAudioLatencies.push(meta.firstTokenToFirstAudioMs);
          }
          if (typeof meta.totalTurnMs === 'number') {
            totalTurnLatencies.push(meta.totalTurnMs);
          }

          // Component latency metrics
          if (typeof meta.sttDurationMs === 'number') {
            sttLatencies.push(meta.sttDurationMs);
          }
          if (typeof meta.llmDurationMs === 'number') {
            llmLatencies.push(meta.llmDurationMs);
          }
          if (typeof meta.ttsDurationMs === 'number') {
            ttsLatencies.push(meta.ttsDurationMs);
          }
          if (typeof meta.firstTokenMs === 'number') {
            firstTokenCheckLatencies.push(meta.firstTokenMs);
          }

          // Sub-component latency metrics
          if (typeof meta.networkToOpenAiMs === 'number') {
            networkToOpenAiLatencies.push(meta.networkToOpenAiMs);
          }
          if (typeof meta.generationMs === 'number') {
            generationLatencies.push(meta.generationMs);
          }
          if (typeof meta.networkToDeepgramTtsMs === 'number') {
            networkToDeepgramTtsLatencies.push(meta.networkToDeepgramTtsMs);
          }
          if (typeof meta.audioRelayToClientMs === 'number') {
            audioRelayToClientLatencies.push(meta.audioRelayToClientMs);
          }
          if (typeof meta.clientBufferToPlaybackMs === 'number') {
            clientBufferToPlaybackLatencies.push(meta.clientBufferToPlaybackMs);
          }
          if (typeof meta.deepgramNetworkAndEndpointingMs === 'number') {
            deepgramNetworkAndEndpointingLatencies.push(meta.deepgramNetworkAndEndpointingMs);
          }
          if (typeof meta.local_pipeline_ms === 'number') {
            localPipelineLatencies.push(meta.local_pipeline_ms);
          }
          if (typeof meta.deepgram_network_rtt_ms === 'number') {
            deepgramNetworkRttLatencies.push(meta.deepgram_network_rtt_ms);
          }
          if (typeof meta.deepgram_processing_ms === 'number') {
            deepgramProcessingLatencies.push(meta.deepgram_processing_ms);
          }
          if (typeof meta.interim_transcript_count === 'number') {
            interimTranscriptCounts.push(meta.interim_transcript_count);
          }
          if (typeof meta.webrtc_rtt_ms === 'number') {
            webrtcRttLatencies.push(meta.webrtc_rtt_ms);
          }
        } else if (evt.eventType === 'provider_error' && evt.metadata) {
          const meta = evt.metadata as any;
          if (meta.provider === 'openai') openaiErrorCount++;
          else if (meta.provider === 'deepgram_stt') deepgramSttErrorCount++;
          else if (meta.provider === 'deepgram_tts') deepgramTtsErrorCount++;
        } else if (evt.eventType === 'playback_error') {
          playbackErrorCount++;
        } else if (evt.eventType === 'abort' && evt.metadata) {
          const meta = evt.metadata as any;
          if (typeof meta.abortedAtTurn === 'number') {
            abortedTurnSum += meta.abortedAtTurn;
            abortedElapsedTimeSum += meta.elapsedTimeMs || 0;
            abortedWithEventCount++;
          }
        }
      });

      // Barge-in rate relative to session length
      if (turnsCount > 0) {
        totalBargeInRateSum += (sessionInterruptions / turnsCount);
        bargeInRateSessionCount++;
      }

      // Nudge correlation
      if (s.status === 'completed') {
        completedNudgesSum += sessionSilenceNudges;
        completedSessionsForNudges++;
      } else if (s.status === 'aborted') {
        abortedNudgesSum += sessionSilenceNudges;
        abortedSessionsForNudges++;
      }
    });

    // Format all sessions for table display (based on tableSessions filter)
    const formattedSessions = tableSessions.map((s) => {
      let sessionInterruptions = 0;
      let sessionSilenceNudges = 0;
      let sessionReconnects = 0;
      let sessionTokens = 0;
      let sessionProviderErrors = 0;
      let abortedAtTurn: number | null = null;
      let abortedElapsedTimeMs: number | null = null;
      const sessionTurnLatencies: number[] = [];
      const sessionSttLatencies: number[] = [];
      const sessionLlmLatencies: number[] = [];
      const sessionTtsLatencies: number[] = [];
      const sessionHandoff1Latencies: number[] = []; // utteranceEndToFirstTokenMs
      const sessionHandoff2Latencies: number[] = []; // firstTokenToFirstAudioMs
      const sessionDeepgramWaitLatencies: number[] = [];
      const sessionSttComputeLatencies: number[] = [];
      const sessionLlmNetworkLatencies: number[] = [];
      const sessionLlmGenLatencies: number[] = [];
      const sessionTtsNetComputeLatencies: number[] = [];
      const sessionMediasoupToFfmpegLatencies: (number | null)[] = [];
      const sessionFfmpegTranscodeLatencies: (number | null)[] = [];
      const sessionDeepgramNetworkAndComputeLatencies: number[] = [];
      const sessionLocalPipelineLatencies: number[] = [];
      const sessionDeepgramNetworkRttLatencies: number[] = [];
      const sessionDeepgramProcessingLatencies: number[] = [];
      const sessionInterimTranscriptCounts: number[] = [];
      const sessionWebrtcRttLatencies: number[] = [];

      s.sessionEvents.forEach((evt) => {
        if (evt.eventType === 'interruption') {
          sessionInterruptions++;
        } else if (evt.eventType === 'silence_prompt') {
          sessionSilenceNudges++;
        } else if (evt.eventType === 'reconnect') {
          sessionReconnects++;
        } else if (evt.eventType === 'token_usage' && evt.metadata) {
          const meta = evt.metadata as any;
          sessionTokens += meta.totalTokens || 0;
        } else if (evt.eventType === 'provider_error') {
          sessionProviderErrors++;
        } else if (evt.eventType === 'abort' && evt.metadata) {
          const meta = evt.metadata as any;
          abortedAtTurn = typeof meta.abortedAtTurn === 'number' ? meta.abortedAtTurn : null;
          abortedElapsedTimeMs = typeof meta.elapsedTimeMs === 'number' ? meta.elapsedTimeMs : null;
        } else if (evt.eventType === 'turn_latency' && evt.metadata) {
          const meta = evt.metadata as any;
          if (typeof meta.totalTurnMs === 'number') {
            sessionTurnLatencies.push(meta.totalTurnMs);
          }
          if (typeof meta.sttDurationMs === 'number') {
            sessionSttLatencies.push(meta.sttDurationMs);
          }
          if (typeof meta.llmDurationMs === 'number') {
            sessionLlmLatencies.push(meta.llmDurationMs);
          }
          if (typeof meta.ttsDurationMs === 'number') {
            sessionTtsLatencies.push(meta.ttsDurationMs);
          }
          if (typeof meta.utteranceEndToFirstTokenMs === 'number') {
            sessionHandoff1Latencies.push(meta.utteranceEndToFirstTokenMs);
          }
          if (typeof meta.firstTokenToFirstAudioMs === 'number') {
            sessionHandoff2Latencies.push(meta.firstTokenToFirstAudioMs);
          }

          // Parse new sub-breakdown metrics with fallback support
          const deepgramWait = typeof meta.deepgram_wait_ms === 'number'
            ? meta.deepgram_wait_ms
            : 1300;
          const sttCompute = typeof meta.stt_network_and_compute_ms === 'number'
            ? meta.stt_network_and_compute_ms
            : Math.max(0, (meta.sttDurationMs || 0) - 1300);
          const llmNetwork = typeof meta.llm_network_ms === 'number'
            ? meta.llm_network_ms
            : (meta.networkToOpenAiMs || 0);
          const llmGen = typeof meta.llm_generation_ms === 'number'
            ? meta.llm_generation_ms
            : (meta.generationMs || 0);
          const ttsNetCompute = typeof meta.tts_network_and_synthesis_ms === 'number'
            ? meta.tts_network_and_synthesis_ms
            : (meta.networkToDeepgramTtsMs || 0);

          sessionDeepgramWaitLatencies.push(deepgramWait);
          sessionSttComputeLatencies.push(sttCompute);
          sessionLlmNetworkLatencies.push(llmNetwork);
          sessionLlmGenLatencies.push(llmGen);
          sessionTtsNetComputeLatencies.push(ttsNetCompute);

          // Parse 3 new STT sub-breakdown metrics
          const msToFfmpeg = typeof meta.mediasoup_to_ffmpeg_ms === 'number'
            ? meta.mediasoup_to_ffmpeg_ms
            : null;
          const ffmpegTranscode = typeof meta.ffmpeg_transcode_ms === 'number'
            ? meta.ffmpeg_transcode_ms
            : null;
          const dgNetCompute = typeof meta.deepgram_network_and_compute_ms === 'number'
            ? meta.deepgram_network_and_compute_ms
            : Math.max(0, (meta.sttDurationMs || 0) - 1300);

          sessionMediasoupToFfmpegLatencies.push(msToFfmpeg);
          sessionFfmpegTranscodeLatencies.push(ffmpegTranscode);
          sessionDeepgramNetworkAndComputeLatencies.push(dgNetCompute);

          const localPipeline = typeof meta.local_pipeline_ms === 'number'
            ? meta.local_pipeline_ms
            : 0;
          const deepgramNetworkRtt = typeof meta.deepgram_network_rtt_ms === 'number'
            ? meta.deepgram_network_rtt_ms
            : 0;
          const deepgramProcessing = typeof meta.deepgram_processing_ms === 'number'
            ? meta.deepgram_processing_ms
            : Math.max(0, (meta.sttDurationMs || 0) - 1300);
          const interimTranscriptCount = typeof meta.interim_transcript_count === 'number'
            ? meta.interim_transcript_count
            : 0;

          sessionLocalPipelineLatencies.push(localPipeline);
          sessionDeepgramNetworkRttLatencies.push(deepgramNetworkRtt);
          sessionDeepgramProcessingLatencies.push(deepgramProcessing);
          sessionInterimTranscriptCounts.push(interimTranscriptCount);
          if (typeof meta.webrtc_rtt_ms === 'number') {
            sessionWebrtcRttLatencies.push(meta.webrtc_rtt_ms);
          }
        }
      });

      const avgSessionTurnLatency = sessionTurnLatencies.length > 0
        ? sessionTurnLatencies.reduce((a, b) => a + b, 0) / sessionTurnLatencies.length
        : 0;

      const avgStt = sessionSttLatencies.length > 0
        ? sessionSttLatencies.reduce((a, b) => a + b, 0) / sessionSttLatencies.length
        : 0;
      const avgLlm = sessionLlmLatencies.length > 0
        ? sessionLlmLatencies.reduce((a, b) => a + b, 0) / sessionLlmLatencies.length
        : 0;
      const avgTts = sessionTtsLatencies.length > 0
        ? sessionTtsLatencies.reduce((a, b) => a + b, 0) / sessionTtsLatencies.length
        : 0;

      const avgHandoff1 = sessionHandoff1Latencies.length > 0
        ? sessionHandoff1Latencies.reduce((a, b) => a + b, 0) / sessionHandoff1Latencies.length
        : 0;
      const avgHandoff2 = sessionHandoff2Latencies.length > 0
        ? sessionHandoff2Latencies.reduce((a, b) => a + b, 0) / sessionHandoff2Latencies.length
        : 0;

      const avgDeepgramWait = sessionDeepgramWaitLatencies.length > 0
        ? sessionDeepgramWaitLatencies.reduce((a, b) => a + b, 0) / sessionDeepgramWaitLatencies.length
        : 0;
      const avgSttCompute = sessionSttComputeLatencies.length > 0
        ? sessionSttComputeLatencies.reduce((a, b) => a + b, 0) / sessionSttComputeLatencies.length
        : 0;
      const avgLlmNetwork = sessionLlmNetworkLatencies.length > 0
        ? sessionLlmNetworkLatencies.reduce((a, b) => a + b, 0) / sessionLlmNetworkLatencies.length
        : 0;
      const avgLlmGen = sessionLlmGenLatencies.length > 0
        ? sessionLlmGenLatencies.reduce((a, b) => a + b, 0) / sessionLlmGenLatencies.length
        : 0;
      const avgTtsNetCompute = sessionTtsNetComputeLatencies.length > 0
        ? sessionTtsNetComputeLatencies.reduce((a, b) => a + b, 0) / sessionTtsNetComputeLatencies.length
        : 0;

      // Filter out nulls before averaging
      const validMsToFfmpeg = sessionMediasoupToFfmpegLatencies.filter((v): v is number => v !== null);
      const avgMsToFfmpeg = validMsToFfmpeg.length > 0
        ? validMsToFfmpeg.reduce((a, b) => a + b, 0) / validMsToFfmpeg.length
        : null;

      const validFfmpegTranscode = sessionFfmpegTranscodeLatencies.filter((v): v is number => v !== null);
      const avgFfmpegTranscode = validFfmpegTranscode.length > 0
        ? validFfmpegTranscode.reduce((a, b) => a + b, 0) / validFfmpegTranscode.length
        : null;

      const avgDgNetCompute = sessionDeepgramNetworkAndComputeLatencies.length > 0
        ? sessionDeepgramNetworkAndComputeLatencies.reduce((a, b) => a + b, 0) / sessionDeepgramNetworkAndComputeLatencies.length
        : 0;

      const avgLocalPipeline = sessionLocalPipelineLatencies.length > 0
        ? sessionLocalPipelineLatencies.reduce((a, b) => a + b, 0) / sessionLocalPipelineLatencies.length
        : 0;

      const avgDeepgramNetworkRtt = sessionDeepgramNetworkRttLatencies.length > 0
        ? sessionDeepgramNetworkRttLatencies.reduce((a, b) => a + b, 0) / sessionDeepgramNetworkRttLatencies.length
        : 0;

      const avgDeepgramProcessing = sessionDeepgramProcessingLatencies.length > 0
        ? sessionDeepgramProcessingLatencies.reduce((a, b) => a + b, 0) / sessionDeepgramProcessingLatencies.length
        : 0;

      const avgInterimTranscriptCount = sessionInterimTranscriptCounts.length > 0
        ? sessionInterimTranscriptCounts.reduce((a, b) => a + b, 0) / sessionInterimTranscriptCounts.length
        : 0;

      const avgWebrtcRtt = sessionWebrtcRttLatencies.length > 0
        ? sessionWebrtcRttLatencies.reduce((a, b) => a + b, 0) / sessionWebrtcRttLatencies.length
        : 0;

      return {
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        status: s.status,
        agentConfigName: s.agentConfigVersion?.agentConfig?.name || 'Unnamed Agent',
        avgTurnLatencyMs: Math.round(avgSessionTurnLatency),
        avgSttLatencyMs: Math.round(avgStt),
        avgLlmLatencyMs: Math.round(avgLlm),
        avgTtsLatencyMs: Math.round(avgTts),
        avgUtteranceEndToFirstTokenMs: Math.round(avgHandoff1),
        avgFirstTokenToFirstAudioMs: Math.round(avgHandoff2),
        avgDeepgramWaitMs: Math.round(avgDeepgramWait),
        avgSttNetworkAndComputeMs: Math.round(avgSttCompute),
        avgLlmNetworkMs: Math.round(avgLlmNetwork),
        avgLlmGenerationMs: Math.round(avgLlmGen),
        avgTtsNetworkAndSynthesisMs: Math.round(avgTtsNetCompute),
        avgMediasoupToFfmpegMs: avgMsToFfmpeg !== null ? Math.round(avgMsToFfmpeg) : null,
        avgFfmpegTranscodeMs: avgFfmpegTranscode !== null ? Math.round(avgFfmpegTranscode) : null,
        avgDeepgramNetworkAndComputeMs: Math.round(avgDgNetCompute),
        avgLocalPipelineMs: Math.round(avgLocalPipeline),
        avgDeepgramNetworkRttMs: Math.round(avgDeepgramNetworkRtt),
        avgDeepgramProcessingMs: Math.round(avgDeepgramProcessing),
        avgInterimTranscriptCount: Math.round(avgInterimTranscriptCount),
        avgWebrtcRttMs: Math.round(avgWebrtcRtt),
        totalTokensUsed: sessionTokens,
        turnsCount: s.messages.length,
        interruptionsCount: sessionInterruptions,
        silenceNudgesCount: sessionSilenceNudges,
        reconnectsCount: sessionReconnects,
        providerErrorsCount: sessionProviderErrors,
        abortedAtTurn,
        abortedElapsedTimeMs
      };
    });

    // Compute averages
    const avgDurationSeconds = durationCount > 0
      ? Math.round((totalDurationMs / durationCount) / 1000)
      : 0;

    const avgTurnsPerSession = totalSessions > 0
      ? Number((totalTurns / totalSessions).toFixed(1))
      : 0;

    const avgInterruptionsPerSession = totalSessions > 0
      ? Number((totalInterruptions / totalSessions).toFixed(2))
      : 0;

    const avgSilenceNudgesPerSession = totalSessions > 0
      ? Number((totalSilenceNudges / totalSessions).toFixed(2))
      : 0;

    const avgReconnectsPerSession = totalSessions > 0
      ? Number((totalReconnects / totalSessions).toFixed(2))
      : 0;

    const avgTokensPerSession = totalSessions > 0
      ? Math.round(totalTokens / totalSessions)
      : 0;

    // Compute latency stats (average and p95)
    const firstTokenAvg = firstTokenLatencies.length > 0
      ? Math.round(firstTokenLatencies.reduce((a, b) => a + b, 0) / firstTokenLatencies.length)
      : 0;
    const firstTokenP95 = Math.round(getPercentile(firstTokenLatencies, 95));

    const firstAudioAvg = firstAudioLatencies.length > 0
      ? Math.round(firstAudioLatencies.reduce((a, b) => a + b, 0) / firstAudioLatencies.length)
      : 0;
    const firstAudioP95 = Math.round(getPercentile(firstAudioLatencies, 95));

    const totalTurnAvg = totalTurnLatencies.length > 0
      ? Math.round(totalTurnLatencies.reduce((a, b) => a + b, 0) / totalTurnLatencies.length)
      : 0;
    const totalTurnP95 = Math.round(getPercentile(totalTurnLatencies, 95));

    // Component latency averages and p95
    const sttAvg = sttLatencies.length > 0
      ? Math.round(sttLatencies.reduce((a, b) => a + b, 0) / sttLatencies.length)
      : 0;
    const sttP95 = Math.round(getPercentile(sttLatencies, 95));

    const llmAvg = llmLatencies.length > 0
      ? Math.round(llmLatencies.reduce((a, b) => a + b, 0) / llmLatencies.length)
      : 0;
    const llmP95 = Math.round(getPercentile(llmLatencies, 95));

    const ttsAvg = ttsLatencies.length > 0
      ? Math.round(ttsLatencies.reduce((a, b) => a + b, 0) / ttsLatencies.length)
      : 0;
    const ttsP95 = Math.round(getPercentile(ttsLatencies, 95));

    const firstTokenCheckAvg = firstTokenCheckLatencies.length > 0
      ? Math.round(firstTokenCheckLatencies.reduce((a, b) => a + b, 0) / firstTokenCheckLatencies.length)
      : 0;
    const firstTokenCheckP95 = Math.round(getPercentile(firstTokenCheckLatencies, 95));

    // Sub-component calculations
    const networkToOpenAiAvg = networkToOpenAiLatencies.length > 0
      ? Math.round(networkToOpenAiLatencies.reduce((a, b) => a + b, 0) / networkToOpenAiLatencies.length)
      : 0;
    const networkToOpenAiP95 = Math.round(getPercentile(networkToOpenAiLatencies, 95));

    const generationAvg = generationLatencies.length > 0
      ? Math.round(generationLatencies.reduce((a, b) => a + b, 0) / generationLatencies.length)
      : 0;
    const generationP95 = Math.round(getPercentile(generationLatencies, 95));

    const networkToDeepgramTtsAvg = networkToDeepgramTtsLatencies.length > 0
      ? Math.round(networkToDeepgramTtsLatencies.reduce((a, b) => a + b, 0) / networkToDeepgramTtsLatencies.length)
      : 0;
    const networkToDeepgramTtsP95 = Math.round(getPercentile(networkToDeepgramTtsLatencies, 95));

    const audioRelayToClientAvg = audioRelayToClientLatencies.length > 0
      ? Math.round(audioRelayToClientLatencies.reduce((a, b) => a + b, 0) / audioRelayToClientLatencies.length)
      : 0;
    const audioRelayToClientP95 = Math.round(getPercentile(audioRelayToClientLatencies, 95));

    const clientBufferToPlaybackAvg = clientBufferToPlaybackLatencies.length > 0
      ? Math.round(clientBufferToPlaybackLatencies.reduce((a, b) => a + b, 0) / clientBufferToPlaybackLatencies.length)
      : 0;
    const clientBufferToPlaybackP95 = Math.round(getPercentile(clientBufferToPlaybackLatencies, 95));

    const deepgramNetworkAndEndpointingAvg = deepgramNetworkAndEndpointingLatencies.length > 0
      ? Math.round(deepgramNetworkAndEndpointingLatencies.reduce((a, b) => a + b, 0) / deepgramNetworkAndEndpointingLatencies.length)
      : 0;
    const deepgramNetworkAndEndpointingP95 = Math.round(getPercentile(deepgramNetworkAndEndpointingLatencies, 95));

    const localPipelineAvg = localPipelineLatencies.length > 0
      ? Math.round(localPipelineLatencies.reduce((a, b) => a + b, 0) / localPipelineLatencies.length)
      : 0;
    const localPipelineP95 = Math.round(getPercentile(localPipelineLatencies, 95));

    const deepgramNetworkRttAvg = deepgramNetworkRttLatencies.length > 0
      ? Math.round(deepgramNetworkRttLatencies.reduce((a, b) => a + b, 0) / deepgramNetworkRttLatencies.length)
      : 0;
    const deepgramNetworkRttP95 = Math.round(getPercentile(deepgramNetworkRttLatencies, 95));

    const deepgramProcessingAvg = deepgramProcessingLatencies.length > 0
      ? Math.round(deepgramProcessingLatencies.reduce((a, b) => a + b, 0) / deepgramProcessingLatencies.length)
      : 0;
    const deepgramProcessingP95 = Math.round(getPercentile(deepgramProcessingLatencies, 95));

    const webrtcRttAvg = webrtcRttLatencies.length > 0
      ? Math.round(webrtcRttLatencies.reduce((a, b) => a + b, 0) / webrtcRttLatencies.length)
      : 0;
    const webrtcRttP95 = Math.round(getPercentile(webrtcRttLatencies, 95));

    const interimTranscriptCountAvg = interimTranscriptCounts.length > 0
      ? Number((interimTranscriptCounts.reduce((a, b) => a + b, 0) / interimTranscriptCounts.length).toFixed(1))
      : 0;

    // Calculate Reliability & Health Metrics
    const totalProviderErrors = openaiErrorCount + deepgramSttErrorCount + deepgramTtsErrorCount;
    const providerErrorRate = totalTurns > 0 
      ? Number((totalProviderErrors / totalTurns).toFixed(4)) 
      : 0;

    const avgAbortedTurn = abortedWithEventCount > 0 
      ? Number((abortedTurnSum / abortedWithEventCount).toFixed(1)) 
      : 0;
    const avgAbortedElapsedTimeSeconds = abortedWithEventCount > 0 
      ? Math.round((abortedElapsedTimeSum / abortedWithEventCount) / 1000) 
      : 0;

    const avgBargeInRate = bargeInRateSessionCount > 0 
      ? Number((totalBargeInRateSum / bargeInRateSessionCount).toFixed(4)) 
      : 0;

    const avgNudgesCompleted = completedSessionsForNudges > 0 
      ? Number((completedNudgesSum / completedSessionsForNudges).toFixed(2)) 
      : 0;
    const avgNudgesAborted = abortedSessionsForNudges > 0 
      ? Number((abortedNudgesSum / abortedSessionsForNudges).toFixed(2)) 
      : 0;

    res.json({
      overview: {
        totalSessions,
        statusBreakdown: {
          completed: completedCount,
          aborted: abortedCount,
          active: activeCount
        },
        avgDurationSeconds,
        avgTurnsPerSession,
        avgInterruptionsPerSession,
        avgSilenceNudgesPerSession,
        avgReconnectsPerSession,
        totalTokens,
        avgTokensPerSession,
        latencies: {
          utteranceEndToFirstToken: {
            avgMs: firstTokenAvg,
            p95Ms: firstTokenP95
          },
          firstTokenToFirstAudio: {
            avgMs: firstAudioAvg,
            p95Ms: firstAudioP95
          },
          totalTurn: {
            avgMs: totalTurnAvg,
            p95Ms: totalTurnP95
          },
          stt: {
            avgMs: sttAvg,
            p95Ms: sttP95
          },
          llm: {
            avgMs: llmAvg,
            p95Ms: llmP95
          },
          tts: {
            avgMs: ttsAvg,
            p95Ms: ttsP95
          },
          firstToken: {
            avgMs: firstTokenCheckAvg,
            p95Ms: firstTokenCheckP95
          },
          webrtcRtt: {
            avgMs: webrtcRttAvg,
            p95Ms: webrtcRttP95
          },
          // Sub-components details
          subComponents: {
            // STT
            micToMediasoup: {
              avgMs: Math.round(webrtcRttAvg / 2),
              p95Ms: Math.round(webrtcRttP95 / 2),
              note: 'Estimated as 1/2 of WebRTC round-trip time (RTT)'
            },
            mediasoupToFfmpeg: { avgMs: null, p95Ms: null, reason: 'skipped_clock_sync_limits' },
            ffmpegTranscode: { avgMs: null, p95Ms: null, reason: 'skipped_clock_sync_limits' },
            deepgramNetworkAndEndpointing: {
              avgMs: deepgramNetworkAndEndpointingAvg,
              p95Ms: deepgramNetworkAndEndpointingP95,
              note: 'includes 1000ms configured utterance_end_ms silence wait'
            },
            localPipeline: {
              avgMs: localPipelineAvg,
              p95Ms: localPipelineP95
            },
            deepgramNetworkRtt: {
              avgMs: deepgramNetworkRttAvg,
              p95Ms: deepgramNetworkRttP95
            },
            deepgramProcessing: {
              avgMs: deepgramProcessingAvg,
              p95Ms: deepgramProcessingP95
            },
            interimTranscriptCount: {
              avg: interimTranscriptCountAvg
            },
            // LLM
            networkToOpenAi: {
              avgMs: networkToOpenAiAvg,
              p95Ms: networkToOpenAiP95
            },
            generation: {
              avgMs: generationAvg,
              p95Ms: generationP95
            },
            // TTS
            networkToDeepgramTts: {
              avgMs: networkToDeepgramTtsAvg,
              p95Ms: networkToDeepgramTtsP95
            },
            audioRelayToClient: {
              avgMs: audioRelayToClientAvg,
              p95Ms: audioRelayToClientP95
            },
            clientBufferToPlayback: {
              avgMs: clientBufferToPlaybackAvg,
              p95Ms: clientBufferToPlaybackP95
            },
            ttsToSpeakerNetworkTransit: {
              avgMs: Math.round(webrtcRttAvg / 2),
              p95Ms: Math.round(webrtcRttP95 / 2),
              note: 'Estimated as 1/2 of WebRTC round-trip time (RTT)'
            }
          }
        },
        reliability: {
          providerErrorRate,
          openaiErrorCount,
          deepgramSttErrorCount,
          deepgramTtsErrorCount,
          playbackErrorCount,
          avgAbortedTurn,
          avgAbortedElapsedTimeSeconds,
          avgBargeInRate,
          nudgeComparison: {
            completed: avgNudgesCompleted,
            aborted: avgNudgesAborted
          }
        }
      },
      sessions: formattedSessions,
      configs: availableConfigs
    });
  } catch (error) {
    next(error);
  }
});

export default router;
