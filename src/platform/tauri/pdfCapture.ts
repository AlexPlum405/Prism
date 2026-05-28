import { invokeNativeCommand } from './nativeCommands';

export interface PdfCaptureCapabilityDto {
  supported: boolean;
  engine: string;
  reason?: string | null;
}

export interface CaptureCurrentWebviewPdfInputDto {
  outputPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getPdfCaptureCapabilityNative() {
  return invokeNativeCommand<unknown>('get_pdf_capture_capability');
}

export function captureCurrentWebviewPdfNative(input: CaptureCurrentWebviewPdfInputDto) {
  return invokeNativeCommand<void>('capture_current_webview_pdf', { ...input });
}
