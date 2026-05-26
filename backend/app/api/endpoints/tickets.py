from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
import re
import os
import tempfile
import numpy as np
import io
import cv2
from paddleocr import PaddleOCR
from PIL import Image
import fitz # PyMuPDF

# pdf2image for scanned PDFs
try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False

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
    ocr_engine: Optional[str] = "unknown"
    text_type: Optional[str] = "printed"

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

class BlankFile(BaseModel):
    filename: str
    reason: str

class FolderAnalysisResponse(BaseModel):
    analysis: List[FileAnalysis]
    duplicates: List[DuplicatePair]
    invoice_validation: Optional[InvoiceValidationResult] = None
    blank_files: List[BlankFile] = []

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

def preprocess_image(pil_image):
    try:
        # Convert to OpenCV
        img_cv = cv2.cvtColor(
            np.array(pil_image),
            cv2.COLOR_RGB2BGR
        )

        # Step 1 — Upscale if image is small
        h, w = img_cv.shape[:2]
        if w < 1000:
            scale = 1000 / w
            img_cv = cv2.resize(
                img_cv, None,
                fx=scale, fy=scale,
                interpolation=cv2.INTER_CUBIC
            )
            print(f"Upscaled image by {scale:.1f}x")

        # Step 2 — Convert to grayscale
        gray = cv2.cvtColor(
            img_cv, cv2.COLOR_BGR2GRAY
        )

        # Step 3 — Denoise
        denoised = cv2.fastNlMeansDenoising(
            gray, h=10
        )

        # Step 4 — Enhance contrast
        clahe = cv2.createCLAHE(
            clipLimit=2.0,
            tileGridSize=(8, 8)
        )
        enhanced = clahe.apply(denoised)

        # Step 5 — Sharpen
        kernel = np.array([
            [-1, -1, -1],
            [-1,  9, -1],
            [-1, -1, -1]
        ])
        sharpened = cv2.filter2D(enhanced, -1, kernel)

        # Convert back to PIL
        preprocessed = Image.fromarray(sharpened)
        return preprocessed

    except Exception as e:
        print(f"Preprocessing error: {e}")
        return pil_image

def get_paddle_confidence(paddle_result):
    if not paddle_result or not paddle_result[0]:
        return 0.0
    confidences = []
    for line in paddle_result[0]:
        if line and len(line) > 1 and line[1]:
            confidences.append(line[1][1])
    if not confidences:
        return 0.0
    return sum(confidences) / len(confidences)

def get_paddle_text(paddle_result):
    if not paddle_result or not paddle_result[0]:
        return ""
    texts = []
    for line in paddle_result[0]:
        if line and len(line) > 1 and line[1]:
            t = line[1][0]
            if t and t.strip():
                texts.append(t.strip())
    return '\n'.join(texts)

def extract_text_from_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    print(f"\nProcessing: {os.path.basename(file_path)}")

    # ── PDF FILE ──────────────────────────────
    if ext == '.pdf':

        # Try pdfplumber first
        text = ""
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                pages = []
                for page in pdf.pages:
                    t = page.extract_text()
                    if t and t.strip():
                        pages.append(t.strip())
                text = '\n'.join(pages)
        except Exception as e:
            print(f"pdfplumber error: {e}")

        if text and len(text.strip()) > 50:
            print(f"Digital PDF — {len(text)} chars")
            return {
                "text": text.strip(),
                "engine": "pdfplumber",
                "text_type": "printed"
            }

        # Scanned PDF — convert to images
        print("Scanned PDF — converting to images")
        try:
            from pdf2image import convert_from_path
            images = convert_from_path(
                file_path, dpi=200
            )
            all_text = []
            engine_used = "unknown"

            for i, pil_img in enumerate(images):
                print(f"Page {i+1}/{len(images)}")
                result = extract_from_image(pil_img)
                all_text.append(result["text"])
                if i == 0:
                    engine_used = result["engine"]

            combined = '\n'.join(all_text)
            print(f"Scanned PDF total: {len(combined)} chars")
            return {
                "text": combined,
                "engine": engine_used,
                "text_type": "scanned_pdf"
            }

        except Exception as e:
            print(f"pdf2image error: {e}")

        return {
            "text": "",
            "engine": "failed",
            "text_type": "unknown"
        }

    # ── IMAGE FILE ────────────────────────────
    elif ext in ['.jpg', '.jpeg', '.png',
                 '.webp', '.tiff', '.bmp']:
        try:
            pil_image = Image.open(file_path)
            return extract_from_image(pil_image)
        except Exception as e:
            print(f"Image error: {e}")
            return {
                "text": "",
                "engine": "failed",
                "text_type": "unknown"
            }

    return {
        "text": "",
        "engine": "unsupported",
        "text_type": "unknown"
    }


