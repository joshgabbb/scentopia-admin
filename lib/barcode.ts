/**
 * Pure SVG EAN-13 barcode generator — no external dependencies.
 * Used by the web admin to render printable barcodes from stored barcode values.
 */

const L_CODES = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
];
const G_CODES = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
];
const R_CODES = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
];

/** L/G pattern for left 6 digits determined by the first (system) digit */
const FIRST_DIGIT_PATTERNS = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
];

/**
 * Returns an inline SVG string rendering an EAN-13 barcode.
 * @param barcode  13-digit string (non-numeric chars are stripped)
 * @param opts     Visual options
 */
export function generateEAN13SVG(
  barcode: string,
  opts: { moduleWidth?: number; height?: number; fontSize?: number } = {}
): string {
  const { moduleWidth = 2, height = 80, fontSize = 11 } = opts;

  // Normalize: keep only digits, pad/truncate to 13
  const digits = barcode.replace(/\D/g, '').slice(0, 13).padStart(13, '0');

  const firstDigit = parseInt(digits[0], 10);
  const pattern = FIRST_DIGIT_PATTERNS[firstDigit] ?? 'LLLLLL';

  // Build binary string
  let binary = '101'; // start guard

  for (let i = 1; i <= 6; i++) {
    const d = parseInt(digits[i], 10);
    binary += pattern[i - 1] === 'L' ? L_CODES[d] : G_CODES[d];
  }

  binary += '01010'; // centre guard

  for (let i = 7; i <= 12; i++) {
    const d = parseInt(digits[i], 10);
    binary += R_CODES[d];
  }

  binary += '101'; // end guard

  const totalWidth = binary.length * moduleWidth;
  const textHeight = fontSize + 4;
  const svgHeight = height + textHeight;

  // Build SVG rect elements for black bars
  let bars = '';
  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === '1') {
      const x = i * moduleWidth;
      bars += `<rect x="${x}" y="0" width="${moduleWidth}" height="${height}" fill="#000"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${svgHeight}" viewBox="0 0 ${totalWidth} ${svgHeight}">
  <rect width="${totalWidth}" height="${svgHeight}" fill="#fff"/>
  ${bars}
  <text x="${totalWidth / 2}" y="${svgHeight - 1}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="#000">${digits}</text>
</svg>`;
}

/** Returns a data-URI that can be used as <img src=…> */
export function generateEAN13DataURI(barcode: string): string {
  const svg = generateEAN13SVG(barcode);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
