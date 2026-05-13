from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import numpy as np
import cv2
import re
import io
import os
import sys
from PIL import Image
import fitz  # PyMuPDF for PDF handling

app = FastAPI(title="Verentis OCR Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize PaddleOCR once at startup
print("Loading PaddleOCR...")
from paddleocr import PaddleOCR
ocr_engine = PaddleOCR(
    use_angle_cls=True,
    lang='en',
    show_log=False,
    use_gpu=False,
    det_db_thresh=0.3,
    det_db_box_thresh=0.5,
    rec_batch_num=6
)
print("PaddleOCR loaded successfully")

# ─── CONSTANTS ───────────────────────────────────────────────

INDIAN_STATES = {
    'AN','AP','AR','AS','BR','CG','CH','DD','DL','DN',
    'GA','GJ','HP','HR','JH','JK','KA','KL','LA','LD',
    'MH','ML','MN','MP','MZ','NL','OD','OR','PB','PY',
    'RJ','SK','TN','TR','TS','UK','UP','WB'
}

STATE_NAMES = {
    'WB':'West Bengal','MH':'Maharashtra','DL':'Delhi',
    'TN':'Tamil Nadu','KA':'Karnataka','JK':'Jammu & Kashmir',
    'UP':'Uttar Pradesh','RJ':'Rajasthan','GJ':'Gujarat',
    'AP':'Andhra Pradesh','TS':'Telangana','KL':'Kerala',
    'PB':'Punjab','HR':'Haryana','MP':'Madhya Pradesh',
    'BR':'Bihar','OR':'Odisha','OD':'Odisha','AS':'Assam',
    'HP':'Himachal Pradesh','UK':'Uttarakhand',
    'CG':'Chhattisgarh','JH':'Jharkhand','GA':'Goa',
    'MN':'Manipur','ML':'Meghalaya','MZ':'Mizoram',
    'NL':'Nagaland','TR':'Tripura','AR':'Arunachal Pradesh',
    'SK':'Sikkim','LA':'Ladakh','DN':'Dadra & NH',
    'DD':'Daman & Diu','CH':'Chandigarh','AN':'Andaman'
}

MANUFACTURER_PREFIXES = {
    'WDD':'Mercedes-Benz','ME4':'Honda India',
    'MAT':'Tata Motors','MBJ':'Bajaj Auto',
    'MA3':'Maruti Suzuki','MBL':'Hero MotoCorp',
    'MA1':'Mahindra','WBA':'BMW','WBS':'BMW M',
    'JHM':'Honda Japan','1HG':'Honda USA',
    '2T1':'Toyota','KNA':'Kia','KMH':'Hyundai',
    'SAL':'Land Rover','YV1':'Volvo',
    'MD2':'Royal Enfield','MD6':'Royal Enfield',
    'AAB':'Ashok Leyland','MAK':'Kinetic',
    'MAH':'Hero Honda','MCL':'Hero MotoCorp',
    'MBH':'Yamaha India','SHH':'Honda UK',
    'ZFF':'Ferrari','VF1':'Renault',
    'WAU':'Audi','5YJ':'Tesla','JN1':'Nissan',
    'TMA':'TVS','MAL':'LML','MAC':'Scooters India','ME3':'Royal Enfield'
}

MONTHS = {'JAN','FEB','MAR','APR','MAY','JUN',
          'JUL','AUG','SEP','OCT','NOV','DEC'}

CHASSIS_LABELS = [
    'chassis no','chassis number','chassis no.',
    'chasis no','chasis no.','chasis number',
    'chassisno','chas no','ch no','ch. no',
    'frame no','frame number','frame no.',
    'vin','vin no','vin number','body no',
    'vehicle identification number',
    'chassis n0','chasis n0','chassis nd'
]

REG_LABELS = [
    'vehicle no','vehicle no.','vehicle number',
    'veh no','veh. no','reg no','reg. no','regno',
    'rego no','rego no.','rego','regd no','regd. no',
    'regn no','regn. no','registration no',
    'registration no.','registration number',
    'plate no','number plate','rc no','rc number',
    'vehicle mo','vehicle n0','vehicle nd',
    'veh mo','reg n0','vehicleno','regdno'
]

EXCLUDE_LABELS = [
    'application no','application no.','receipt no',
    'application no/receipt no','application no./receipt no',
    'receirt/appl no','appl no',
    'payment transaction no','payment transaction',
    'transaction no','bank reference number',
    'bank reference','grn no','grn number',
    'engine no','engine number','engine no.','eng no',
    'invoice no','invoice number','order no','stock no',
    'customer no','customer number','model no'
]

REJECT_WORDS = [
    'CUSTOMER','ORDER','INVOICE','DEPARTMENT','DOCUMENT',
    'RECEIPT','FINANCE','AMOUNT','TOTAL','BALANCE',
    'TRANSFER','OWNERSHIP','POSTAL','AVANTGARDE',
    'PACKAGE','VISION','COMFORT','SEDAN','CLASS',
    'VERIFICATION','CERTIFICATE','POLICY','INSURANCE',
    'REGISTRATION','AUTHORITY','TRANSPORT','GOVERNMENT',
    'NAME','OWNER','VALID','TILL','DATE','REG','ADDRESS',
    'ENGINE','FUEL','SON','DAUGHTER','WIFE'
]

# ─── IMAGE PREPROCESSING ─────────────────────────────────────

def preprocess_image(img_np):
    """Enhance image for better OCR accuracy"""
    # Convert to grayscale if needed
    if len(img_np.shape) == 3:
        gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    else:
        gray = img_np

    # Denoise
    denoised = cv2.fastNlMeansDenoising(gray, h=10)

    # Adaptive threshold for better text detection
    thresh = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2
    )

    # Convert back to RGB for PaddleOCR
    rgb = cv2.cvtColor(thresh, cv2.COLOR_GRAY2RGB)
    return rgb