def extract_from_image(pil_image):
    if pil_image.mode != 'RGB':
        pil_image = pil_image.convert('RGB')

    # Step 1 — Preprocess image
    preprocessed = preprocess_image(pil_image)

    # Step 2 — Run PaddleOCR on preprocessed image
    paddle_text = ""
    avg_confidence = 0.0

    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(
            use_angle_cls=True,
            lang='en',
            show_log=False
        )
        img_cv = cv2.cvtColor(
            np.array(preprocessed),
            cv2.COLOR_RGB2BGR
        )
        paddle_result = ocr.ocr(img_cv, cls=True)

        if paddle_result and paddle_result[0]:
            texts = []
            confidences = []
            for line in paddle_result[0]:
                if line and len(line) > 1 and line[1]:
                    texts.append(line[1][0])
                    confidences.append(line[1][1])
            paddle_text = '\n'.join(texts)
            avg_confidence = (
                sum(confidences) / len(confidences)
                if confidences else 0.0
            )

        print(f"PaddleOCR confidence: {avg_confidence:.2f}")
        print(f"PaddleOCR chars: {len(paddle_text)}")

    except Exception as e:
        print(f"PaddleOCR error: {e}")

    # Use PaddleOCR result (Standard engine for both printed/handwritten in this mode)
    return {
        "text": paddle_text,
        "engine": "paddleocr",
        "text_type": "printed" if avg_confidence > 0.8 else "handwritten/low_conf"
    }

def classify_content(text: str, filename: str = "") -> str:
    text_upper = text.upper()
    lines = text_upper.split('\n')

    # Check first 5 lines for document title
    title_text = ' '.join(lines[:5])

    detected_type = "OTHER"

    # STEP 1 — Title based detection
    if any(phrase in title_text for phrase in [
        "VEHICLE INVESTIGATION REPORT",
        "INVESTIGATION REPORT",
        "TECHNICAL INSPECTION REPORT",
        "FIELD INSPECTION REPORT"
    ]):
        detected_type = "INVESTIGATION"
    elif any(phrase in title_text for phrase in [
        "SERVICE INVOICE",
        "TAX INVOICE",
        "INVOICE",
    ]) and "INVESTIGATION" not in title_text:
        detected_type = "INVOICE"
    elif any(phrase in title_text for phrase in [
        "ESTIMATION REPORT",
        "SERVICE ESTIMATION",
        "COST ESTIMATE",
        "QUOTATION"
    ]):
        detected_type = "ESTIMATION"
    elif any(phrase in title_text for phrase in [
        "REJECTION REPORT",
        "WARRANTY REJECTION",
        "CLAIM REJECTION"
    ]):
        detected_type = "REJECTION"

    # STEP 2 — Full text based detection
    if detected_type == "OTHER":
        rejection_phrases = [
            "WARRANTY REJECTION REPORT",
            "WARRANTY CLAIM REJECTED",
            "REASONS FOR REJECTION",
            "FINAL DECISION: WARRANTY CLAIM REJECTED"
        ]
        if any(phrase in text_upper for phrase in rejection_phrases):
            detected_type = "REJECTION"

        elif any(phrase in text_upper for phrase in [
            "SERVICE ESTIMATION REPORT",
            "PRE-APPROVAL COST ESTIMATE",
            "GRAND TOTAL ESTIMATE",
            "ESTIMATED COST BREAKDOWN",
            "PARTS COST",
            "LABOUR COST"
        ]):
            detected_type = "ESTIMATION"

        elif any(phrase in text_upper for phrase in [
            "VEHICLE INVESTIGATION REPORT",
            "INVESTIGATION COMPLETE",
            "INVESTIGATION FINDINGS",
            "INVESTIGATION VERDICT",
            "COMPLAINT INVESTIGATION",
            "INSPECTOR SIGNATURE",
            "VALID WARRANTY CLAIM",
            "DEFECT CONFIRMED"
        ]):
            detected_type = "INVESTIGATION"

        elif any(phrase in text_upper for phrase in [
            "SERVICE INVOICE",
            "TAX INVOICE",
            "PAYMENT STATUS: PAID",
            "AUTHORISED SIGNATORY",
            "GST @ 18%",
            "SUB TOTAL",
            "FINAL TOTAL",
            "AMOUNT PAID",
            "BANK TRANSFER"
        ]):
            detected_type = "INVOICE"
        
        else:
            ext = filename.split('.')[-1].lower() if filename else ''
            if ext in ['jpg','jpeg','png','webp','tiff','bmp']:
                detected_type = "IMAGE"
            else:
                detected_type = "SUPPORTING_DOC"

    print(f"\n=== File Type Detection ===")
    print(f"Filename: {filename}")
    print(f"Text preview (first 300 chars):")
    print(text[:300])
    print(f"Title lines: {lines[:3]}")
    print(f"Detected type: {detected_type}")
    print(f"===========================\n")

    return detected_type

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

