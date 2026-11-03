import { en } from "./resources/en";

export function commandErrorSource(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const details = "message" in error && typeof error.message === "string" ? error.message : String(error.code);
  switch (error.code) {
    case "db_error": return en.dbErrorDetails.replace("{{details}}", details);
    case "decode_error": return en.decodeErrorDetails.replace("{{details}}", details);
    case "io_error": return en.ioErrorDetails.replace("{{details}}", details);
    case "processed_wav_error": return en.processedErrorDetails.replace("{{details}}", details);
    default: return null;
  }
}