def load_image(content: bytes, filename: str) -> list:
    """Convert file to list of numpy arrays (one per page)"""
    images = []
    filename_lower = filename.lower()

    if filename_lower.endswith('.pdf'):
        # PDF: convert each page to image
        doc = fitz.open(stream=content, filetype="pdf")
        for page_num in range(len(doc)):
            page = doc[page_num]
            # High resolution render
            mat = fitz.Matrix(2.5, 2.5)
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data)).convert('RGB')
            images.append(np.array(img))
        doc.close()
    else:
        # Image file
        img = Image.open(io.BytesIO(content)).convert('RGB')
        img_np = np.array(img)

        # Upscale small images for better OCR
        h, w = img_np.shape[:2]
        if w < 1000:
            scale = 1000 / w
            img_np = cv2.resize(
                img_np,
                (int(w * scale), int(h * scale)),
                interpolation=cv2.INTER_CUBIC
            )
        images.append(img_np)

    return images

# ─── OCR EXTRACTION ──────────────────────────────────────────

def run_ocr(img_np):
    """Run PaddleOCR and return list of text items with positions"""
    try:
        result = ocr_engine.ocr(img_np, cls=True)
        items = []
        if result and result[0]:
            for line in result[0]:
                if line and len(line) >= 2:
                    bbox = line[0]
                    text = line[1][0] if line[1] else ''
                    conf = line[1][1] if line[1] else 0
                    if text.strip() and conf > 0.3:
                        x_coords = [p[0] for p in bbox]
                        y_coords = [p[1] for p in bbox]
                        items.append({
                            'text': text.strip(),
                            'x': min(x_coords),
                            'y': min(y_coords),
                            'x2': max(x_coords),
                            'y2': max(y_coords),
                            'conf': conf
                        })
        return items
    except Exception as e:
        print(f"OCR error: {e}")
        return []

# ─── TEXT RECONSTRUCTION ─────────────────────────────────────

