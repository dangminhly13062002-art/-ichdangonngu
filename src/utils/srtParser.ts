/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SubtitleBlock } from '../types';

export function parseSRT(content: string): SubtitleBlock[] {
  const blocks: SubtitleBlock[] = [];
  // Normalize line endings and split by double newline (or more)
  const rawBlocks = content.trim().split(/\r?\n\r?\n/);

  for (const rawBlock of rawBlocks) {
    const lines = rawBlock.split(/\r?\n/);
    if (lines.length >= 3) {
      const idStr = lines[0].trim();
      const timeRange = lines[1].trim();
      const text = lines.slice(2).join('\n');

      const id = parseInt(idStr, 10);
      const timeMatch = timeRange.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);

      if (!isNaN(id) && timeMatch) {
        blocks.push({
          id,
          startTime: timeMatch[1],
          endTime: timeMatch[2],
          text,
        });
      }
    }
  }

  return blocks;
}

export function stringifySRT(blocks: SubtitleBlock[], useTranslation: boolean = false): string {
  return blocks
    .map((block) => {
      const content = useTranslation ? (block.translatedText || block.text) : block.text;
      return `${block.id}\n${block.startTime} --> ${block.endTime}\n${content}`;
    })
    .join('\n\n');
}

export function validateSRT(content: string): boolean {
  // Simple validation: check if it has at least one block with the expected pattern
  const srtPattern = /\d+\r?\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/;
  return srtPattern.test(content);
}
