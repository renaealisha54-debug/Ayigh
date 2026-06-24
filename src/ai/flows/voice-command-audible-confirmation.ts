'use server';
/**
 * @fileOverview This flow generates audible feedback or confirmation for spoken commands using Text-to-Speech.
 *
 * - voiceCommandAudibleConfirmation - A function that converts text to speech.
 * - VoiceCommandAudibleConfirmationInput - The input type for the voiceCommandAudibleConfirmation function.
 * - VoiceCommandAudibleConfirmationOutput - The return type for the voiceCommandAudibleConfirmation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import wav from 'wav';
import { Buffer } from 'buffer';

const VoiceCommandAudibleConfirmationInputSchema = z
  .string()
  .describe('The text message to be converted to speech.');
export type VoiceCommandAudibleConfirmationInput = z.infer<
  typeof VoiceCommandAudibleConfirmationInputSchema
>;

const VoiceCommandAudibleConfirmationOutputSchema = z.object({
  media: z.string().describe('The base64 encoded WAV audio data as a data URI.'),
});
export type VoiceCommandAudibleConfirmationOutput = z.infer<
  typeof VoiceCommandAudibleConfirmationOutputSchema
>;

/**
 * Converts PCM audio data to WAV format.
 * @param pcmData The PCM audio data buffer.
 * @param channels Number of audio channels.
 * @param rate Sample rate in Hz.
 * @param sampleWidth Sample width in bytes.
 * @returns A Promise that resolves with the base64 encoded WAV string.
 */
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

export async function voiceCommandAudibleConfirmation(
  input: VoiceCommandAudibleConfirmationInput
): Promise<VoiceCommandAudibleConfirmationOutput> {
  return voiceCommandAudibleConfirmationFlow(input);
}

const voiceCommandAudibleConfirmationFlow = ai.defineFlow(
  {
    name: 'voiceCommandAudibleConfirmationFlow',
    inputSchema: VoiceCommandAudibleConfirmationInputSchema,
    outputSchema: VoiceCommandAudibleConfirmationOutputSchema,
  },
  async (input) => {
    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-preview-tts'),
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Algenib' },
          },
        },
      },
      prompt: input,
    });

    if (!media) {
      throw new Error('No audio media returned from TTS model.');
    }

    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );

    const wavBase64 = await toWav(audioBuffer);

    return {
      media: 'data:audio/wav;base64,' + wavBase64,
    };
  }
);
