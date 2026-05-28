import {
  captureCurrentWebviewPdfNative,
  getPdfCaptureCapabilityNative,
  type CaptureCurrentWebviewPdfInputDto,
  type PdfCaptureCapabilityDto,
} from '../../../platform/tauri/pdfCapture';
import { isNativeCommandUnavailableError } from '../../../platform/tauri/result';

export type PdfCaptureCapability = PdfCaptureCapabilityDto;
export type CaptureCurrentWebviewPdfInput = CaptureCurrentWebviewPdfInputDto;

const FALLBACK_CAPABILITY: PdfCaptureCapability = {
  supported: true,
  engine: 'legacy_capture_command',
  reason: null,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isPdfCaptureCapability(value: unknown): value is PdfCaptureCapability {
  return Boolean(
    isObject(value)
    && typeof value.supported === 'boolean'
    && typeof value.engine === 'string'
    && (typeof value.reason === 'string' || value.reason === null || value.reason === undefined),
  );
}

export async function getPdfCaptureCapability(): Promise<PdfCaptureCapability> {
  try {
    const capability = await getPdfCaptureCapabilityNative();
    return isPdfCaptureCapability(capability) ? capability : FALLBACK_CAPABILITY;
  } catch (error) {
    if (isNativeCommandUnavailableError(error)) return FALLBACK_CAPABILITY;
    throw error;
  }
}

export function captureCurrentWebviewPdf(input: CaptureCurrentWebviewPdfInput): Promise<void> {
  return captureCurrentWebviewPdfNative(input);
}
