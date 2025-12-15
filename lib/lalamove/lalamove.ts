import crypto from "crypto";

export function generateSignature(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string
): string {
  // Construct the raw string exactly as required
  // timestamp + \r\n + method + \r\n + path + \r\n\r\n + body
  const raw = `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`;
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}