def build_full_text_and_lvm(all_items):
    """Build sorted full text and label-value map from OCR items"""
    # Sort by Y then X
    sorted_items = sorted(
        all_items,
        key=lambda i: (round(i['y'] / 10) * 10, i['x'])
    )

    # Group into lines
    lines = []
    current_line = []
    current_y = None

    for item in sorted_items:
        if current_y is None:
            current_y = item['y']
            current_line = [item]
        elif abs(item['y'] - current_y) < 15:
            current_line.append(item)
        else:
            if current_line:
                current_line.sort(key=lambda i: i['x'])
                lines.append(current_line)
            current_line = [item]
            current_y = item['y']
    if current_line:
        current_line.sort(key=lambda i: i['x'])
        lines.append(current_line)

    full_text = '\n'.join(
        ' '.join(item['text'] for item in line)
        for line in lines
    )

    print(f"Full extracted text:\n{full_text}\n")

    # Build label-value map
    lvm = {}

    # Method 1: Same-line adjacency (table cells)
    for line in lines:
        for i in range(len(line) - 1):
            label = line[i]['text'].replace(':', '').strip().lower()
            value = line[i + 1]['text'].strip()
            if len(label) > 1 and len(value) > 0:
                lvm[label] = value
                print(f"[LVM-A] {label} -> {value}")

        # Also check items 2 apart for wider tables
        for i in range(len(line) - 2):
            label = line[i]['text'].replace(':', '').strip().lower()
            value = line[i + 2]['text'].strip()
            if len(label) > 1 and len(value) > 0 and label not in lvm:
                lvm[label] = value
                print(f"[LVM-B] {label} -> {value}")

    # Method 2: Colon within same item
    for item in all_items:
        if ':' in item['text']:
            idx = item['text'].index(':')
            label = item['text'][:idx].strip().lower()
            value = item['text'][idx+1:].strip()
            if len(label) > 1 and len(value) > 0:
                lvm[label] = value
                print(f"[LVM-C] {label} -> {value}")

    # Method 3: Line-level colon split
    for line_text in full_text.split('\n'):
        if ':' in line_text:
            idx = line_text.index(':')
            if idx < 50:
                label = line_text[:idx].strip().lower()
                value = line_text[idx+1:].strip()
                if len(label) > 1 and len(value) > 0 and label not in lvm:
                    lvm[label] = value
                    print(f"[LVM-D] {label} -> {value}")

    # Method 4: Spatial proximity
    # For each item that looks like a label, find value to its right
    for item in all_items:
        text = item['text'].replace(':', '').strip()
        if len(text) < 3:
            continue
        label_lower = text.lower()
        # Check if this looks like a label
        is_label = any(
            cl_label in label_lower
            for cl_label in CHASSIS_LABELS + REG_LABELS + EXCLUDE_LABELS
        )
        if is_label and label_lower not in lvm:
            # Find nearest item to the right on same row
            candidates = [
                other for other in all_items
                if other != item and
                abs(other['y'] - item['y']) < 20 and
                other['x'] > item['x2']
            ]
            if candidates:
                nearest = min(candidates, key=lambda o: o['x'])
                lvm[label_lower] = nearest['text'].strip()
                print(f"[LVM-E] {label_lower} -> {nearest['text'].strip()}")

    return full_text, lvm

# ─── OCR NORMALIZATION ───────────────────────────────────────

def normalize_ocr(text):
    """Fix common OCR misreads for VIN/chassis"""
    # Only apply in digit-surrounded contexts
    result = list(text.upper())
    fixes = {'O': '0', 'I': '1', 'S': '5', 'B': '8', 'Z': '2', 'G': '6'}
    for i in range(len(result)):
        if result[i] in fixes:
            prev_digit = i > 0 and result[i-1].isdigit()
            next_digit = i < len(result)-1 and result[i+1].isdigit()
            if prev_digit or next_digit:
                result[i] = fixes[result[i]]
    return ''.join(result)

# ─── VIN CHECKSUM ────────────────────────────────────────────

def vin_checksum_valid(vin):
    if len(vin) != 17:
        return False
    trans = {
        'A':1,'B':2,'C':3,'D':4,'E':5,'F':6,'G':7,'H':8,
        'J':1,'K':2,'L':3,'M':4,'N':5,'P':7,'R':9,
        'S':2,'T':3,'U':4,'V':5,'W':6,'X':7,'Y':8,'Z':9,
        '0':0,'1':1,'2':2,'3':3,'4':4,'5':5,
        '6':6,'7':7,'8':8,'9':9
    }
    weights = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2]
    try:
        total = sum(trans[c] * w for c, w in zip(vin, weights))
        rem = total % 11
        check = str(rem) if rem < 10 else 'X'
        return check == vin[8]
    except:
        return False

# ─── EXCLUSION LIST ──────────────────────────────────────────

