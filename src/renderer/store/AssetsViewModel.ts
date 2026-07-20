/**
 * Assets 管理 ViewModel
 */
import { ApiClient } from '../services/ApiClient';
import { ViewModelBase } from './ViewModelBase';
import type { AssetItem, AssetType } from '@shared/types';

export class AssetsViewModel extends ViewModelBase {
  assets: AssetItem[] = [];
  filter: AssetType | 'all' = 'all';
  message = '';
  loading = false;
  dragOver = false;

  async load(): Promise<void> {
    this.loading = true;
    this.notify();
    try {
      this.assets =
        this.filter === 'all'
          ? await ApiClient.listAssets()
          : await ApiClient.listAssets(this.filter);
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  setFilter(filter: AssetType | 'all'): void {
    this.filter = filter;
    void this.load();
  }

  setDragOver(value: boolean): void {
    this.dragOver = value;
    this.notify();
  }

  async importViaDialog(type?: AssetType): Promise<void> {
    await ApiClient.importAssets(undefined, type);
    this.message = 'インポートしました';
    await this.load();
  }

  /**
   * ドロップされたファイルパスをインポート
   * Electron では file.path が利用可能
   */
  async importDropped(files: FileList | File[]): Promise<void> {
    const paths: string[] = [];
    for (const file of Array.from(files)) {
      const withPath = file as File & { path?: string };
      if (withPath.path) paths.push(withPath.path);
    }
    if (paths.length === 0) {
      this.message = 'ファイルパスを取得できませんでした。ボタンからインポートしてください。';
      this.notify();
      return;
    }
    const type = this.filter === 'all' ? undefined : this.filter;
    await ApiClient.importAssets(paths, type);
    this.message = `${paths.length} 件をインポートしました`;
    await this.load();
  }

  async remove(id: string): Promise<void> {
    await ApiClient.deleteAsset(id);
    await this.load();
  }

  async openFolder(): Promise<void> {
    await ApiClient.openAssetsFolder();
  }
}
