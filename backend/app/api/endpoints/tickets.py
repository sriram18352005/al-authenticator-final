from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import re
import os
import tempfile
import numpy as np
from paddleocr import PaddleOCR
from PIL import Image
import fitz # PyMuPDF
import io

router = APIRouter()

# Initialize PaddleOCR
# This might take time on first run
ocr_engine = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

class DuplicatePair(BaseModel):
    file1: str
    file2: str
    similarity: float

class FileAnalysis(BaseModel):
    filename: str
    detected_type: str
    confidence: float
    summary: str
    full_text: str

class InvoiceAmountCheck(BaseModel):
    check: str
    expected: float
    found: float
    difference: float
    message: str
    passed: bool

class InvoiceValidationResult(BaseModel):
    present: bool           # Was an invoice file found?
    valid: bool             # Did all checks pass?
    message: str
    subtotal: float
    gst_percentage: float
    gst_amount: float
    total: float
    errors: List[InvoiceAmountCheck]

class FolderAnalysisResponse(BaseModel):
    analysis: List[FileAnalysis]
    duplicates: List[DuplicatePair]
    invoice_validation: Optional[InvoiceValidationResult] = None

def calculate_similarity(text1: str, text2: str) -> float:
    if not text1 or not text2:
        return 0.0
    
    # Normalize and extract significant words (3+ chars)
    words1 = set(w for w in re.findall(r'\b\w{3,}\b', text1.lower()) if not w.isdigit())
    words2 = set(w for w in re.findall(r'\b\w{3,}\b', text2.lower()) if not w.isdigit())
    
    if not words1 or not words2:
        return 0.0
        
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    return len(intersection) / len(union) if union else 0.0

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

try:
    from pypdf import PdfReader
    PYPDF_AVAILABLE = True
except ImportError:
    PYPDF_AVAILABLE = False

try:
    from pdfminer.high_level import extract_text as pdfminer_extract
    PDFMINER_AVAILABLE = True
except ImportError:
    PDFMINER_AVAILABLE = False

print(f"PDF libs: pdfplumber={PDFPLUMBER_AVAILABLE}, pypdf={PYPDF_AVAILABLE}, pdfminer={PDFMINER_AVAILABLE}")

