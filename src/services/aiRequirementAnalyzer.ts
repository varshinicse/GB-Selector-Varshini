import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';

interface AsyncIterableStream {
  [Symbol.asyncIterator](): AsyncGenerator<unknown, void, unknown>;
}

// Polyfill for ReadableStream.prototype[Symbol.asyncIterator] to support Safari browser PDF stream parsing
if (typeof ReadableStream !== 'undefined' && !(ReadableStream.prototype as unknown as AsyncIterableStream)[Symbol.asyncIterator]) {
  (ReadableStream.prototype as unknown as AsyncIterableStream)[Symbol.asyncIterator] = async function*() {
    const reader = (this as unknown as ReadableStream).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}

// Configure the pdfjs worker using standard Vite asset importing from pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Extracts plain text from TXT, PDF, or DOCX files client-side.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

  switch (fileExt) {
    case '.txt':
      return readTxtFile(file);
    case '.pdf':
      return readPdfFile(file);
    case '.docx':
      return readDocxFile(file);
    default:
      throw new Error(`Unsupported file format: ${fileExt}`);
  }
}

function readTxtFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = () => reject(new Error("Failed to read text file."));
    reader.readAsText(file);
  });
}

async function readPdfFile(file: File): Promise<string> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err) {
    console.error("Failed to read PDF file into ArrayBuffer:", err);
    throw new Error(`Failed to read PDF file: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }

  try {
    // Load the PDF document using Vite-compatible worker and ArrayBuffer data
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let extractedText = "";
    
    // Extract text page by page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: unknown) => (item as { str: string }).str)
        .join(" ");
      extractedText += pageText + "\n";
    }
    
    if (extractedText.trim()) {
      return extractedText;
    }
    
    // If standard text extraction yields nothing, trigger fallback
    console.warn("Standard PDF text extraction yielded empty string. Attempting binary text extraction fallback...");
    const fallbackText = extractStringsFallback(arrayBuffer);
    if (fallbackText.trim()) {
      return fallbackText;
    }
    
    throw new Error("No text content could be extracted from this PDF using standard or fallback parsers.");
  } catch (error) {
    // Detailed error logging for PDF parsing failures (Display exact parsing errors in the browser console)
    console.error("PDF parsing failure detailed logs:", error);
    
    // Attempt fallback parsing on error as well
    try {
      console.warn("Attempting binary text extraction fallback due to PDF parsing error...");
      const fallbackText = extractStringsFallback(arrayBuffer);
      if (fallbackText.trim()) {
        return fallbackText;
      }
    } catch (fallbackError) {
      console.error("PDF fallback parsing also failed:", fallbackError);
    }
    
    throw new Error(`PDF Parsing failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

/**
 * Simple client-side fallback that extracts raw ASCII/UTF-8 string sequences from the PDF binary.
 * This recovers raw text streams from some unencrypted text-based PDFs when pdfjs fails.
 */
function extractStringsFallback(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let text = "";
  let currentString = "";
  
  for (let i = 0; i < bytes.length; i++) {
    const charCode = bytes[i];
    // Visible ASCII characters and common whitespace (space, tab, carriage return, newline)
    if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13 || charCode === 9) {
      currentString += String.fromCharCode(charCode);
    } else {
      if (currentString.length > 4) {
        text += currentString + "\n";
      }
      currentString = "";
    }
  }
  if (currentString.length > 4) {
    text += currentString + "\n";
  }
  
  // Clean up PDF structural markers to leave mostly raw text streams
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => {
      return (
        line.length > 0 &&
        !line.startsWith("%") &&
        !line.startsWith("/") &&
        !line.includes("/Type") &&
        !line.includes("/Length") &&
        !line.includes("obj") &&
        !line.includes("endobj") &&
        !line.includes("stream") &&
        !line.includes("endstream") &&
        !/^[0-9]+ [0-9]+ R$/.test(line)
      );
    })
    .join(" ");
}

function readDocxFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        resolve(result.value);
      } catch (error) {
        console.error("DOCX Parsing error:", error);
        reject(new Error("Failed to parse DOCX document."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read DOCX file."));
    reader.readAsArrayBuffer(file);
  });
}
