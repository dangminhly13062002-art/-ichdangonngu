/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";
import { SubtitleBlock, TranslationOptions, DictionaryEntry } from "../types";

const MODEL_NAME = "gemini-3-flash-preview";

export async function translateBlocks(
  blocks: SubtitleBlock[],
  sourceLang: string,
  targetLang: string,
  options: TranslationOptions,
  dictionary: DictionaryEntry[],
  onProgress: (progress: number) => void
): Promise<SubtitleBlock[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const batchSize = 30; // Number of blocks per request
  const translatedBlocks = [...blocks];

  const dictionaryPrompt = dictionary.length > 0 
    ? `\nUse the following specific translations for these terms:\n${dictionary.map(d => `- "${d.original}" -> "${d.replacement}"`).join('\n')}`
    : '';

  const optionsPrompt = `
    - Keep names: ${options.keepNames}
    - Localize character names: ${options.localizeNames}
    - Keep technical terminology: ${options.keepTerminology}
    - Soften sensitive words: ${options.softenSensitive}
    - Maintain line count per block: ${options.maintainLineCount}
    - Style: ${options.style}
  `;

  for (let i = 0; i < blocks.length; i += batchSize) {
    const batch = blocks.slice(i, i + batchSize);
    const prompt = `
      Translate the following subtitle blocks from ${sourceLang === 'auto' ? 'the source language' : sourceLang} to ${targetLang}.
      
      Rules:
      1. Return ONLY a JSON array of strings, where each string corresponds to the translated text of the block at the same index.
      2. Maintain the exact same number of items in the array as the input blocks.
      3. Preserve line breaks within each block if possible.
      4. Do not translate timestamps or IDs.
      ${optionsPrompt}
      ${dictionaryPrompt}

      Input blocks:
      ${batch.map((b, idx) => `Block ${idx}: ${b.text}`).join('\n\n')}
    `;

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const results = JSON.parse(response.text || "[]");
      
      for (let j = 0; j < batch.length; j++) {
        if (results[j]) {
          translatedBlocks[i + j].translatedText = results[j];
        } else {
          translatedBlocks[i + j].translatedText = batch[j].text; // Fallback to original
        }
      }
    } catch (error) {
      console.error("Translation error for batch starting at index", i, error);
      // Fallback for the whole batch
      for (let j = 0; j < batch.length; j++) {
        translatedBlocks[i + j].translatedText = batch[j].text;
      }
    }

    onProgress(Math.min(100, Math.round(((i + batchSize) / blocks.length) * 100)));
  }

  return translatedBlocks;
}