def extract_text_from_file(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    text = ""

    if ext == '.pdf':
        # METHOD 1 — pdfplumber (best for text-based PDFs)
        if PDFPLUMBER_AVAILABLE:
            try:
                with pdfplumber.open(file_path) as pdf:
                    all_text = []
                    for page in pdf.pages:
                        t = page.extract_text()
                        if t and t.strip():
                            all_text.append(t.strip())
                    text = "\n".join(all_text)
                    if text.strip():
                        print(f"pdfplumber extracted {len(text)} chars from {os.path.basename(file_path)}")
                        return text.strip()
            except Exception as e:
                print(f"pdfplumber error on {os.path.basename(file_path)}: {e}")

        # METHOD 2 — pypdf fallback
        if PYPDF_AVAILABLE:
            try:
                reader = PdfReader(file_path)
                all_text = []
                for page in reader.pages:
                    t = page.extract_text()
                    if t and t.strip():
                        all_text.append(t.strip())
                text = "\n".join(all_text)
                if text.strip():
                    print(f"pypdf extracted {len(text)} chars from {os.path.basename(file_path)}")
                    return text.strip()
            except Exception as e:
                print(f"pypdf error on {os.path.basename(file_path)}: {e}")

        # METHOD 3 — pdfminer fallback
        if PDFMINER_AVAILABLE:
            try:
                extracted = pdfminer_extract(file_path)
                if extracted and extracted.strip():
                    print(f"pdfminer extracted {len(extracted)} chars from {os.path.basename(file_path)}")
                    return extracted.strip()
            except Exception as e:
                print(f"pdfminer error on {os.path.basename(file_path)}: {e}")

        # METHOD 4 — PaddleOCR for image-based PDFs only
        try:
            print(f"Trying PaddleOCR (image-based PDF) for {os.path.basename(file_path)}...")
            doc = fitz.open(file_path)
            all_text = []
            for page in doc:
                pix = page.get_pixmap()
                img_data = pix.tobytes("png")
                img = Image.open(io.BytesIO(img_data))
                result = ocr_engine.ocr(np.array(img), cls=True)
                if result and result[0]:
                    lines = [line[1][0] for line in result[0] if line and len(line) > 1 and line[1]]
                    all_text.append(" ".join(lines))
            doc.close()
            if all_text:
                return " ".join(all_text).strip()
        except Exception as e:
            print(f"PaddleOCR PDF error: {e}")

        print(f"All PDF extraction methods failed for {os.path.basename(file_path)}")
        return ""

    elif ext in ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp']:
        # PaddleOCR for image files
        try:
            result = ocr_engine.ocr(file_path, cls=True)
            if result and result[0]:
                lines = []
                for line in result[0]:
                    if line and len(line) > 1 and line[1]:
                        lines.append(line[1][0])
                text = "\n".join(lines)
                return text.strip()
        except Exception as e:
            print(f"PaddleOCR image error: {e}")
        return ""

    return ""

def classify_content(text: str, filename: str) -> str:
    text_upper = text.upper()
    # Use only the base filename for keyword matching (strip folder prefix)
    fn = os.path.basename(filename).lower()

    # --- PHASE 1: STRICT FILENAME PRIORITY (most reliable) ---
    if any(k in fn for k in ["reject", "rejection"]):
        return "rejection"
    if any(k in fn for k in ["estimat", "estimation"]):
        return "estimate"
    if any(k in fn for k in ["invest", "investigation", "inves"]):
        return "investigation"
    if any(k in fn for k in ["invoice", "bill", "billing"]):
        return "invoice"

    # --- PHASE 2: PHRASE-BASED CONTENT DETECTION ---

    # 1. REJECTION (highest priority)
    rejection_phrases = [
        "WARRANTY REJECTION", "REJECTION REPORT", "REJ-",
        "CLAIM REJECTED", "WARRANTY CLAIM REJECTED",
        "REASONS FOR REJECTION", "FINAL DECISION", "APPEAL PROCESS"
    ]
    if any(p in text_upper for p in rejection_phrases):
        return "rejection"

    # 2. ESTIMATION
    estimation_phrases = [
        "ESTIMATION REPORT", "SERVICE ESTIMATION", "EST-",
        "GRAND TOTAL ESTIMATE", "PRE-APPROVAL COST", "COST ESTIMATE",
        "ESTIMATED COST"
    ]
    if any(p in text_upper for p in estimation_phrases):
        return "estimate"
    if "PARTS COST" in text_upper and "LABOUR COST" in text_upper:
        return "estimate"

    # 3. INVESTIGATION
    investigation_phrases = [
        "INVESTIGATION REPORT", "VEHICLE INVESTIGATION",
        "INVESTIGATION COMPLETE", "INVESTIGATION FINDINGS",
        "INVESTIGATION VERDICT", "COMPLAINT INVESTIGATION",
        "FIELD INSPECTION", "TECHNICAL INSPECTION"
    ]
    if any(p in text_upper for p in investigation_phrases):
        return "investigation"

    # 4. INVOICE
    invoice_phrases = [
        "SERVICE INVOICE", "TAX INVOICE", "INVOICE NO",
        "PAYMENT STATUS", "AMOUNT PAID", "PAYMENT RECEIVED"
    ]
    if any(p in text_upper for p in invoice_phrases):
        return "invoice"
    if "GST" in text_upper and "PAID" in text_upper:
        return "invoice"

    # 5. IMAGE (extension check only)
    if any(fn.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp", ".tiff", ".bmp"]):
        return "image"

    return "other"

def extract_amounts_from_invoice(text: str) -> dict:
    """Extract numeric amounts from invoice text using regex."""
    amounts: dict = {}

    # Sub Total
    m = re.search(r'sub\s*total[:\s]+(?:rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)', text, re.IGNORECASE)
    if m:
        amounts['subtotal'] = float(m.group(1).replace(',', ''))

    # GST percentage
    m = re.search(r'gst\s*@\s*(\d+(?:\.\d+)?)\s*%', text, re.IGNORECASE)
    if m:
        amounts['gst_percentage'] = float(m.group(1))

    # GST amount — look for the value right after the GST percentage pattern
    m = re.search(r'gst\s*@\s*\d+(?:\.\d+)?\s*%[:\s]+(?:rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)', text, re.IGNORECASE)
    if m:
        amounts['gst_amount'] = float(m.group(1).replace(',', ''))
    else:
        # Fallback: look for a GST line with a standalone amount
        m = re.search(r'gst[^\n]*?(?:rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)\s*$', text, re.IGNORECASE | re.MULTILINE)
        if m:
            amounts['gst_amount'] = float(m.group(1).replace(',', ''))

    # Grand Total / Total (take the last match to avoid partial totals)
    matches = re.findall(r'(?:grand\s*)?total[:\s]+(?:rs\.?\s*)?(\d[\d,]*(?:\.\d+)?)', text, re.IGNORECASE)
    if matches:
        amounts['total'] = float(matches[-1].replace(',', ''))


    print(f"Invoice amounts extracted: {amounts}")
    return amounts

def validate_invoice_amounts(amounts: dict) -> InvoiceValidationResult:
    """Run 2 arithmetic checks on extracted invoice amounts."""
    errors: list = []
    subtotal    = amounts.get('subtotal', 0)
    gst_pct     = amounts.get('gst_percentage', 0)
    gst_amt     = amounts.get('gst_amount', 0)
    total       = amounts.get('total', 0)
    TOLERANCE   = 2.0  # ±₹2 rounding allowance

    if subtotal and gst_pct and gst_amt:
        expected_gst = round(subtotal * gst_pct / 100, 2)
        diff = abs(expected_gst - gst_amt)
        passed = diff <= TOLERANCE
        errors.append(InvoiceAmountCheck(
            check="GST Calculation",
            expected=expected_gst,
            found=gst_amt,
            difference=round(diff, 2),
            message=(f"GST ₹{gst_amt:.2f} matches {subtotal:.2f} × {gst_pct:.0f}% = ₹{expected_gst:.2f}"
                     if passed else
                     f"GST should be ₹{expected_gst:.2f} ({subtotal:.2f} × {gst_pct:.0f}%) but found ₹{gst_amt:.2f}"),
            passed=passed
        ))

    # Check 3 — Final total
    if subtotal and gst_amt and total:
        expected_total = round(subtotal + gst_amt, 2)
        diff = abs(expected_total - total)
        passed = diff <= TOLERANCE
        errors.append(InvoiceAmountCheck(
            check="Final Total",
            expected=expected_total,
            found=total,
            difference=round(diff, 2),
            message=(f"Total ₹{total:.2f} matches Sub Total + GST = ₹{expected_total:.2f}"
                     if passed else
                     f"Total should be ₹{expected_total:.2f} (₹{subtotal:.2f} + ₹{gst_amt:.2f}) but found ₹{total:.2f}"),
            passed=passed
        ))

    failed = [e for e in errors if not e.passed]
    all_valid = len(failed) == 0 and len(errors) > 0

    return InvoiceValidationResult(
        present=True,
        valid=all_valid,
        message=("Invoice amount calculation is correct" if all_valid
                 else ("Invoice amounts could not be fully verified" if not errors
                       else f"{len(failed)} amount check(s) failed")),
        subtotal=subtotal,
        gst_percentage=gst_pct,
        gst_amount=gst_amt,
        total=total,
        errors=errors
    )

@router.post("/analyze-folder", response_model=FolderAnalysisResponse)
async def analyze_folder(files: List[UploadFile] = File(...)):
    if not files:
        return FolderAnalysisResponse(analysis=[], duplicates=[], invoice_validation=None)
        
    temp_dir = tempfile.mkdtemp()
    file_texts = {}
    analysis_results = []
    
    try:
        for file in files:
            # KEY FIX: Strip folder prefix from filename (e.g. '4569871235/invoice.pdf' -> 'invoice.pdf')
            base_filename = os.path.basename(file.filename)
            file_path = os.path.join(temp_dir, base_filename)
            try:
                content = await file.read()
                with open(file_path, "wb") as buffer:
                    buffer.write(content)

                print(f"Processing: {base_filename} ({len(content)} bytes) at {file_path}")

                # Extract text using multi-method approach
                text = extract_text_from_file(file_path)
                print(f"  -> Extracted {len(text)} chars from {base_filename}")

                detected_type = classify_content(text, base_filename)
                print(f"  -> Detected type: {detected_type}")

                analysis_results.append(FileAnalysis(
                    filename=base_filename,
                    detected_type=detected_type,
                    confidence=0.9 if text else 0.5,
                    summary=text[:120] + "..." if len(text) > 120 else (text if text else "No text extracted"),
                    full_text=text  # Always return raw text (empty string if none)
                ))

                if text:
                    file_texts[base_filename] = text
            except Exception as fe:
                print(f"Error processing file {base_filename}: {fe}")
                analysis_results.append(FileAnalysis(
                    filename=base_filename,
                    detected_type="other",
                    confidence=0.0,
                    summary="Error processing file",
                    full_text=""
                ))
                
        # Invoice amount validation — find the invoice file and validate
        invoice_validation: Optional[InvoiceValidationResult] = None
        invoice_texts = [(r.filename, r.full_text) for r in analysis_results if r.detected_type == "invoice"]
        if invoice_texts:
            inv_filename, inv_text = invoice_texts[0]
            print(f"Running invoice amount validation on: {inv_filename}")
            amounts = extract_amounts_from_invoice(inv_text)
            invoice_validation = validate_invoice_amounts(amounts)
            print(f"Invoice validation result: valid={invoice_validation.valid}, errors={len(invoice_validation.errors)}")
        else:
            invoice_validation = InvoiceValidationResult(
                present=False, valid=True,
                message="No invoice file found — skipped",
                subtotal=0, gst_percentage=0, gst_amount=0, total=0,
                errors=[]
            )

        # Duplicate detection
        duplicates = []
        filenames = list(file_texts.keys())
        for i in range(len(filenames)):
            for j in range(i + 1, len(filenames)):
                f1 = filenames[i]
                f2 = filenames[j]
                sim = calculate_similarity(file_texts[f1], file_texts[f2])
                if sim > 0.8:
                    duplicates.append(DuplicatePair(file1=f1, file2=f2, similarity=sim))

        return FolderAnalysisResponse(
            analysis=analysis_results,
            duplicates=duplicates,
            invoice_validation=invoice_validation
        )
    except Exception as e:
        print(f"CRITICAL ERROR in analyze_folder: {e}")
        raise HTTPException(status_code=500, detail=f"Forensic Analysis Critical Error: {str(e)}")
        
    finally:
        # Cleanup
        for f in os.listdir(temp_dir):
            try: os.remove(os.path.join(temp_dir, f))
            except: pass
        try: os.rmdir(temp_dir)
        except: pass
