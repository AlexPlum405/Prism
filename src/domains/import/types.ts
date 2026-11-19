/** 导入过程中产生的附属文件（图片等），最终写到 Markdown 同级的 assets/ 目录 */
export interface ImportAsset {
  fileName: string;
  bytes: Uint8Array;
}

export interface ImportConversionResult {
  assets: ImportAsset[];
  /** 内容被丢弃的图片数量，用来提示用户去核对 */
  droppedImageCount?: number;
  markdown: string;
  warnings: string[];
}