def build_exclusions(lvm):
    excluded = set()
    for label_key in EXCLUDE_LABELS:
        for lvm_key, val in lvm.items():
            if label_key in lvm_key:
                for part in val.split('/'):
                    clean = re.sub(r'[^A-Z0-9]', '', part.upper())
                    if clean:
                        excluded.add(clean)
                        if len(clean) > 17:
                            excluded.add(clean[:17])
    print(f"Exclusions: {excluded}")
    return excluded

# ─── CHASSIS VALIDATION ──────────────────────────────────────

def validate_chassis_detailed(val, exclusions):
    """
    Returns dict with:
    - is_valid: bool
    - clean_value: str
    - rejection_reason: str or None
    - severity: 'invalid' or 'suspicious' or None
    """
    if not val:
        return {
            'is_valid': False,
            'clean_value': '',
            'rejection_reason': 'No value provided',
            'severity': 'invalid'
        }

    clean = re.sub(r'[^A-Z0-9]', '', val.upper())
    original_length = len(clean)

    # Check exclusions first
    if clean in exclusions:
        return {
            'is_valid': False,
            'clean_value': clean,
            'rejection_reason': f'Value matches excluded field (application/transaction number)',
            'severity': 'invalid'
        }

    # Check for exclusion prefix
    for ex in exclusions:
        if ex.startswith(clean) and len(ex) > len(clean):
            return {
                'is_valid': False,
                'clean_value': clean,
                'rejection_reason': 'Value is a prefix of an excluded application number',
                'severity': 'invalid'
            }

    # Length checks
    if original_length < 6:
        return {
            'is_valid': False,
            'clean_value': clean,
            'rejection_reason': f'Too short: {original_length} characters. Minimum chassis length is 6 characters.',
            'severity': 'invalid'
        }

    if original_length > 17:
        return {
            'is_valid': False,
            'clean_value': clean,
            'rejection_reason': (
                f'Too long: {original_length} characters. '
                f'Maximum chassis length is 17 characters.'
            ),
            'severity': 'invalid'
        }

    # Check if it looks like a VIN (has known prefix) but wrong length
    has_known_prefix = any(
        clean.startswith(p) for p in MANUFACTURER_PREFIXES.keys()
    )
    if has_known_prefix and original_length != 17 and original_length < 6:
        return {
            'is_valid': False,
            'clean_value': clean,
            'rejection_reason': (
                f'Chassis \'{clean}\' has {original_length} characters. '
                f'Standard VIN must be 17 characters. Prefix detected but length is too low.'
            ),
            'severity': 'invalid'
        }

    # Character check (Rule 3: Invalid Character Check)
    forbidden = [c for c in clean if c in ['I', 'O', 'Q']]
    if forbidden:
        return {
            'is_valid': False,
            'clean_value': clean,
            'rejection_reason': (
                f'Standard VIN contains forbidden characters: '
                f'{", ".join(forbidden)}. Letters I, O, Q are not '
                f'allowed in standard VIN format (ISO 3779).'
            ),
            'severity': 'invalid'
        }

    # Composition checks
    digit_count = len(re.findall(r'[0-9]', clean))
    letter_count = len(re.findall(r'[A-Z]', clean))

    if digit_count < 2:
        return {
            'is_valid': False,
            'clean_value': clean,
            'rejection_reason': f'Only {digit_count} digit(s) found. Chassis must contain at least 2 digits.',
            'severity': 'invalid'
        }

    if letter_count < 2:
        return {
            'is_valid': False,
            'clean_value': clean,
            'rejection_reason': f'Only {letter_count} letter(s) found. Chassis must contain at least 2 letters.',
            'severity': 'invalid'
        }

    if re.match(r'^[A-Z]+$', clean):
        return {
            'is_valid': False,
            'clean_value': clean,
            'rejection_reason': 'All letters, no digits. Not a valid chassis format.',
            'severity': 'invalid'
        }

    if re.match(r'^[0-9]+$', clean):
        return {
            'is_valid': False,
            'clean_value': clean,
            'rejection_reason': 'All digits, no letters. Not a valid chassis format.',
            'severity': 'invalid'
        }

    # Common word rejection (Rule 3)
    found_words = [w for w in REJECT_WORDS if w in clean or w in val.upper()]
    if found_words:
        return {
            'is_valid': False,
            'clean_value': clean,
            'rejection_reason': f'Contains forbidden keyword(s): {", ".join(found_words)}. Field likely misidentified.',
            'severity': 'invalid'
        }

    # ALL CHECKS PASSED
    return {
        'is_valid': True,
        'clean_value': clean,
        'rejection_reason': None,
        'severity': None
    }


