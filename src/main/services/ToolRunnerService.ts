/**
 * npm script 実行サービス（創作パイプライン用）
 */
import { spawn } from 'node:child_process';
import type { ScriptRunResult } from '../../shared/types';
import type { LogService } from './LogService';

export class ToolRunnerService {
  constructor(private readonly log: LogService) {}

  runNpmScript(cwd: string, script: string): Promise<ScriptRunResult> {
    this.log.info('pipeline', `npm run ${script}`, cwd);
    return new Promise((resolve) => {
      const child = spawn('npm', ['run', script], {
        cwd,
        shell: true,
        windowsHide: true,
        env: process.env,
      });

      let log = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        log += chunk.toString();
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        log += chunk.toString();
      });
      child.on('error', (error) => {
        const message = error.message;
        this.log.error('pipeline', `失敗: ${script}`, message);
        resolve({ success: false, script, message, log: `${log}\n${message}` });
      });
      child.on('close', (code) => {
        const success = code === 0;
        const message = success ? `${script} 完了` : `${script} 失敗 (code=${code})`;
        if (success) this.log.info('pipeline', message);
        else this.log.error('pipeline', message, log.slice(-1500));
        resolve({ success, script, message, log });
      });
    });
  }
}
