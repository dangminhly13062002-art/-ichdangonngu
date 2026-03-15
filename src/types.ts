/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SubtitleBlock {
  id: number;
  startTime: string;
  endTime: string;
  text: string;
  translatedText?: string;
}

export interface TranslationOptions {
  keepNames: boolean;
  localizeNames: boolean;
  keepTerminology: boolean;
  softenSensitive: boolean;
  maintainLineCount: boolean;
  noMerge: boolean;
  noSplit: boolean;
  style: 'modern' | 'formal' | 'natural';
}

export interface DictionaryEntry {
  original: string;
  replacement: string;
}

export interface TranslationHistory {
  id: string;
  fileName: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  blocks: SubtitleBlock[];
}