def correct_wmi_misreads(wmi: str) -> str:
    """Fix common OCR misreads in the first 3 characters (WMI) of a chassis number"""
    if not wmi or len(wmi) < 3:
        return wmi
    
    # Map for WMI correction (digit -> letter)
    # Applied only to the first 3 characters where letters are expected
    corrections = {
        '8': 'B',
        '0': 'O',
        '1': 'I',
        '5': 'S',
        '6': 'G'
    }
    
    wmi_chars = list(wmi.upper())
    for i in range(min(3, len(wmi_chars))):
        if wmi_chars[i] in corrections:
            wmi_chars[i] = corrections[wmi_chars[i]]
            
    return "".join(wmi_chars)

# ─── CHASSIS DETECTION ──────────────────────────────────────

def detect_chassis(full_text, lvm, exclusions):
    upper = full_text.upper()
    lines = [l.strip() for l in upper.split('\n') if l.strip()]

    # Collect engine exclusions
    engine_excl = set(exclusions)
    for key, val in lvm.items():
        if 'engine' in key:
            clean = re.sub(r'[^A-Z0-9]', '', val.upper())
            engine_excl.add(clean)
            print(f"Engine exclusion: {clean}")

    # Store all candidates for reporting
    all_candidates = []

    # Rule 1 & 2: Search specifically for Chassis No variants
    target_labels = ["CHASSIS NO", "CHASSIS NO.", "CHASIS NO", "CHASIS NO.", "CHASSIS NUMBER", "VIN"]
    
    for idx, line in enumerate(lines):
        found_label = None
        for label in target_labels:
            if label in line:
                found_label = label
                break
        
        if found_label:
            print(f"[CHS] Found label '{found_label}' on line {idx}: {line}")
            
            # Step A: Check same line (Rule 1)
            # Find index of label to extract text AFTER it
            label_pos = line.find(found_label)
            after_text = line[label_pos + len(found_label):].strip()
            
            # Extract alphanumeric tokens
            tokens = re.findall(r'[A-Z0-9]{6,25}', after_text)
            
            # Step B: If no candidate on same line, check NEXT line (Rule 2)
            if not tokens and idx + 1 < len(lines):
                next_line = lines[idx+1].strip()
                print(f"[CHS] Checking next line: {next_line}")
                # Don't take next line if it contains other labels (Rule 4)
                if not any(l in next_line for l in REG_LABELS + EXCLUDE_LABELS + ['OWNER', 'DATE', 'VALID']):
                    tokens = re.findall(r'[A-Z0-9]{6,25}', next_line)

            for token in tokens:
                normalized = normalize_ocr(token)
                validation = validate_chassis_detailed(normalized, engine_excl)
                
                # Rule 3: Mix text rejection
                if any(word in token for word in ['NAME', 'OWNER', 'VALID', 'TILL']):
                    validation['is_valid'] = False
                    validation['rejection_reason'] = "Mixed label text detected"

                all_candidates.append({
                    'value': normalized,
                    'source': f'Field Scan ({found_label})',
                    'validation': validation
                })

                if validation['is_valid']:
                    clean = validation['clean_value']
                    
                    # STEP 2 & 3: Apply WMI correction for scoring and display
                    wmi_candidate = clean[:3]
                    corrected_wmi = correct_wmi_misreads(wmi_candidate)
                    
                    # Valid WMI list with safety fallbacks (STEP 4)
                    wmi_list = ["MA1", "MA3", "MAT", "MAL", "MAK", "MBA", "MB1", "MB8", "MBH", "MBL", "MD2", "MD7", "MDH", "ME3", "MEE", "MEF", "MEG", "MEL", "MES", "M81", "M88", "M8H", "M8L", "ME5"]
                    
                    # If corrected WMI matches, use it (STEP 3)
                    if corrected_wmi in wmi_list or wmi_candidate in wmi_list:
                        if corrected_wmi in wmi_list and corrected_wmi != wmi_candidate:
                            clean = corrected_wmi + clean[3:]
                        
                        manufacturer = MANUFACTURER_PREFIXES.get(clean[:3])
                        
                        # Rule 7: Scoring - Give full 50 points for WMI check (STEP 3)
                        confidence = 0
                        if len(clean) == 17: confidence += 50
                        confidence += 50 # Valid WMI matched
                    else:
                        manufacturer = MANUFACTURER_PREFIXES.get(clean[:3])
                        confidence = 50 if len(clean) == 17 else 0
                    
                    # Check for I, O, Q (Standard VINs don't use them, but we allow for noisy OCR)
                    if any(c in clean for c in ['I', 'O', 'Q']):
                        # Only penalize if it's NOT in the first 3 chars (WMI) which we already handled
                        if any(c in clean[3:] for c in ['I', 'O', 'Q']):
                            confidence = max(0, confidence - 20)
                        
                        is_valid = True
                        reason = "Contains non-standard characters I, O, Q (suspicious)"
                    else:
                        is_valid = True
                        reason = None

                    return {
                        'value': clean,
                        'source': f'Label: {found_label}',
                        'manufacturer': manufacturer,
                        'checksum': vin_checksum_valid(clean),
                        'confidence': confidence,
                        'is_valid': is_valid,
                        'rejection_reason': reason,
                        'candidates': all_candidates
                    }

    # LAYER 2: Fallback to LVM (Label-Value Map) if direct scan failed
    for label in target_labels:
        label_lower = label.lower().replace('.', '')
        for lvm_key, val in lvm.items():
            if label_lower in lvm_key:
                normalized = normalize_ocr(re.sub(r'[^A-Z0-9]', '', val.upper()))
                validation = validate_chassis_detailed(normalized, engine_excl)
                all_candidates.append({
                    'value': normalized,
                    'source': f'LVM Fallback ({lvm_key})',
                    'validation': validation
                })
                if validation['is_valid']:
                    clean = validation['clean_value']
                    
                    # Apply WMI correction for LVM fallback too
                    wmi_candidate = clean[:3]
                    corrected_wmi = correct_wmi_misreads(wmi_candidate)
                    wmi_list = ["MA1", "MA3", "MAT", "MAL", "MAK", "MBA", "MB1", "MB8", "MBH", "MBL", "MD2", "MD7", "MDH", "ME3", "MEE", "MEF", "MEG", "MEL", "MES", "M81", "M88", "M8H", "M8L", "ME5"]
                    
                    if corrected_wmi in wmi_list or wmi_candidate in wmi_list:
                        if corrected_wmi in wmi_list and corrected_wmi != wmi_candidate:
                            clean = corrected_wmi + clean[3:]
                        manufacturer = MANUFACTURER_PREFIXES.get(clean[:3])
                        confidence = 50 + (50 if len(clean) == 17 else 0)
                    else:
                        manufacturer = MANUFACTURER_PREFIXES.get(clean[:3])
                        confidence = 50 if len(clean) == 17 else 0
                        
                    return {
                        'value': clean,
                        'source': f'LVM: {lvm_key}',
                        'manufacturer': manufacturer,
                        'checksum': vin_checksum_valid(clean),
                        'confidence': confidence,
                        'is_valid': True,
                        'rejection_reason': None,
                        'candidates': all_candidates
                    }

    # Nothing valid found
    return {
        'value': None,
        'source': 'Not found',
        'manufacturer': None,
        'checksum': False,
        'confidence': 0,
        'is_valid': False,
        'rejection_reason': 'Could not extract valid chassis number following Indian RC standards.',
        'candidates': all_candidates
    }

