/**
 * ビルドサービス
 * Windows / Android ビルドコマンドをプロジェクトで実行する。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { BuildResult } from '../../shared/types';
import type { LogService } from './LogService';
import type { SettingsService } from './SettingsService';

export class BuildService {
  constructor(
    private readonly settings: SettingsService,
    private readonly log: LogService,
  ) {}

  async buildWindows(projectPath: string): Promise<BuildResult> {
    return this.runBuild(projectPath, 'windows', [
      { cmd: 'npm', args: ['run', 'electron:build'] },
      { cmd: 'npm', args: ['run', 'build:win'] },
      { cmd: 'npm', args: ['run', 'build'] },
    ]);
  }

  async buildAndroid(projectPath: string): Promise<BuildResult> {
    const sdk = this.settings.get().androidSdkPath;
    const env = { ...process.env };
    if (sdk) {
      env.ANDROID_HOME = sdk;
      env.ANDROID_SDK_ROOT = sdk;
    }

    const gradlew = path.join(projectPath, 'gradlew.bat');
    const candidates: Array<{ cmd: string; args: string[] }> = [];

    if (fs.existsSync(gradlew)) {
      candidates.push({ cmd: gradlew, args: ['assembleRelease'] });
    }
    candidates.push(
      { cmd: 'npm', args: ['run', 'build:android'] },
      { cmd: 'npx', args: ['cap', 'build', 'android'] },
    );

    return this.runBuild(projectPath, 'android', candidates, env);
  }

  private async runBuild(
    projectPath: string,
    label: string,
    candidates: Array<{ cmd: string; args: string[] }>,
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<BuildResult> {
    if (!fs.existsSync(projectPath)) {
      return { success: false, message: 'プロジェクトパスが存在しません', log: '' };
    }

    let lastLog = '';
    for (const candidate of candidates) {
      this.log.info('build', `${label} ビルド試行: ${candidate.cmd} ${candidate.args.join(' ')}`);
      const result = await this.spawnCapture(candidate.cmd, candidate.args, projectPath, env);
      lastLog = result.log;
      if (result.success) {
        this.log.info('build', `${label} ビルド成功`);
        return {
          success: true,
          message: `${label} ビルドが完了しました`,
          log: result.log,
        };
      }
    }

    this.log.error('build', `${label} ビルド失敗`, lastLog.slice(-2000));
    return {
      success: false,
      message: `${label} ビルドに失敗しました。プロジェクトのビルドスクリプトを確認してください。`,
      log: lastLog,
    };
  }

  private spawnCapture(
    command: string,
    args: string[],
    cwd: string,
    env: NodeJS.ProcessEnv,
  ): Promise<{ success: boolean; log: string }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd,
        env,
        shell: true,
        windowsHide: true,
      });

      let log = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        log += chunk.toString();
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        log += chunk.toString();
      });
      child.on('error', (error) => {
        resolve({ success: false, log: `${log}\n${error.message}` });
      });
      child.on('close', (code) => {
        resolve({ success: code === 0, log });
      });
    });
  }
}