def is_blank_file(file_path, filename):
    import os

    # Check file size
    file_size = os.path.getsize(file_path)
    if file_size == 0:
        return True, "File is empty (0 bytes)"
    if file_size < 2000:
        return True, f"File is too small ({file_size} bytes)"

    # Try to extract text
    ext = filename.split('.')[-1].lower()
    text = ""

    if ext == 'pdf':
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        text += t
        except:
            pass
    elif ext in ['jpg','jpeg','png','webp','tiff']:
        try:
            from paddleocr import PaddleOCR
            # Using the globally initialized ocr_engine
            global ocr_engine
            result = ocr_engine.ocr(file_path, cls=True)
            if result and result[0]:
                text = ' '.join([
                    line[1][0]
                    for line in result[0]
                    if line and line[1]
                ])
        except:
            pass

    if len(text.strip()) < 20:
        return True, "No readable text detected — document appears blank"

    return False, ""

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

                is_blank, blank_reason = is_blank_file(file_path, base_filename)
                if is_blank:
                    print(f"File {base_filename} is blank: {blank_reason}")
                    continue

                # Extract text using multi-method approach
                result = extract_text_from_file(file_path)
                text = result["text"]
                engine_used = result["engine"]
                text_type = result["text_type"]
                
                detected_type = classify_content(text, base_filename)
                
                print(f"File: {base_filename}")
                print(f"Extracted text preview: {text[:200]}")
                print(f"Detected type: {detected_type}")
                print("---")

                analysis_results.append(FileAnalysis(
                    filename=base_filename,
                    detected_type=detected_type,
                    confidence=0.9 if text else 0.5,
                    summary=text[:120] + "..." if len(text) > 120 else (text if text else "No text extracted"),
                    full_text=text,  # Always return raw text (empty string if none)
                    ocr_engine=engine_used,
                    text_type=text_type
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
        invoice_texts = [(r.filename, r.full_text) for r in analysis_results if r.detected_type == "INVOICE"]
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

        # Duplicate detection based on type
        duplicates = []
        type_to_files = {}
        for r in analysis_results:
            ftype = r.detected_type
            if ftype in ['INVESTIGATION', 'INVOICE', 'ESTIMATION', 'REJECTION']:
                if ftype not in type_to_files:
                    type_to_files[ftype] = []
                type_to_files[ftype].append(r.filename)
                
        for ftype, files_list in type_to_files.items():
            if len(files_list) > 1:
                # Add pairs of duplicates
                for i in range(len(files_list)):
                    for j in range(i + 1, len(files_list)):
                        duplicates.append(DuplicatePair(
                            file1=files_list[i],
                            file2=files_list[j],
                            similarity=1.0  # Exact type match
                        ))

        # Determine blank files
        processed_files = {r.filename for r in analysis_results}
        blank_files = []
        for file in files:
            base_filename = os.path.basename(file.filename)
            if base_filename not in processed_files:
                file_path = os.path.join(temp_dir, base_filename)
                if os.path.exists(file_path):
                    is_blank, blank_reason = is_blank_file(file_path, base_filename)
                    if is_blank:
                        blank_files.append(BlankFile(filename=base_filename, reason=blank_reason))

        return FolderAnalysisResponse(
            analysis=analysis_results,
            duplicates=duplicates,
            invoice_validation=invoice_validation,
            blank_files=blank_files
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