# ─── REGISTRATION VALIDATION ─────────────────────────────────

def is_valid_indian_reg(val):
    clean = re.sub(r'[\s\-]', '', val.upper())
    if len(clean) < 6 or len(clean) > 10:
        return False
    m = re.match(
        r'^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{1,4})$',
        clean
    )
    if not m:
        return False
    state, district, series, number = m.groups()
    if state not in INDIAN_STATES:
        return False
    if series in MONTHS:
        return False
    return True

def format_reg(val):
    clean = re.sub(r'[\s\-]', '', val.upper())
    m = re.match(
        r'^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{1,4})$',
        clean
    )
    if m:
        return f"{m[1]} {m[2]} {m[3]} {m[4]}"
    return clean

# ─── REGISTRATION DETECTION ──────────────────────────────────

def detect_registration(full_text, lvm, exclusions):
    upper = full_text.upper()
    lines = [l.strip() for l in upper.split('\n') if l.strip()]

    # LAYER 1: Label match
    for label in REG_LABELS:
        for lvm_key, val in lvm.items():
            if label in lvm_key:
                raw = re.sub(r'[^A-Z0-9]', '', val.upper()).strip()
                print(f"[REG-L1] {lvm_key} -> {raw}")
                if not raw or raw == 'NEW' or len(raw) < 4:
                    continue
                if raw in exclusions:
                    print(f"[REG] Excluded: {raw}")
                    continue
                if is_valid_indian_reg(raw):
                    state = raw[:2]
                    print(f"[REG] FOUND via label: {raw}")
                    return {
                        'value': format_reg(raw),
                        'raw': raw,
                        'state': STATE_NAMES.get(state, state),
                        'source': f'Label: {lvm_key}',
                        'confidence': 100
                    }

    # LAYER 2: Line keyword search
    for line in lines:
        skip_keywords = [
            'CHASSIS','CHASIS','ENGINE','APPLICATION',
            'TRANSACTION','RECEIPT','BANK','PAYMENT'
        ]
        if any(kw in line for kw in skip_keywords):
            continue
        m = re.search(
            r'(?:VEHICLE\s*[MN][O0D]|VEH\s*[MN][O0]|'
            r'REG(?:O|D|N)?\s*NO|PLATE\s*NO|RC\s*NO)'
            r'[.\s:]+([A-Z0-9]{4,12})',
            line
        )
        if m:
            raw = re.sub(r'[^A-Z0-9]', '', m.group(1).upper())
            print(f"[REG-L2] Line: {raw}")
            if raw not in exclusions and is_valid_indian_reg(raw):
                state = raw[:2]
                return {
                    'value': format_reg(raw),
                    'raw': raw,
                    'state': STATE_NAMES.get(state, state),
                    'source': 'Line pattern',
                    'confidence': 75
                }

    # LAYER 3: State-code anchored scan
    no_space = re.sub(r'\s', '', upper)
    state_list = '|'.join(INDIAN_STATES)
    pattern = f'(?:{state_list})[0-9]{{1,2}}[A-Z]{{1,3}}[0-9]{{1,4}}'
    matches = re.findall(pattern, no_space)
    print(f"[REG-L3] State matches: {matches}")
    for val in matches:
        if val not in exclusions and is_valid_indian_reg(val):
            state = val[:2]
            print(f"[REG] FOUND via scan: {val}")
            return {
                'value': format_reg(val),
                'raw': val,
                'state': STATE_NAMES.get(state, state),
                'source': 'Pattern scan',
                'confidence': 100
            }

    # LAYER 4: BH series
    bh = re.search(r'[0-9]{2}BH[0-9]{4}[A-Z]{1,2}', no_space)
    if bh:
        return {
            'value': bh.group(),
            'raw': bh.group(),
            'state': 'BH Series (National)',
            'source': 'BH series',
            'confidence': 85
        }

    # LAYER 5: International short format (near label)
    for label in REG_LABELS:
        for lvm_key, val in lvm.items():
            if label in lvm_key:
                raw = re.sub(r'[^A-Z0-9]', '', val.upper()).strip()
                if (2 <= len(raw) <= 8 and
                        re.search(r'[A-Z]', raw) and
                        re.search(r'[0-9]', raw) and
                        raw not in exclusions):
                    return {
                        'value': raw,
                        'raw': raw,
                        'state': 'International',
                        'source': f'International: {lvm_key}',
                        'confidence': 60
                    }

    return {
        'value': None,
        'raw': None,
        'state': None,
        'source': 'Not found',
        'confidence': 0
    }

