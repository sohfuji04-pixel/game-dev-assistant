/**
 * プロンプトローダ（外部 Markdown）
 * - 開発時: src 上の .md を優先読込（編集即反映）
 * - 本番: Vite がインラインした文字列を使用
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import embeddedSystem from './system.md?raw';
import embeddedReview from './review.md?raw';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function tryReadFromDisk(fileName: string): string | null {
  const candidates = [
    path.join(__dirname, fileName),
    path.join(process.cwd(), 'src', 'main', 'ai', 'prompts', 'uiCreateAi', fileName),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const text = fs.readFileSync(p, 'utf8').trim();
        if (text) return text;
      }
    } catch {
      // continue
    }
  }
  return null;
}

let cachedSystem: string | null = null;
let cachedReview: string | null = null;

export function loadUiCreateSystemPrompt(): string {
  if (!cachedSystem) {
    cachedSystem = tryReadFromDisk('system.md') ?? String(embeddedSystem).trim();
  }
  return cachedSystem;
}

export function loadUiCreateReviewPrompt(): string {
  if (!cachedReview) {
    cachedReview = tryReadFromDisk('review.md') ?? String(embeddedReview).trim();
  }
  return cachedReview;
}

export function clearUiCreatePromptCache(): void {
  cachedSystem = null;
  cachedReview = null;
}
