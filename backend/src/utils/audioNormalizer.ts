const BIAS = 0x84;
const CLIP = 32635;

export function linear16ToMuLaw(pcmSample: number): number {
  let sign = 0;
  if (pcmSample < 0) {
    pcmSample = -pcmSample;
    sign = 0x80;
  }
  if (pcmSample > CLIP) pcmSample = CLIP;
  pcmSample += BIAS;

  let exponent = 7;
  for (let mask = 0x4000; (pcmSample & mask) === 0; mask >>= 1) {
    exponent--;
  }

  const mantissa = (pcmSample >> (exponent + 3)) & 0x0f;
  const uval = ~(sign | (exponent << 4) | mantissa);
  return uval & 0xff;
}

export function muLawToLinear16(uval: number): number {
  uval = ~uval;
  const sign = uval & 0x80;
  const exponent = (uval >> 4) & 0x07;
  const mantissa = uval & 0x0f;
  let sample = (mantissa << 3) + BIAS;
  sample <<= exponent;
  sample -= BIAS;
  return sign ? -sample : sample;
}

/**
 * Normalizes 16kHz 16-bit mono PCM audio (used by Voice Engine)
 * to 8kHz 8-bit mono PCMU (mu-law) audio (expected by telephony).
 */
export function pcm16ToMuLawBuffer(pcmBuffer: Buffer): Buffer {
  const numInputSamples = pcmBuffer.length / 2;
  const numOutputSamples = Math.floor(numInputSamples / 2);
  const outBuffer = Buffer.alloc(numOutputSamples);

  for (let i = 0; i < numOutputSamples; i++) {
    // Grab every second sample to downsample 16kHz -> 8kHz
    const pcmSample = pcmBuffer.readInt16LE(i * 4);
    outBuffer[i] = linear16ToMuLaw(pcmSample);
  }

  return outBuffer;
}

/**
 * Normalizes 8kHz 8-bit mono PCMU (mu-law) audio (received from telephony)
 * to 16kHz 16-bit mono PCM audio (expected by Voice Engine / STT).
 */
export function muLawToPcm16Buffer(muLawBuffer: Buffer): Buffer {
  const numInputSamples = muLawBuffer.length;
  const numOutputSamples = numInputSamples * 2;
  const outBuffer = Buffer.alloc(numOutputSamples * 2);

  for (let i = 0; i < numInputSamples; i++) {
    const muLawSample = muLawBuffer[i];
    const pcmSample = muLawToLinear16(muLawSample);

    // Duplicate each sample to upsample 8kHz -> 16kHz
    outBuffer.writeInt16LE(pcmSample, i * 4);
    outBuffer.writeInt16LE(pcmSample, i * 4 + 2);
  }

  return outBuffer;
}