# ─── VEHICLE DOCUMENT CHECK ─────────────────────────────────

def is_vehicle_document(text):
    lower = text.lower()
    keywords = [
        'chassis','chasis','vin','frame no','registration',
        'vehicle no','reg no','rego','rc book','engine no',
        'owner','rto','transport','mv tax','invoice','dealer',
        'showroom','hypothecation','motor vehicle',
        'vehicle class','fitness','permit','challan',
        'insurance','registering authority','tax invoice',
        'new vehicle','vehicle price','stamp duty',
        'vahan','parivahan','transfer of ownership',
        'vehicle identification','grand total','m-cycle',
        'scooter','motorcycle','car','truck','bus','lorry',
        'maker','model','mfg','year of mfg'
    ]
    count = sum(1 for k in keywords if k in lower)
    print(f"Vehicle keywords found: {count}")
    return count >= 1

# ─── MAIN ANALYZE ENDPOINT ──────────────────────────────────

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    try:
        content = await file.read()
        filename = file.filename
        print(f"\n{'='*60}")
        print(f"Processing: {filename} ({len(content)} bytes)")
        print(f"{'='*60}")

        # Load images from file
        images = load_image(content, filename)
        print(f"Pages/images: {len(images)}")

        # Process all pages, stop when both found
        all_items = []
        pages_scanned = 0
        chassis_result = {'value': None}
        reg_result = {'value': None}

        for img_np in images:
            pages_scanned += 1
            print(f"\nProcessing page {pages_scanned}...")

            # Preprocess
            processed = preprocess_image(img_np)

            # Run OCR
            items = run_ocr(processed)
            print(f"OCR items found: {len(items)}")
            all_items.extend(items)

            if not all_items:
                continue

            # Build text and label map
            full_text, lvm = build_full_text_and_lvm(all_items)
            print(f"LVM entries: {len(lvm)}")

            # Build exclusions
            exclusions = build_exclusions(lvm)

            # Detect values
            chassis_result = detect_chassis(full_text, lvm, exclusions)
            reg_result = detect_registration(full_text, lvm, exclusions)

            print(f"Chassis: {chassis_result['value']}")
            print(f"Registration: {reg_result['value']}")

            # Stop early if both found
            if chassis_result['value'] and reg_result['value']:
                print("Both found - stopping early")
                break

        # Check if vehicle document
        final_text = '\n'.join(
            item['text'] for item in all_items
        )
        is_vehicle = is_vehicle_document(final_text)

        # Determine status
        has_chassis = bool(chassis_result.get('value'))
        has_reg = bool(reg_result.get('value'))
        chassis_is_valid = chassis_result.get('is_valid', False)
        chassis_rejection = chassis_result.get('rejection_reason')
        is_vehicle = is_vehicle_document(final_text)

        if not is_vehicle:
            # No vehicle keywords found at all
            status = 'skipped'
            status_message = (
                'Not in the format of Indian Vehicle Registration '
                'or Chassis Number. Document does not appear to be '
                'a vehicle-related document.'
            )
        elif has_chassis and not chassis_is_valid and chassis_rejection:
            # Chassis found via label but INVALID format
            status = 'invalid'
            status_message = f'INVALID CHASSIS DETECTED: {chassis_rejection}'
        elif has_chassis and chassis_is_valid and has_reg:
            status = 'valid'
            status_message = 'Both chassis and registration detected and valid'
        elif has_chassis and chassis_is_valid:
            status = 'partial'
            status_message = 'Valid chassis found — Registration not detected'
        elif has_reg and not has_chassis:
            status = 'partial'
            status_message = 'Registration found — Chassis not detected'
        elif not has_chassis and not has_reg:
            status = 'skipped'
            status_message = (
                'Not in the format of Indian Vehicle Registration '
                'or Chassis Number. No valid patterns detected in document.'
            )
        else:
            status = 'invalid'
            status_message = 'Document could not be verified'

        return {
            'success': True,
            'filename': filename,
            'status': status,
            'statusMessage': status_message,
            'isVehicleDocument': is_vehicle,
            'chassis': chassis_result,
            'registration': reg_result,
            'pagesScanned': pages_scanned,
            'totalPages': len(images),
            'ocrItemsFound': len(all_items)
        }

    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"ERROR: {error_detail}")
        return JSONResponse(
            status_code=500,
            content={
                'success': False,
                'error': str(e),
                'detail': error_detail,
                'status': 'error',
                'statusMessage': f'Processing error: {str(e)}'
            }
        )

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "engine": "PaddleOCR",
        "version": "2.0",
        "endpoints": ["/health", "/analyze"]
    }

@app.get("/")
async def root():
    return {
        "service": "Verentis OCR Engine",
        "status": "running",
        "health": "/health",
        "analyze": "/analyze"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
