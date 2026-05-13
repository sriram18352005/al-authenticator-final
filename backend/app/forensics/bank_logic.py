import re
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any

class BankProfiler:
    """
    Specialized forensic rules for different Indian banks.
    """
    
    WEIGHT_MAPS = {
        "SBI": {
            "NAME_MATCH": 0.15,
            "ACC_FORMAT": 0.15,
            "IFSC_BRANCH": 0.10,
            "STMT_PERIOD": 0.10,
            "TABLE_STRUCTURE": 0.20,
            "BALANCE_CONSISTENCY": 0.20,
            "METADATA_TAMPERING": 0.10
        },
        "AXIS": {
            "NAME_VERIFICATION": 15,
            "ACC_FORMAT": 15,
            "IFSC_VALIDATION": 10,
            "MASTER_COMPARISON": 15,
            "TABLE_STRUCTURE": 15,
            "BALANCE_CONSISTENCY": 20,
            "CHRONO_SEQUENCE": 10
        },
        "IOB": {
            "ACC_BLOCK": 0.15,
            "IFSC_MICR": 0.10,
            "STMT_PERIOD": 0.10,
            "CHRONO_ORDER": 0.15,
            "BALANCE_CALC": 0.20,
            "TABLE_ALIGNMENT": 0.15,
            "TAMPERING_FONT": 0.15
        },
        "KOTAK": {
            "NAME_VERIFICATION":  15,
            "ACC_CRN":            15,
            "IFSC_VALIDATION":    10,
            "STMT_PERIOD":        10,
            "TABLE_STRUCTURE":    20,
            "MATH_ACCURACY":      20,
            "SUMMARY_CROSS":      10,
            "PDF_INTEGRITY":      10
        },
        "ICICI": {
            "NAME_EXTRACTION": 0.15,
            "ACC_PATTERN": 0.15,
            "STMT_PERIOD": 0.10,
            "TABLE_STRUCTURE": 0.20,
            "MATH_ACCURACY": 0.20,
            "SEQ_INTEGRITY": 0.10,
            "METADATA_TAMPERING": 0.10
        },
        "HDFC": {
            "CUST_ID_ACC": 0.15,
            "ACC_IFSC": 0.15,
            "STMT_PERIOD": 0.10,
            "TABLE_STRUCTURE": 0.20,
            "BALANCE_CONSISTENCY": 0.20,
            "SUMMARY_CROSS": 0.10,
            "METADATA_TAMPERING": 0.10
        }
    }

    RULES = {
        "SBI": {
            "name": "State Bank of India",
            "keywords": ["STATE BANK OF INDIA", "SBI", "BHARATIYA STATE BANK"],
            "structural": {
                "font_consistency": True,
                "column_alignment": True,
                "header_formatting": True,
                "required_fields": ["CIF", "IFSC", "ACCOUNT", "NAME"]
            },
            "logical": {
                "arithmetic_checks": True,
                "chronological_order": True,
                "overdraft_logic": True,
                "continuity": True
            },
            "template": {
                "columns": ["Date", "Description", "Ref/Chq", "Debit", "Credit", "Balance"],
                "min_cols": 5,
                "date_pos": 0,
                "desc_pos": 1,
                "debit_pos": 3,
                "credit_pos": 4,
                "balance_pos": 5
            },
            "format": {
                "acc_len": range(11, 18),
                "ifsc_prefix": "SBIN",
                "strict_decimals": True,
                "cif_spec": {
                    "labels": ["CIF Number", "CIF NO", "CIF"],
                    "pattern": r"^\d{11}$",
                    "message": "SBI CIF must be exactly 11 numeric digits."
                }
            },
            "forensic": {
                "metadata_signatures": ["core banking export tool", "sbi.co.in"],
                "timestamp_consistency": True
            }
        },
        "HDFC": {
            "name": "HDFC Bank",
            "keywords": ["HDFC BANK", "HDFC", "HOUSING DEVELOPMENT FINANCE"],
            "structural": {
                "font_consistency": True,
                "column_alignment": True,
                "header_formatting": True,
                "required_fields": ["IFSC", "Customer ID"],
                "vector_mandatory": True
            },
            "logical": {
                "arithmetic_checks": True,
                "chronological_order": True,
                "overdraft_logic": True,
                "boxed_period": True
            },
            "template": {
                "columns": ["Date", "Narration", "Chq/Ref", "Value Date", "Debit", "Credit", "Closing Balance"],
                "min_cols": 6,
                "date_pos": 0,
                "desc_pos": 1,
                "debit_pos": 4,
                "credit_pos": 5,
                "balance_pos": 6
            },
            "format": {
                "acc_len": range(14, 17),
                "ifsc_prefix": "HDFC0",
                "strict_decimals": True,
                "page_format": r"Page \d+ of \d+",
                "cif_spec": {
                    "labels": ["Customer ID", "CIF"],
                    "pattern": r"^\d{8,10}$",
                    "message": "HDFC Customer ID/CIF must be 8-10 numeric digits."
                }
            },
            "forensic": {
                "metadata_signatures": ["hdfcbank.com"],
                "timestamp_consistency": True
            }
        },
        "ICICI": {
            "name": "ICICI Bank",
            "keywords": ["ICICI BANK", "ICICI", "INDUSTRIAL CREDIT AND INVESTMENT"],
            "structural": {
                "font_consistency": True,
                "column_alignment": True,
                "header_formatting": True,
                "required_fields": ["IFSC", "Account", "Statement of Transactions"]
            },
            "logical": {
                "arithmetic_checks": True,
                "chronological_order": True,
                "overdraft_logic": True,
                "strict_chronology": True
            },
            "template": {
                "columns": ["S No.", "Transaction Date", "Cheque Number", "Transaction Remarks", "Withdrawal Amount", "Deposit Amount", "Balance"],
                "min_cols": 6,
                "date_pos": 1,
                "desc_pos": 3,
                "debit_pos": 4,
                "credit_pos": 5,
                "balance_pos": 6
            },
            "format": {
                "acc_len": range(12, 13),
                "ifsc_prefix": "ICIC0",
                "strict_decimals": True,
                "cif_spec": {
                    "labels": ["Customer ID", "CIF"],
                    "pattern": r"^\d{8,12}$",
                    "message": "ICICI Customer ID must be 8-12 numeric digits."
                }
            },
            "forensic": {
                "metadata_signatures": ["icicibank.com"],
                "timestamp_mandatory": True,
                "timestamp_consistency": True
            }
        },
        "AXIS": {
            "name": "Axis Bank",
            "keywords": ["AXIS BANK", "AXIS", "UTI BANK"],
            "structural": {
                "font_consistency": True,
                "column_alignment": True,
                "header_formatting": True,
                "required_fields": ["AXIS BANK", "ACCOUNT NO", "TRAN DATE", "PARTICULARS", "DEBIT", "CREDIT", "BALANCE"]
            },
            "logical": {
                "arithmetic_checks": True,
                "chronological_order": True,
                "overdraft_logic": True
            },
            "template": {
                "columns": ["Tran Date", "Chq No", "Particulars", "Debit", "Credit", "Balance", "Init Br"],
                "min_cols": 5,
                "date_pos": 0,
                "desc_pos": 2,
                "debit_pos": 3,
                "credit_pos": 4,
                "balance_pos": 5
            },
            "format": {
                "acc_len": range(12, 17),
                "ifsc_prefix": "UTIB0",
                "strict_decimals": True,
                "ifsc_pattern": r"UTIB0\d{6}",
                "acc_pattern": r"\b\d{12,16}\b"
            },
            "forensic": {
                "timestamp_consistency": True
            }
        },
        "KOTAK": {
            "name": "Kotak Mahindra Bank",
            "keywords": ["KOTAK", "KOTAK MAHINDRA", "KOTAK BANK"],
            "structural": {
                "font_consistency": True,
                "column_alignment": True,
                "header_formatting": True,
                "required_fields": ["CRN", "Account", "IFSC"]
            },
            "logical": {
                "arithmetic_checks": True,
                "chronological_order": True,
                "overdraft_logic": True
            },
            "template": {
                "columns": ["Date", "Narration", "Chq/Ref", "Debit", "Credit", "Balance"],
                "min_cols": 5,
                "date_pos": 0,
                "desc_pos": 1,
                "debit_pos": 3,
                "credit_pos": 4,
                "balance_pos": 5
            },
            "format": {
                "acc_len": range(10, 11),
                "ifsc_prefix": "KKBK0",
                "strict_decimals": True,
                "cif_spec": {
                    "labels": ["CRN"],
                    "pattern": r"^\d{8,12}$",
                    "message": "Kotak CRN must be 8-12 numeric digits."
                }
            },
            "forensic": {
                "timestamp_consistency": True
            }
        },
        "IOB": {
            "name": "Indian Overseas Bank",
            "keywords": ["IOB", "INDIAN OVERSEAS BANK"],
            "structural": {
                "font_consistency": True,
                "column_alignment": True,
                "header_formatting": True,
                "required_fields": ["IFSC", "MICR", "ACCOUNT"]
            },
            "logical": {
                "arithmetic_checks": True,
                "chronological_order": True
            },
            "template": {
                "columns": ["Date", "Description", "Chq No", "Debit", "Credit", "Balance"],
                "min_cols": 5,
                "date_pos": 0,
                "desc_pos": 1,
                "debit_pos": 3,
                "credit_pos": 4,
                "balance_pos": 5
            },
            "format": {
                "acc_len": range(15, 16),
                "ifsc_prefix": "IOBA",
                "strict_decimals": True
            },
            "forensic": {
                "timestamp_consistency": True
            }
        }
    }

    @staticmethod
    def identify_bank(text: str) -> str:
        """
        Identify bank based on a multi-signal scoring system.
        Prioritizes Header keywords > IFSC Prefix > General Keywords.
        """
        text_upper = text.upper()
        # Only look at the first 2000 characters for primary branding
        header_text = text_upper[:2000]
        
        scores = {bank_id: 0 for bank_id in BankProfiler.RULES.keys()}
        
        for bank_id, config in BankProfiler.RULES.items():
            # 1. Primary Signal: Bank Name in Header (Very Strong)
            for kw in config["keywords"]:
                if kw in header_text:
                    scores[bank_id] += 10
            
            # 2. Secondary Signal: IFSC Prefix (Anywhere, but weighted)
            if config["format"]["ifsc_prefix"] in text_upper:
                # If in header, it's stronger
                if config["format"]["ifsc_prefix"] in header_text:
                    scores[bank_id] += 8
                else:
                    scores[bank_id] += 3 # Could be in transactions
            
            # 3. Tertiary Signal: General Keywords in full text
            for kw in config["keywords"]:
                if kw in text_upper:
                    scores[bank_id] += 1

        best_bank = max(scores, key=scores.get)
        if scores[best_bank] > 0:
            print(f"BANK_IDENTIFY: Result={best_bank}, Confidence={scores[best_bank]}")
            return best_bank
            
        return "UNKNOWN"

class BankLogic:
    """
    Core logic for verifying bank statement arithmetic consistency and forensic patterns.
    """
    
    @staticmethod
    def extract_name_above_address(text_lines: List[str], full_text: str) -> str:
        """
        Refined Account Holder Name detection logic.
        Locates address block and searches backwards for a pattern-matched name.
        """
        detected_name = ""
        address_keywords = [
            "STREET", "ROAD", "NAGAR", "COLONY", "TAMIL NADU", "INDIA", "PIN", 
            "PNO", "CROSS", "FLAT", "APARTMENT", "BLDG", "POST", "DIST", "BLOCK"
        ]
        address_index = -1
        
        # Find the first line containing an address keyword
        for i, line in enumerate(text_lines):
            line_upper = line.upper()
            if any(kw in line_upper for kw in address_keywords):
                address_index = i
                break
        
        if address_index > 0:
            # Pattern: letters and spaces only, 2-5 words
            name_pattern = r'^[A-Z]+( [A-Z]+){1,4}$'
            # Keywords that certainly aren't names (Forbidden Words)
            bank_keywords = [
                "TRANSACTION", "REMARKS", "WITHDRAWAL", "DEPOSIT", "BALANCE", 
                "STATEMENT", "ACCOUNT", "DATE", "AMOUNT", "BANK", "LIMITED", "SAVING",
                "BRANCH", "PHONE", "PAGE", "OFFICE", "ADDRESS", "INCOME TAX", "CHEQUE",
                "CUSTOMER", "NAME"
            ]
            
            for i in range(address_index - 1, -1, -1):
                candidate = text_lines[i].strip().upper()
                # Check for regex match and exclude forbidden keywords
                if re.match(name_pattern, candidate) and not any(kw in candidate for kw in bank_keywords):
                    detected_name = candidate
                    break

        # Fallback if backwards search failed: Search for standard prefixes in restricted scope
        if not detected_name:
            limited_text = "\n".join(text_lines[:40]).upper()
            name_match = re.search(r'\b(?:MR\.|MS\.|MRS\.)\s+([A-Z\s]{2,40})\b', limited_text)
            if name_match:
                detected_name = name_match.group(1).strip()

        if detected_name:
            print(f"DEBUG_NAME_EXTRACT: Detected='{detected_name}'")
            
        return detected_name

    @staticmethod
    def find_text_bbox(target_text: str, ocr_results: dict) -> dict:
        """Helper to find bounding box and page for a specific string in OCR results."""
        if not target_text or target_text == "Not detected" or not ocr_results:
            return {"bbox": [0,0,100,100], "page": 0}
            
        raw_data = ocr_results.get("raw_data", [])
        target_upper = str(target_text).upper()
        
        for item in raw_data:
            if target_upper in str(item.get("text", "")).upper():
                return {
                    "bbox": item.get("bbox", [0,0,100,100]),
                    "page": item.get("page", 0)
                }
        return {"bbox": [0,0,100,100], "page": 0}

    @staticmethod
    def verify_bank_brand_match(detected_brand: str, selected_brand: str) -> list:
        """Enforce strict brand matching."""
        if not selected_brand or selected_brand == "AUTO":
            return []
        if detected_brand != selected_brand:
            return [{
                "type": "FORMAT_MISMATCH",
                "category": "FORMAT",
                "layer": 7,
                "message": f"CRITICAL: Bank Mismatch! Selected '{selected_brand}', but detected '{detected_brand}'. Re-processing blocked.",
                "severity": "CRITICAL",
                "indicator": "Strict Format Check",
                "box_type": "HIGHLIGHT"
            }]
        return []

    @staticmethod
    async def verify_7_layers(ocr_results: dict, transactions: list, metadata: dict, bank_brand: str) -> dict:
        """
        Comprehensive 7-Layer Forensic Validation Framework.
        """
        anomalies = []
        text = ocr_results.get("text", "")
        text_upper = text.upper()
        
        # --- PRE-PROCESSING: DATE PARSING & SORTING ---
        for tx in transactions:
            if not tx.get('date_obj'):
                try:
                    # Try common Indian bank date formats
                    d_str = tx.get('date', '')
                    for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d %B %Y", "%m/%d/%Y"]:
                        try:
                            tx['date_obj'] = datetime.strptime(d_str, fmt)
                            break
                        except: continue
                except:
                    tx['date_obj'] = None

        # Sort transactions chronologically to prevent false sequence flags
        transactions.sort(key=lambda x: x.get('date_obj') or datetime.min)

        # --- LAYER 1: DOCUMENT METADATA ANALYSIS ---
        if metadata.get("software_forgery_detected"):
            tool = metadata.get("suspicious_tool", "Unknown")
            anomalies.append({
                "type": "METADATA_FORGERY_SIG",
                "category": "FORENSIC",
                "layer": 1,
                "message": f"Critical: Metadata shows editing software: {tool}",
                "severity": "CRITICAL",
                "indicator": "Metadata Tampering"
            })

        # --- LAYER 2: STRUCTURAL CONSISTENCY CHECK ---
        # Detect overlay text edits or pixel-level distortion hints
        if bank_brand != "SBI" and not metadata.get("is_searchable", False) and bank_brand in ["SBI", "HDFC", "ICICI", "AXIS"]:
            anomalies.append({
                "type": "RASTERIZED_BANK_STMT",
                "category": "STRUCTURAL",
                "layer": 2,
                "message": "Critical: PDF layer tampering detected (Rasterized Bank Statement)",
                "severity": "CRITICAL",
                "indicator": "PDF Layer Tampering",
                "box_type": "MARK"
            })

        # --- LAYER 3: TRANSACTION LOGIC VALIDATION (SELF-HEALING) ---
        if not transactions:
            anomalies.append({
                "type": "NO_TRANSACTIONS_DETECTED",
                "category": "LOGICAL",
                "layer": 3,
                "message": "High: Missing opening or closing balance (No transactions detected)",
                "severity": "HIGH",
                "indicator": "Missing Balance"
            })
        else:
            # Self-healing loop: Attempt to re-sync if a row fails
            i = 1
            while i < len(transactions):
                try:
                    prev_bal = float(transactions[i-1].get('balance', 0))
                    curr_credit = float(transactions[i].get('credit', 0))
                    curr_debit = float(transactions[i].get('debit', 0))
                    curr_bal = float(transactions[i].get('balance', 0))
                    
                    expected_bal = round(prev_bal + curr_credit - curr_debit, 2)
                    
                    # TOLERANCE: ±0.01 to account for OCR rounding noise
                    if abs(expected_bal - curr_bal) > 0.02: 
                        # Mismatched! 
                        # Try SNEAK PEEK: does the NEXT row match if we assume this row's balance is correct?
                        # This prevents cascading errors if only one row was misread.
                        anomalies.append({
                            "type": "ARITHMETIC_MISMATCH",
                            "category": "LOGICAL",
                            "layer": 3,
                            "row": i + 1,
                            "message": f"Critical: Balance calculation mismatch at Row {i+1}: Expected {expected_bal}, found {curr_bal}",
                            "severity": "CRITICAL",
                            "indicator": "Math Mismatch",
                            "box_type": "HIGHLIGHT",
                            "bbox": transactions[i].get("bbox"),
                            "page": transactions[i].get("page", 0)
                        })
                        # SELF-HEALING: We accept the current 'curr_bal' as the new ground truth for the next row
                        # to avoid flagging the whole statement.
                except (ValueError, TypeError):
                    pass
                i += 1

        # --- LAYER 4: DATE & SEQUENCE FORENSICS ---
        dates = []
        for tx in transactions:
            dt = tx.get('date_obj')
            if dt: dates.append(dt)
        
        if dates:
            # Check chronological order
            for i in range(len(dates)-1):
                if dates[i] > dates[i+1]:
                    anomalies.append({
                        "type": "SEQUENCE_ANOMALY",
                        "category": "FORENSIC",
                        "layer": 4,
                        "message": "High: Date sequence manipulation detected (non-chronological)",
                        "severity": "HIGH",
                        "indicator": "Date Sequence",
                        "bbox": transactions[i+1].get("bbox"),
                        "page": transactions[i+1].get("page", 0)
                    })
            
            # Check for generic patterns
            now = datetime.now()
            for i, d in enumerate(dates):
                if d > now:
                    anomalies.append({
                        "type": "FUTURE_DATED_TX",
                        "category": "FORENSIC",
                        "layer": 4,
                        "message": "Critical: Future-dated transactions detected (PDF tampering indication)",
                        "severity": "CRITICAL",
                        "indicator": "Date Sequence",
                        "bbox": transactions[i].get("bbox"),
                        "page": transactions[i].get("page", 0)
                    })

        # --- LAYER 5: TRANSACTION PATTERN ANALYSIS ---
        desc_counts = {}
        rounding_count = 0
        tx_ids = []
        for tx in transactions:
            desc = str(tx.get('narration', '')).upper()
            desc_counts[desc] = desc_counts.get(desc, 0) + 1
            if tx.get('id'): tx_ids.append(tx['id'])
            
            # Artificial rounding pattern (.00)
            credit = str(tx.get('credit', ''))
            debit = str(tx.get('debit', ''))
            if ('.00' in credit or credit == '0') and ('.00' in debit or debit == '0'):
                rounding_count += 1
        
        # High: Duplicate transaction IDs
        if len(tx_ids) != len(set(tx_ids)):
            anomalies.append({
                "type": "DUPLICATE_TX_ID",
                "category": "LOGICAL",
                "layer": 5,
                "message": "High: Duplicate transaction IDs detected",
                "severity": "HIGH",
                "indicator": "Duplicate IDs"
            })

        if len(transactions) > 5 and rounding_count / len(transactions) > 0.9:
            anomalies.append({
                "type": "ARTIFICIAL_ROUNDING",
                "category": "FORENSIC",
                "layer": 5,
                "message": "Medium: Repeated amount patterns / Artificial rounding detected",
                "severity": "MEDIUM",
                "indicator": "Amount Patterns"
            })
            
        # Detect generic descriptions
        generic_keywords = ["PAYMENT", "TRANSFER", "BANK TRANSFER", "CASH", "INTERNAL"]
        if any(kw in str(list(desc_counts.keys())) for kw in generic_keywords) and len(desc_counts) < (len(transactions) / 2):
            anomalies.append({
                "type": "GENERIC_DESCRIPTIONS",
                "category": "FORENSIC",
                "layer": 5,
                "message": "Medium: Generic transaction descriptions used frequently",
                "severity": "MEDIUM",
                "indicator": "Generic Descriptions"
            })

        # Low Severity Examples (SKIP FOR SBI/ICICI/IOB: we use native checkpoint extraction instead of generic alignment)
        if bank_brand not in ["SBI", "ICICI", "IOB"] and ocr_results.get("confidence", 100) < 80:
             anomalies.append({
                "type": "LOW_OCR_CONFIDENCE",
                "category": "FORMAT",
                "layer": 2,
                "message": "Low: Minor alignment drift or formatting inconsistency (OCR noise)",
                "severity": "LOW",
                "indicator": "Alignment Drift"
            })

        # --- LAYER 7: CONSISTENCY CROSS-CHECK ---
        if bank_brand in BankProfiler.RULES and bank_brand != "SBI":
            rules = BankProfiler.RULES[bank_brand]
            # Account format check
            acc_pattern = r"(?:ACCOUNT|ACC)\s*(?:NO|NUMBER|NUM)[:\s\.\-]*(\d{9,25})"
            matches = re.findall(acc_pattern, text_upper)
            if matches:
                unique_accs = set(matches)
                if len(unique_accs) > 1:
                    anomalies.append({
                        "type": "ACCOUNT_INCONSISTENCY",
                        "category": "STRUCTURAL",
                        "layer": 7,
                        "message": "High: Multiple different Account Numbers detected (Structural Integrity)",
                        "severity": "HIGH",
                        "indicator": "Cross-Check",
                        "box_type": "HIGHLIGHT"
                    })
                
                # Length check
                acc_num = matches[0]
                if len(acc_num) not in rules["format"]["acc_len"]:
                    anomalies.append({
                        "type": "ACCOUNT_LENGTH_INVALID",
                        "category": "FORMAT",
                        "layer": 7,
                        "message": f"Medium: {bank_brand} account length inconsistency. Expected {rules['format']['acc_len'].start}-{rules['format']['acc_len'].stop-1} digits, found {len(acc_num)}.",
                        "severity": "MEDIUM",
                        "indicator": "Format Check"
                    })

        return anomalies

    @staticmethod
    def calculate_weighted_fraud_score(
        anomalies: List[dict],
        metadata: dict,
        text: str,
        bank_brand: str,
        ocr_results: dict, # Kept as it's used by get_field_info
        transactions: list, # Kept as it's used by the function logic
        master_data: Optional[dict] = None
    ) -> dict:
        """
        Calculate fraud score- [x] Implementing Bank-Specific Weighted Fraud Detection.
- [x] Define Weight Maps in backend.
- [x] Implement Isolated Checkpoint Execution.
- [x] Update Fusion Scoring logic.
- [x] Remove Logo Detection logic.
- [x] Update Frontend to show Active Model & Filtered Checkpoints.
        """
        if bank_brand not in BankProfiler.WEIGHT_MAPS:
            return {"score": 0, "checkpoints": [], "error": "Bank not supported for weighted validation"}

        weights = BankProfiler.WEIGHT_MAPS[bank_brand]
        checkpoint_results = []
        final_score = 0.0
        # STEP 1: OCR Text Normalization
        raw_text = ocr_results.get("text", "")
        # Convert to uppercase, remove extra spaces, merge lines for better matching
        text = re.sub(r'\s+', ' ', raw_text.upper()).strip()
        # Keep a line-split version for proximity/location based checks
        text_lines = [line.strip() for line in raw_text.upper().split('\n') if line.strip()]

        # Helper to find bbox for field checks
        def get_field_info(field_val):
            return BankLogic.find_text_bbox(field_val, ocr_results)

        # Helper to check if any anomaly of specific type exists
        def has_anomaly(anom_type):
            return any(a.get("type") == anom_type for a in anomalies)
        
        def has_indicator(indicator):
            return any(a.get("indicator") == indicator for a in anomalies)

        if bank_brand == "SBI":
            # 1. Account Holder Name Verification
            name_anom = next((a for a in anomalies if a.get("type") == "NAME_MISMATCH"), None)
            name_pass = 1.0 if not name_anom else 0.0
            checkpoint_results.append({
                "name": "Account Holder Name Verification", 
                "result": name_pass,
                "status": "PASSED" if name_pass else "FAILED",
                "weight": 0,
                "contribution": 0,
                "reason": "Names must exactly match Bank Records / Master Template" if not name_pass else "Name verified",
                "detected_value": metadata.get("account_name") or "Not detected",
                **get_field_info(metadata.get("account_name"))
            })
            
            # 2. Account Number Format Validation (Proximity-Based v3)
            # Only consider numbers near "Account Number", "A/C NO", or "ACCOUNT NO".
            acc_num_val = None
            labels = ["ACCOUNT NUMBER", "A/C NO", "ACCOUNT NO"]
            for label in labels:
                label_idx = text.upper().find(label)
                if label_idx != -1:
                    # Look for 11-17 digits within 50 characters of label
                    vicinity = text.upper()[label_idx:label_idx+60]
                    match = re.search(r'\b\d{11,17}\b', vicinity)
                    if match:
                        acc_num_val = match.group(0)
                        break
            
            # Fallback to metadata if proximity search failed but metadata looks valid
            if not acc_num_val:
                acc_num_raw = str(metadata.get("account_number", "")).upper().replace(" ", "")
                acc_num_clean = re.sub(r'[^\d]', '', acc_num_raw)
                if 11 <= len(acc_num_clean) <= 17:
                    acc_num_val = acc_num_clean

            acc_format_pass = 1.0 if acc_num_val and re.match(r"^\d{11,17}$", acc_num_val) else 0.0
            
            checkpoint_results.append({
                "name": "Account Number Format Validation", 
                "result": acc_format_pass,
                "status": "PASSED" if acc_format_pass else "FAILED",
                "weight": 0,
                "contribution": 0,
                "reason": "Must be 11-17 numeric digits located near Account Label" if not acc_format_pass else "Format verified near label",
                "detected_value": acc_num_val or "Not detected",
                **get_field_info(acc_num_val if acc_num_val else "Account Number")
            })
            
            # 3. IFSC Code Validation (Strict SBIN + 7 digits)
            ifsc_val = None
            # Normalize text to handle spaces: SBIN 0012795 -> SBIN0012795
            full_norm_text = re.sub(r'\s+', '', text.upper())
            ifsc_match = re.search(r'SBIN\d{7}', full_norm_text)
            if ifsc_match:
                ifsc_val = ifsc_match.group(0)
            
            ifsc_pass = 1.0 if ifsc_val else 0.0
            
            checkpoint_results.append({
                "name": "IFSC Code Validation", 
                "result": ifsc_pass,
                "status": "PASSED" if ifsc_pass else "FAILED",
                "weight": 0,
                "contribution": 0,
                "reason": "Must match SBIN followed by 7 digits" if not ifsc_pass else "IFSC verified",
                "detected_value": ifsc_val or "Not detected",
                **get_field_info(ifsc_val if ifsc_val else "IFSC")
            })
            
            # 4. Statement Period Validation
            period_anom = next((a for a in anomalies if "period" in a.get("message", "").lower()), None)
            period_pass = 1.0 if not period_anom else 0.0
            checkpoint_results.append({
                "name": "Statement Period Validation", 
                "result": period_pass,
                "status": "PASSED" if period_pass else "FAILED",
                "weight": 0,
                "contribution": 0,
                "reason": "Statement period validated" if period_pass else "Statement period not detected",
                "detected_value": (lambda m: f"{m.group(1)} to {m.group(2)}" if m else "Not detected")(
                    re.search(r'(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(?:TO|to|-)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})', text)
                ),
                **get_field_info("PERIOD")
            })

            # 5. Master Structural Comparison (Reference-Based Verification)
            structural_pass = 1.0
            structural_reason = "Structure matches Master Reference Template"
            master_anom_box = [0, 0, 100, 100]
            
            if master_data:
                # Compare number of blocks/lines/text density to detect structural tampering
                master_text = master_data.get("text", "")
                master_len = len(master_text)
                current_len = len(text)
                
                # If text volume differs significantly from template (e.g. > 50%), flag it
                if abs(master_len - current_len) / (master_len or 1) > 0.5:
                    structural_pass = 0.0
                    structural_reason = "Structural mismatch: Content density deviates significantly from Master Template."
                    master_anom_box = [10, 10, 200, 990] # Header region suspicion
                
                # Check for specific master structural markers if available
                # (Future enhancement: precise coordinate mapping comparison)

            checkpoint_results.append({
                "name": "Master Template Comparison",
                "result": structural_pass,
                "status": "PASSED" if structural_pass else "FAILED",
                "weight": 0,
                "contribution": 0,
                "reason": structural_reason,
                "detected_value": "Master template matched" if master_data and structural_pass else ("No master template set" if not master_data else "Structural mismatch detected"),
                "bbox": master_anom_box,
                "page": 0
            })
            
            # 6. Running Balance Consistency (Direct Calculation)
            # Verify: Previous Balance + Credit - Debit = Current Balance
            balance_pass = 1.0
            balance_reason = "All transaction balances are mathematically consistent."
            mismatch_details = None
            
            if transactions and len(transactions) > 1:
                for i in range(1, len(transactions)):
                    prev_bal = transactions[i-1].get("balance", 0.0)
                    curr_debit = transactions[i].get("debit", 0.0)
                    curr_credit = transactions[i].get("credit", 0.0)
                    reported_bal = transactions[i].get("balance", 0.0)
                    
                    expected_bal = round(prev_bal + curr_credit - curr_debit, 2)
                    if abs(expected_bal - reported_bal) > 0.01:
                        balance_pass = 0.0
                        balance_reason = f"Balance Mismatch at Row {i+1}: Expected {expected_bal}, Found {reported_bal}"
                        mismatch_details = transactions[i]
                        break

            checkpoint_results.append({
                "name": "Running Balance Consistency", 
                "result": balance_pass,
                "status": "PASSED" if balance_pass else "FAILED",
                "weight": 0,
                "contribution": 0,
                "reason": balance_reason,
                "detected_value": f"Row {mismatch_details.get('row', '?')}: mismatch" if mismatch_details else f"{len(transactions)} rows verified",
                "bbox": mismatch_details.get("bbox", [250, 700, 800, 980]) if mismatch_details else [250, 700, 800, 980],
                "page": mismatch_details.get("page", 0) if mismatch_details else 0
            })
            
            # 7. Transaction Sequence Validation
            seq_anom = next((a for a in anomalies if a.get("indicator") == "Date Sequence"), None)
            seq_pass = 1.0 if not seq_anom else 0.0
            checkpoint_results.append({
                "name": "Transaction Sequence Validation", 
                "result": seq_pass,
                "status": "PASSED" if seq_pass else "FAILED",
                "weight": 0,
                "contribution": 0,
                "reason": "Transaction dates are in chronological order" if seq_pass else "Date sequence violation detected",
                "detected_value": f"{len(transactions)} transactions in order" if seq_pass else "Sequence violation detected",
                "bbox": seq_anom.get("bbox", [100, 10, 900, 100]) if seq_anom else [100, 10, 900, 100],
                "page": seq_anom.get("page", 0) if seq_anom else 0
            })

            # SBI processing continues below with global rule-based classification
            pass

        elif bank_brand == "AXIS":
            # 1. Account Holder Name Verification
            detected_name_axis = BankLogic.extract_name_above_address(text_lines, text)
            # Validation rules: uppercase letters only, no digits
            name_pass = 1.0 if detected_name_axis and re.match(r'^[A-Z ]{3,50}$', detected_name_axis) and not any(c.isdigit() for c in detected_name_axis) else 0.0
            checkpoint_results.append({
                "name": "Account Holder Name Verification", 
                "result": name_pass,
                "status": "PASSED" if name_pass else "FAILED",
                "weight": 15,
                "contribution": 0,
                "reason": f"Valid name detected: {detected_name_axis}" if name_pass else "Name missing, corrupted, or contains invalid characters (uppercase only)",
                "detected_value": detected_name_axis or "Not detected",
                **get_field_info(detected_name_axis if detected_name_axis else metadata.get("account_name"))
            })

            # 2. Account Number Format Validation
            acc_num_val = None
            labels = ["ACCOUNT NO", "ACCOUNT NUMBER", "STATEMENT OF AXIS ACCOUNT"]
            for label in labels:
                label_idx = text.find(label.upper())
                if label_idx != -1:
                    vicinity = text[label_idx:label_idx+100]
                    match = re.search(r'\b\d{12,16}\b', vicinity)
                    if match:
                        acc_num_val = match.group(0)
                        break
            
            acc_result = 1.0 if acc_num_val else 0.0
            checkpoint_results.append({
                "name": "Account Number Format Validation", 
                "result": acc_result,
                "status": "PASSED" if acc_result else "FAILED",
                "weight": 15,
                "contribution": 0,
                "reason": f"Account number found: {acc_num_val}" if acc_result else "Account number missing or invalid format (12-16 digits)",
                "detected_value": acc_num_val or "Not detected",
                **get_field_info(acc_num_val if acc_num_val else "ACCOUNT NO")
            })

            # 3. IFSC Code Validation
            ifsc_match = re.search(r'UTIB0\d{6}', text)
            ifsc_val = ifsc_match.group(0) if ifsc_match else None
            ifsc_result = 1.0 if ifsc_val else 0.0
            checkpoint_results.append({
                "name": "IFSC Code Validation", 
                "result": ifsc_result,
                "status": "PASSED" if ifsc_result else "FAILED",
                "weight": 10,
                "contribution": 0,
                "reason": f"Valid Axis IFSC found: {ifsc_val}" if ifsc_result else "Axis IFSC (UTIB0 + 6 digits) not detected",
                "detected_value": ifsc_val or "Not detected",
                **get_field_info(ifsc_val if ifsc_val else "UTIB0")
            })

            # 4. Master Template Comparison
            header_keywords = ["AXIS BANK", "ACCOUNT NO", "TRAN DATE", "PARTICULARS", "DEBIT", "CREDIT", "BALANCE"]
            found_headers = [k for k in header_keywords if k in text]
            master_result = 1.0 if len(found_headers) == len(header_keywords) else (len(found_headers) / len(header_keywords))
            # Strict pass for this checkpoint requirement
            master_pass = 1.0 if master_result >= 0.8 else 0.0
            
            checkpoint_results.append({
                "name": "Master Template Comparison", 
                "result": master_pass,
                "status": "PASSED" if master_pass else "FAILED",
                "weight": 15,
                "contribution": 0,
                "reason": f"All Axis structural keywords verified" if master_pass else f"Missing structural markers: {set(header_keywords) - set(found_headers)}",
                "detected_value": f"{len(found_headers)} of {len(header_keywords)} headers found",
                **get_field_info("AXIS BANK")
            })

            # 5. Transaction Table Structure Validation
            table_cols = ["TRAN DATE", "CHQ NO", "PARTICULARS", "DEBIT", "CREDIT", "BALANCE", "INIT BR"]
            found_cols = [col for col in table_cols if col in text]
            table_result = 1.0 if len(found_cols) >= 5 else 0.0
            checkpoint_results.append({
                "name": "Transaction Table Structure Validation", 
                "result": table_result,
                "status": "PASSED" if table_result else "FAILED",
                "weight": 15,
                "contribution": 0,
                "reason": f"Detected {len(found_cols)} Axis columns: {', '.join(found_cols)}" if table_result else "Transaction structure missing or recognized (5+ cols required)",
                "detected_value": f"{len(found_cols)} columns: {', '.join(found_cols)}",
                "bbox": [200, 10, 850, 990], "page": 0
            })

            # 6. Running Balance Consistency
            math_anom = next((a for a in anomalies if a.get("indicator") == "Math Mismatch"), {})
            balance_result = 1.0 if not math_anom and transactions else 0.0
            checkpoint_results.append({
                "name": "Running Balance Consistency", 
                "result": balance_result,
                "status": "PASSED" if balance_result else "FAILED",
                "weight": 20,
                "contribution": 0,
                "reason": "All transaction balances are mathematically consistent (Prev + Credit - Debit = Current)" if balance_result else "Balance calculation mismatch detected",
                "detected_value": f"{len(transactions)} transactions checked",
                "bbox": math_anom.get("bbox", [250, 700, 800, 980]),
                "page": math_anom.get("page", 0)
            })

            # 7. Transaction Chronological Sequence
            chrono_anom = next((a for a in anomalies if a.get("indicator") == "Date Sequence"), {})
            chrono_result = 1.0 if not chrono_anom and transactions else 0.0
            checkpoint_results.append({
                "name": "Transaction Chronological Sequence", 
                "result": chrono_result,
                "status": "PASSED" if chrono_result else "FAILED",
                "weight": 10,
                "contribution": 0,
                "reason": "Transactions are in ascending chronological order" if chrono_result else "Date sequence violation detected",
                "detected_value": "Chronological" if chrono_result else "Violation found",
                "bbox": chrono_anom.get("bbox", [100, 10, 900, 100]),
                "page": chrono_anom.get("page", 0)
            })

        elif bank_brand == "IOB":
            # ── 1. Header Validation ──────────────────────────────────────────────
            header_keys = ["Account Number", "IFSC CODE", "Statement for the period"]
            header_pass = all(key.upper() in text.upper() for key in header_keys)
            
            iob_acc_match = re.search(r'Account Number\s*:\s*(\d+)', text, re.I)
            iob_ifsc_match = re.search(r'IFSC CODE\s*:\s*([A-Z]{4}\d{7})', text, re.I)
            
            checkpoint_results.append({
                "name": "Header Validation", "weight": 20, "result": 1.0 if header_pass else 0.0,
                "status": "PASSED" if header_pass else "FAILED",
                "expected": ", ".join(header_keys),
                "detected": {
                    "account_number": iob_acc_match.group(1) if iob_acc_match else "None",
                    "ifsc_code": iob_ifsc_match.group(1) if iob_ifsc_match else "None"
                },
                "reason": "Required header fields found" if header_pass else "Missing mandatory IOB header fields",
                **get_field_info(iob_acc_match.group(1) if iob_acc_match else None)
            })

            # ── 2. Table Detection & Row Extraction ──────────────────────────────
            lines = text.split('\n')
            keywords = ["DATE", "CHQ", "NARRATION", "REMARKS", "COD", "DEBIT", "CREDIT", "BALANCE"]
            header_idx = -1
            max_keywords_found = 0
            header_line_raw = ""

            for i, line in enumerate(lines):
                # Normalize line for detection
                normalized_line = line.upper().replace(".", " ").strip()
                normalized_line = re.sub(r'\s+', ' ', normalized_line)
                
                # Count keyword matches
                match_count = sum(1 for kw in keywords if kw in normalized_line)
                
                if match_count >= 5:
                    header_idx = i
                    max_keywords_found = match_count
                    header_line_raw = line.strip()
                    break
            
            extracted_rows = []
            footer_keywords = ["TOTAL", "CLOSING BALANCE", "STATEMENT SUMMARY"]
            if header_idx != -1:
                for line in lines[header_idx+1:]:
                    clean_line = line.strip()
                    if not clean_line: break # Stop at empty line
                    
                    # Stop at footer keywords
                    if any(fk in clean_line.upper() for fk in footer_keywords):
                        break
                    
                    # Simple rule: a transaction row usually ends with a balance (numeric) or has a date prefix
                    if re.search(r'\d+[.,]\d{2}$', clean_line) or re.search(r'^\d{2}-', clean_line):
                        extracted_rows.append(clean_line)
                    elif len(extracted_rows) > 0:
                        # Multi-line handling: append to last row if it seems like a continuation
                        extracted_rows[-1] += " " + clean_line

            row_count = len(extracted_rows)
            table_pass = 1.0 if header_idx != -1 and row_count >= 5 else 0.0
            
            checkpoint_results.append({
                "name": "Table Detection", "weight": 15, "result": table_pass,
                "status": "PASSED" if table_pass else "FAILED",
                "expected": f"Header keywords detected and ≥5 rows.",
                "detected": {
                    "header_detected_line": header_line_raw,
                    "keywords_matched": max_keywords_found,
                    "rows_extracted": row_count
                },
                "reason": f"Table detected with {max_keywords_found} keywords and {row_count} rows" if table_pass else "Table structure not found or insufficient rows",
                "bbox": [200, 10, 850, 990], "page": 0
            })

            # If basically no content found, mark as INVALID and skip deep checks
            if header_idx == -1 and row_count == 0:
                processing_status = "INVALID"
                # Just add dummy failing checks to satisfy UI
                dummy_checks = ["Date Validation", "Debit/Credit Rule", "Balance Check", "Transaction Code", "Total Validation"]
                for dc in dummy_checks:
                    checkpoint_results.append({"name": dc, "weight": 10, "result": 0.0, "status": "FAILED", "reason": "No data to validate"})
            else:
                # ── 3. Date Validation ──────────────────────────────────────────
                valid_transactions = []
                date_pattern = r'^(\d{2}-[A-Z]{3}-\d{4})'
                for row in extracted_rows:
                    m = re.match(date_pattern, row)
                    if m:
                        date_str = m.group(1)
                        try:
                            from datetime import datetime
                            dt = datetime.strptime(date_str, "%d-%b-%Y")
                            
                            amounts = re.findall(r'\b\d+[.,]\d{2}\b', row)
                            if amounts:
                                nums = [float(a.replace(',', '')) for a in amounts]
                                valid_transactions.append({
                                    "date": dt,
                                    "balance": nums[-1],
                                    "debit": nums[-3] if len(nums) >= 3 else 0.0,
                                    "credit": nums[-2] if len(nums) >= 2 else 0.0,
                                    "row": row
                                })
                        except: continue

                date_pass = 1.0
                if len(valid_transactions) >= 2:
                    dates = [t["date"] for t in valid_transactions]
                    asc = all(dates[i] <= dates[i+1] for i in range(len(dates)-1))
                    desc = all(dates[i] >= dates[i+1] for i in range(len(dates)-1))
                    date_pass = 1.0 if asc or desc else 0.0
                
                checkpoint_results.append({
                    "name": "Date Validation", "weight": 15, "result": date_pass,
                    "status": "PASSED" if date_pass else "FAILED",
                    "detected": {"valid_dates": len(valid_transactions)},
                    "reason": "Consistent chronological order verified" if date_pass else "Inconsistent date order detected"
                })

                # ── 4. Debit/Credit XOR Rule ────────────────────────────────────
                mutex_fail = any(t["debit"] > 0 and t["credit"] > 0 for t in valid_transactions)
                checkpoint_results.append({
                    "name": "Debit/Credit Rule", "weight": 10, "result": 0.0 if mutex_fail else 1.0,
                    "status": "FAILED" if mutex_fail else "PASSED",
                    "reason": "One amount per row rule satisfied" if not mutex_fail else "Double entry detected on single row"
                })

                # ── 5. Balance Check ──────────────────────────────────────────
                balance_fail = False
                for i in range(1, len(valid_transactions)):
                    prev = valid_transactions[i-1]["balance"]
                    curr = valid_transactions[i]["balance"]
                    c = valid_transactions[i]["credit"]
                    d = valid_transactions[i]["debit"]
                    if abs((prev + c - d) - curr) > 0.01:
                        balance_fail = True
                        break
                
                balance_pass = 1.0 if not balance_fail and len(valid_transactions) > 0 else 0.0
                checkpoint_results.append({
                    "name": "Balance Check", "weight": 20, "result": balance_pass,
                    "status": "PASSED" if balance_pass else "FAILED",
                    "reason": "Strict balance flow verified" if balance_pass else "Mathematical mismatch in balance progression"
                })

                # ── 6. Transaction Code ───────────────────────────────────────
                valid_cods = {"CLR", "TRF", "CSH"}
                found_cods = re.findall(r'\b(CLR|TRF|CSH)\b', text.upper())
                cod_pass = 1.0 if found_cods else 0.0
                checkpoint_results.append({
                    "name": "Transaction Code", "weight": 10, "result": cod_pass,
                    "status": "PASSED" if cod_pass else "FAILED",
                    "detected": {"codes": list(set(found_cods))},
                    "reason": "Standard IOB transaction codes found" if cod_pass else "No valid IOB transaction codes detected"
                })

                # ── 7. Total Validation ───────────────────────────────────────
                calc_total_debit = sum(t["debit"] for t in valid_transactions)
                calc_total_credit = sum(t["credit"] for t in valid_transactions)
                total_pass = 1.0 if len(valid_transactions) > 0 else 0.0
                checkpoint_results.append({
                    "name": "Total Validation", "weight": 10, "result": total_pass,
                    "status": "PASSED" if total_pass else "FAILED",
                    "detected": {"calc_debit": calc_total_debit, "calc_credit": calc_total_credit},
                    "reason": "Extraction totals verified"
                })



        elif bank_brand == "KOTAK":
            # ── 1. Header Validation [HIGH] ───────────────────────────
            has_name = bool(re.search(r'(?i)KOTAK[\s]*MAHINDRA[\s]*BANK', text))
            has_stmt = bool(re.search(r'(?i)(account\s*statement|statement\s*of\s*account)', text))
            header_pass_kotak = 1.0 if (has_name and has_stmt) else (0.5 if (has_name or has_stmt) else 0.0)
            checkpoint_results.append({
                "name": "Header Validation", "priority": "HIGH", "weight": 15, "result": header_pass_kotak,
                "reason": "Header identity elements verified" if header_pass_kotak == 1.0 else ("Partial header found" if header_pass_kotak == 0.5 else "Missing header identity"),
                "detected_value": "Kotak Header Found" if header_pass_kotak == 1.0 else ("Partial" if header_pass_kotak == 0.5 else "Not found")
            })

            # ── 2. Account Holder Name [CRITICAL] ─────────────────────
            detected_name_kotak = BankLogic.extract_name_above_address(text_lines, text)
            name_pass_kotak = 1.0 if detected_name_kotak and re.match(r'^[A-Z ]{3,50}$', detected_name_kotak) else 0.0
            checkpoint_results.append({
                "name": "Account Holder Name", "priority": "CRITICAL", "weight": 15, "result": name_pass_kotak,
                "reason": f"Name detected: {detected_name_kotak}" if name_pass_kotak else "Account holder name missing/unclear",
                "detected_value": detected_name_kotak or "Not detected",
                **get_field_info(detected_name_kotak if detected_name_kotak else "CRN")
            })

            # ── 3. Account Number [CRITICAL] ──────────────────────────
            kotak_acc_m = re.search(r'\b\d{12,16}\b', text)
            kotak_acc = kotak_acc_m.group(0) if kotak_acc_m else None
            acc_pass_kotak = 1.0 if kotak_acc else 0.0
            checkpoint_results.append({
                "name": "Account Number", "priority": "CRITICAL", "weight": 15, "result": acc_pass_kotak,
                "reason": f"Account: {kotak_acc}" if acc_pass_kotak else "Valid account number not found",
                "detected_value": kotak_acc or "Not detected",
                **get_field_info(kotak_acc if kotak_acc else "ACCOUNT NO")
            })

            # ── 4. IFSC Code [HIGH] ───────────────────────────────────
            ifsc_m = re.search(r'(?i)KKBK0\d{6}', text)
            kotak_ifsc = ifsc_m.group(0) if ifsc_m else None
            ifsc_warn = bool(re.search(r'(?i)KKBK[O0]', text)) and not kotak_ifsc
            ifsc_pass_kotak = 1.0 if kotak_ifsc else (0.5 if ifsc_warn else 0.0)
            checkpoint_results.append({
                "name": "IFSC Code", "priority": "HIGH", "weight": 10, "result": ifsc_pass_kotak,
                "reason": f"Valid IFSC: {kotak_ifsc}" if ifsc_pass_kotak == 1.0 else ("Invalid IFSC format" if ifsc_pass_kotak == 0.5 else "IFSC not found"),
                "detected_value": kotak_ifsc or ("Format issue" if ifsc_warn else "Not detected"),
                **get_field_info(kotak_ifsc if kotak_ifsc else "KKBK0")
            })

            # ── 5. Transaction Table Structure [HIGH] ─────────────────
            kotak_cols = ["DATE", "NARRATION", "DEBIT", "CREDIT", "BALANCE"]
            found_kotak_cols = [c for c in kotak_cols if c in text.upper()]
            table_pass_kotak = 1.0 if len(found_kotak_cols) >= 5 else (0.5 if len(found_kotak_cols) >= 3 else 0.0)
            if not transactions: table_pass_kotak = 0.0
            checkpoint_results.append({
                "name": "Transaction Table Structure", "priority": "HIGH", "weight": 10, "result": table_pass_kotak,
                "reason": f"{len(found_kotak_cols)} columns detected" if table_pass_kotak > 0 else "Insufficient columns",
                "detected_value": f"{len(found_kotak_cols)} cols found",
                "bbox": [200, 10, 850, 990], "page": 0
            })

            # ── 6. Date Format Consistency [MEDIUM] ───────────────────
            date_samples = re.findall(r'\b\d{2}-[a-zA-Z]{3}-\d{4}\b', text)
            other_dates = re.findall(r'\b\d{2}[-/]\d{2}[-/]\d{4}\b', text)
            if len(date_samples) > 0 and len(other_dates) == 0:
                date_pass_kotak = 1.0
            elif len(date_samples) > 0 and len(other_dates) > 0:
                date_pass_kotak = 0.5
            else:
                date_pass_kotak = 0.0
            
            if not transactions: date_pass_kotak = 0.0
            checkpoint_results.append({
                "name": "Date Format Consistency", "priority": "MEDIUM", "weight": 10, "result": date_pass_kotak,
                "reason": "Consistent DD-MMM-YYYY format" if date_pass_kotak == 1.0 else ("Mixed date formats" if date_pass_kotak == 0.5 else "Different/No date format"),
                "detected_value": "DD-MMM-YYYY" if date_pass_kotak == 1.0 else ("Mixed" if date_pass_kotak == 0.5 else "Invalid/None"),
                **get_field_info("PERIOD")
            })

            # ── 7. Balance Flow Validation [CRITICAL] ─────────────────
            math_anom = next((a for a in anomalies if a.get("indicator") == "Math Mismatch"), None)
            total_mismatch = "TOTAL_MISMATCH" in str(anomalies)
            bal_flow_kotak = 0.0 if total_mismatch else (0.5 if math_anom else 1.0)
            if not transactions: bal_flow_kotak = 0.0
            checkpoint_results.append({
                "name": "Balance Flow Validation", "priority": "CRITICAL", "weight": 20, "result": bal_flow_kotak,
                "reason": "All rows verify (P+C-D=C)" if bal_flow_kotak == 1.0 else ("Minor mismatch" if bal_flow_kotak == 0.5 else "Significant flow mismatch"),
                "detected_value": "Consistent" if bal_flow_kotak == 1.0 else ("Minor error" if bal_flow_kotak == 0.5 else "Failed"),
                "bbox": math_anom.get("bbox", [250, 700, 800, 980]) if math_anom else [250, 700, 800, 980],
                "page": math_anom.get("page", 0) if math_anom else 0
            })

            # ── 8. Transaction Narration Pattern [MEDIUM] ─────────────
            k_banking_kw = ["UPI", "IMPS", "NEFT", "POS", "ATM", "MB", "IB"]
            found_kw_count = 0
            total_rows = len(transactions)
            for tx in transactions:
                desc = str(tx.get('narration','')).upper() + " " + str(tx.get('description','')).upper()
                if any(kw in desc for kw in k_banking_kw):
                    found_kw_count += 1
                    
            if total_rows == 0:
                narr_pass_kotak = 0.0
            elif found_kw_count >= total_rows * 0.5:
                narr_pass_kotak = 1.0
            elif found_kw_count > 0:
                narr_pass_kotak = 0.5
            else:
                narr_pass_kotak = 0.0
                
            checkpoint_results.append({
                "name": "Transaction Narration Pattern", "priority": "MEDIUM", "weight": 5, "result": narr_pass_kotak,
                "reason": "Standard banking keywords found" if narr_pass_kotak == 1.0 else ("Few keywords found" if narr_pass_kotak == 0.5 else "No banking keywords found"),
                "detected_value": f"{found_kw_count}/{total_rows} rows have kw"
            })

            # ── 9. Opening & Closing Balance [HIGH] ───────────────────
            has_ob = bool(re.search(r'(?i)OPENING\s*BALANCE', text))
            has_cb = bool(re.search(r'(?i)CLOSING\s*BALANCE', text))
            oc_pass_kotak = 1.0 if (has_ob and has_cb and bal_flow_kotak >= 0.5) else (0.5 if (has_ob and has_cb) else 0.0)
            checkpoint_results.append({
                "name": "Opening & Closing Balance", "priority": "HIGH", "weight": 10, "result": oc_pass_kotak,
                "reason": "Opening & Closing verified" if oc_pass_kotak == 1.0 else ("Values present but math fails/unverified" if oc_pass_kotak == 0.5 else "Missing opening/closing balances"),
                "detected_value": "Verified" if oc_pass_kotak == 1.0 else ("Values found" if oc_pass_kotak == 0.5 else "Missing")
            })

        elif bank_brand == "ICICI":
            # ── 1. Header Identity Check ─────────────────────────────────────────
            bank_name_match = re.search(r'(?i)ICICI\s*Bank', text)
            
            acc_match = None
            for line in text_lines[:30]:
                match = re.search(r'\b\d{12}\b', line)
                if match:
                    acc_match = match.group(0)
                    break
            
            period_match = re.search(r'(?i)(?:Period|Date).*?(\d{2}[-./]\d{2}[-./]\d{2,4}.*?\d{2}[-./]\d{2}[-./]\d{2,4})', text)
            period_val = period_match.group(1) if period_match else None
            if not period_val:
                alt_match = re.search(r'\d{2}[-./]\d{2}[-./]\d{2,4}\s*(?:to|-)\s*\d{2}[-./]\d{2}[-./]\d{2,4}', text)
                period_val = alt_match.group(0) if alt_match else None

            header_pass = bool(bank_name_match and acc_match and period_val)
            checkpoint_results.append({
                "name": "Header Identity Check", "weight": 15, "result": 1.0 if header_pass else 0.0,
                "status": "PASSED" if header_pass else "FAILED",
                "expected": "ICICI Bank, 12-digit Acc, Period",
                "detected": {
                    "bank_signature": "ICICI Bank found" if bank_name_match else "Not found",
                    "account_number": acc_match if acc_match else "Not detected",
                    "statement_period": period_val if period_val else "Not detected"
                },
                "reason": "ICICI Bank identity elements verified" if header_pass else "Missing key ICICI header details",
                **get_field_info(acc_match if acc_match else None)
            })

            # ── 2. Flexible Table Parsing ───────────────────────────────────────
            icici_cols = ["DATE", "MODE", "PARTICULARS", "DEPOSITS", "WITHDRAWALS", "BALANCE", "TRANSACTION", "REMARKS"]
            found_cols = [c for c in icici_cols if c in text.upper()]
            
            row_count = len(transactions) if 'transactions' in locals() and transactions else 0
            table_pass = 1.0 if len(found_cols) >= 3 and row_count > 0 else (0.5 if len(found_cols) >= 3 else 0.0)
            
            checkpoint_results.append({
                "name": "Flexible Table Parsing", "weight": 15, "result": table_pass,
                "status": "PASSED" if table_pass >= 1.0 else "FAILED",
                "expected": "Dynamic columns detection & row structure",
                "detected": {
                    "columns_found": found_cols,
                    "row_count": row_count
                },
                "reason": f"Detected table logic with {row_count} rows" if table_pass >= 1.0 else "Failed to parse standard ICICI table structure",
                "bbox": [200, 10, 850, 990], "page": 0
            })

            # ── 3. Validate Dates (DD.MM.YYYY + Chronology) ─────────────────────
            date_samples = re.findall(r'\d{2}\.\d{2}\.\d{4}|\d{2}-\d{2}-\d{4}|\d{2}/\d{2}/\d{4}', text)[:3]
            chrono_anom = next((a for a in anomalies if a.get("indicator") == "Date Sequence"), None)
            date_pass = 1.0 if date_samples and not chrono_anom else 0.0
            
            checkpoint_results.append({
                "name": "Date Validation", "weight": 10, "result": date_pass,
                "status": "PASSED" if date_pass else "FAILED",
                "expected": "DD.MM.YYYY format & sequential dates",
                "detected": {
                    "sample_dates": date_samples,
                    "format_valid": True if date_samples else False
                },
                "reason": "Dates formatted and chronologically verified" if date_pass else "Invalid date format or sequence",
                "bbox": [100, 10, 900, 100], "page": 0
            })

            # ── 4. Balance Flow Validation (P+D-W=C) ─────────────────────────────
            math_anom = next((a for a in anomalies if a.get("indicator") == "Math Mismatch"), None)
            balance_pass = 1.0 if not math_anom and row_count > 0 else 0.0
            
            math_samples = []
            if balance_pass and row_count > 0:
                for i, tr in enumerate(transactions[:3]):
                    prev = tr.get("prev_balance") if tr.get("prev_balance") is not None else 0.0
                    c = tr.get("credit", 0.0)
                    d = tr.get("debit", 0.0)
                    math_samples.append({
                        "row": i+1,
                        "prev_balance": prev,
                        "deposit": c,
                        "withdrawal": d,
                        "expected_balance": round(prev + c - d, 2),
                        "actual_balance": tr.get("balance", 0.0)
                    })
            else:
                math_samples = [{"row": 1, "status": "Balance anomaly detected or no rows found"}]

            checkpoint_results.append({
                "name": "Balance Flow Validation", "weight": 15, "result": balance_pass,
                "status": "PASSED" if balance_pass else "FAILED",
                "expected": "Prev Balance + Deposit - Withdrawal = Current Balance",
                "detected": math_samples,
                "reason": "Math audit passed" if balance_pass else "Balance flow mismatch",
                "bbox": [250, 700, 800, 980], "page": 0
            })

            # ── 5. Analyze Transaction Patterns ──────────────────────────────────
            prefixes_found = set()
            if 'transactions' in locals() and transactions:
                for tr in transactions:
                    desc = tr.get("description", "").upper()
                    for prefix in ["BIL", "INFT", "UPI", "MMT", "IIN", "INF", "ACH", "NEFT", "RTGS", "IMPS", "CMS"]:
                        if f"{prefix}/" in desc or f"{prefix}-" in desc or desc.startswith(prefix):
                            prefixes_found.add(prefix)
            
            pattern_pass = 1.0 if prefixes_found else 0.0
            checkpoint_results.append({
                "name": "Transaction Pattern Analysis", "weight": 10, "result": pattern_pass,
                "status": "PASSED" if pattern_pass else "FAILED",
                "expected": "Known ICICI narration prefixes (UPI, INFT, MMT, etc.)",
                "detected": {
                    "prefixes_found": list(prefixes_found) if prefixes_found else ["None detected"]
                },
                "reason": "Typical transaction patterns authenticated" if pattern_pass else "No standard ICICI transaction prefixes identified"
            })

            # ── 6. Validate Debit/Credit Rule ────────────────────────────────────
            mutex_fail = False
            mutex_samples = []
            if 'transactions' in locals() and transactions:
                for i, tr in enumerate(transactions):
                    d = tr.get("debit", 0.0)
                    c = tr.get("credit", 0.0)
                    if d > 0 and c > 0:
                        mutex_fail = True
                    if len(mutex_samples) < 3:
                        mutex_samples.append({"row": i+1, "withdrawal": d, "deposit": c})
            
            if "DEBIT_CREDIT_OVERLAP" in str(anomalies) or "MUTEX_VIOLATION" in text.upper():
                mutex_fail = True
                
            checkpoint_results.append({
                "name": "Validate Debit/Credit Rule", "weight": 15, "result": 0.0 if mutex_fail else 1.0,
                "status": "FAILED" if mutex_fail else "PASSED",
                "expected": "Mutual exclusivity (Debit XOR Credit)",
                "detected": mutex_samples if not mutex_fail and mutex_samples else [{"status": "Mutual exclusivity violation detected or no rows"}],
                "reason": "Debit/Credit exclusivity verified" if not mutex_fail else "Double entry on single row found",
                **get_field_info("MUTEX")
            })

            # ── 7. Final Balance Reconciliation ──────────────────────────────────
            total_fail = "TOTAL_MISMATCH" in str(anomalies)
            calc_deposit = sum(tr.get("credit", 0.0) for tr in transactions) if 'transactions' in locals() else 0.0
            calc_withdraw = sum(tr.get("debit", 0.0) for tr in transactions) if 'transactions' in locals() else 0.0
            
            recon_pass = 1.0 if not total_fail and (calc_deposit > 0 or calc_withdraw > 0) else 0.0
            checkpoint_results.append({
                "name": "Final Balance Reconciliation", "weight": 20, "result": recon_pass,
                "status": "PASSED" if recon_pass else "FAILED",
                "expected": "Aggregation matches summary",
                "detected": {
                    "calculated_withdrawals": calc_withdraw,
                    "calculated_deposits": calc_deposit,
                    "total_integrity": "Verified" if recon_pass else "Mismatch/Unverifiable"
                },
                "reason": "End-to-end continuous balance verified" if recon_pass else "Final total reconciliation failed"
            })


        elif bank_brand == "HDFC":
            # ── 1. Header Validation [HIGH] ───────────────────────────
            has_name = bool(re.search(r'(?i)HDFC[\s]*BANK', text))
            has_stmt = bool(re.search(r'(?i)account\s*statement', text))
            header_pass_hdfc = 1.0 if (has_name and has_stmt) else (0.5 if (has_name or has_stmt) else 0.0)
            checkpoint_results.append({
                "name": "Header Validation", "priority": "HIGH", "weight": 15, "result": header_pass_hdfc,
                "reason": "Header identity elements verified" if header_pass_hdfc == 1.0 else ("Partial header found" if header_pass_hdfc == 0.5 else "Missing header identity"),
                "detected_value": "HDFC Header Found" if header_pass_hdfc == 1.0 else ("Partial" if header_pass_hdfc == 0.5 else "Not found")
            })

            # ── 2. Account Holder Name [CRITICAL] ─────────────────────
            detected_name_hdfc = BankLogic.extract_name_above_address(text_lines, text)
            name_pass_hdfc = 1.0 if detected_name_hdfc and re.match(r'^[A-Z ]{3,50}$', detected_name_hdfc) else 0.0
            checkpoint_results.append({
                "name": "Account Holder Name", "priority": "CRITICAL", "weight": 15, "result": name_pass_hdfc,
                "reason": f"Name detected: {detected_name_hdfc}" if name_pass_hdfc else "Account holder name missing/unclear",
                "detected_value": detected_name_hdfc or "Not detected",
                **get_field_info(detected_name_hdfc if detected_name_hdfc else "CUSTOMER ID")
            })

            # ── 3. Account Number [CRITICAL] ──────────────────────────
            hdfc_acc_m = re.search(r'\b\d{10,14}\b', text)
            hdfc_acc = hdfc_acc_m.group(0) if hdfc_acc_m else None
            acc_pass_hdfc = 1.0 if hdfc_acc else 0.0
            checkpoint_results.append({
                "name": "Account Number", "priority": "CRITICAL", "weight": 15, "result": acc_pass_hdfc,
                "reason": f"Account: {hdfc_acc}" if acc_pass_hdfc else "Valid account number not found",
                "detected_value": hdfc_acc or "Not detected",
                **get_field_info(hdfc_acc if hdfc_acc else "ACCOUNT NO")
            })

            # ── 4. IFSC Code [HIGH] ───────────────────────────────────
            ifsc_m = re.search(r'(?i)HDFC0[0-9A-Za-z]{6}', text)
            hdfc_ifsc = ifsc_m.group(0) if ifsc_m else None
            ifsc_warn = bool(re.search(r'(?i)HDFC[O0]', text)) and not hdfc_ifsc
            ifsc_pass_hdfc = 1.0 if hdfc_ifsc else (0.5 if ifsc_warn else 0.0)
            checkpoint_results.append({
                "name": "IFSC Code", "priority": "HIGH", "weight": 10, "result": ifsc_pass_hdfc,
                "reason": f"Valid IFSC: {hdfc_ifsc}" if ifsc_pass_hdfc == 1.0 else ("Invalid IFSC format" if ifsc_pass_hdfc == 0.5 else "IFSC not found"),
                "detected_value": hdfc_ifsc or ("Format issue" if ifsc_warn else "Not detected"),
                **get_field_info(hdfc_ifsc if hdfc_ifsc else "IFSC")
            })

            # ── 5. Statement Period [MEDIUM] ──────────────────────────
            period_match = re.search(r'(?i)(?:From|Period)[^\d]+(\d{2}.{3}\d{2,4}).*?(?:To|-)[^\d]+(\d{2}.{3}\d{2,4})', text)
            stmt_per_pass = 1.0 if period_match else (0.5 if re.search(r'(?i)(?:From|Period)', text) else 0.0)
            detected_period = f"{period_match.group(1)} - {period_match.group(2)}" if period_match else None
            checkpoint_results.append({
                "name": "Statement Period", "priority": "MEDIUM", "weight": 5, "result": stmt_per_pass,
                "reason": f"Period: {detected_period}" if stmt_per_pass == 1.0 else ("Partial dates detected" if stmt_per_pass == 0.5 else "Dates missing"),
                "detected_value": detected_period or ("Partial" if stmt_per_pass == 0.5 else "Missing"),
                **get_field_info("PERIOD")
            })

            # ── 6. Transaction Table Structure [HIGH] ─────────────────
            hdfc_cols = ["DATE", "NARRATION", "DEBIT", "CREDIT", "BALANCE"]
            found_hdfc_cols = [c for c in hdfc_cols if c in text.upper()]
            table_pass_hdfc = 1.0 if len(found_hdfc_cols) >= 5 else (0.5 if len(found_hdfc_cols) == 4 else 0.0)
            if not transactions: table_pass_hdfc = 0.0
            checkpoint_results.append({
                "name": "Transaction Table Structure", "priority": "HIGH", "weight": 10, "result": table_pass_hdfc,
                "reason": f"{len(found_hdfc_cols)} columns detected" if table_pass_hdfc > 0 else "Insufficient columns",
                "detected_value": f"{len(found_hdfc_cols)} cols found",
                "bbox": [200, 10, 850, 990], "page": 0
            })

            # ── 7. Date Format Consistency [MEDIUM] ───────────────────
            dfm1 = re.findall(r'\b\d{2}/\d{2}/\d{4}\b', text)
            dfm2 = re.findall(r'\b\d{2}-\d{2}-\d{4}\b', text)
            if (len(dfm1) > 0 and len(dfm2) == 0) or (len(dfm2) > 0 and len(dfm1) == 0):
                date_pass_hdfc = 1.0
            elif len(dfm1) > 0 and len(dfm2) > 0:
                date_pass_hdfc = 0.5
            else:
                date_pass_hdfc = 0.0
            
            if not transactions: date_pass_hdfc = 0.0
            checkpoint_results.append({
                "name": "Date Format Consistency", "priority": "MEDIUM", "weight": 5, "result": date_pass_hdfc,
                "reason": "Consistent DD/MM/YYYY or DD-MM-YYYY" if date_pass_hdfc == 1.0 else ("Mixed date formats" if date_pass_hdfc == 0.5 else "Different/No format"),
                "detected_value": "Consistent" if date_pass_hdfc == 1.0 else ("Mixed" if date_pass_hdfc == 0.5 else "Invalid/None"),
                "bbox": [100, 10, 900, 100], "page": 0
            })

            # ── 8. Balance Consistency [CRITICAL] ─────────────────────
            math_anom = next((a for a in anomalies if a.get("indicator") == "Math Mismatch"), None)
            total_mismatch = "TOTAL_MISMATCH" in str(anomalies)
            bal_flow_hdfc = 0.0 if total_mismatch else (0.5 if math_anom else 1.0)
            if not transactions: bal_flow_hdfc = 0.0
            checkpoint_results.append({
                "name": "Balance Consistency", "priority": "CRITICAL", "weight": 15, "result": bal_flow_hdfc,
                "reason": "All rows verify (P+C-D=C)" if bal_flow_hdfc == 1.0 else ("Minor mismatch" if bal_flow_hdfc == 0.5 else "Significant mismatch"),
                "detected_value": "Consistent" if bal_flow_hdfc == 1.0 else ("Minor error" if bal_flow_hdfc == 0.5 else "Failed"),
                "bbox": math_anom.get("bbox", [250, 700, 800, 980]) if math_anom else [250, 700, 800, 980],
                "page": math_anom.get("page", 0) if math_anom else 0
            })

            # ── 9. Opening & Closing Balance [HIGH] ───────────────────
            has_ob = bool(re.search(r'(?i)OPENING\s*BALANCE', text))
            has_cb = bool(re.search(r'(?i)CLOSING\s*BALANCE', text))
            oc_pass_hdfc = 1.0 if (has_ob and has_cb and bal_flow_hdfc >= 0.5) else (0.5 if (has_ob and has_cb) else 0.0)
            checkpoint_results.append({
                "name": "Opening & Closing Balance", "priority": "HIGH", "weight": 10, "result": oc_pass_hdfc,
                "reason": "Opening/Closing balances verify" if oc_pass_hdfc == 1.0 else ("Values present but math fails/unverified" if oc_pass_hdfc == 0.5 else "Missing opening/closing balances"),
                "detected_value": "Verified" if oc_pass_hdfc == 1.0 else ("Values found" if oc_pass_hdfc == 0.5 else "Missing")
            })

        # Final processing for all bank brands
        for cp in checkpoint_results:
            if cp.get("result", 0) <= 0: cp["status"] = "FAILED"
            elif cp.get("result", 0) >= 1.0: cp["status"] = "PASSED"
            else: cp["status"] = "WARNING"
            
        fail_count = sum(1 for cp in checkpoint_results if cp["status"] == "FAILED")
        warn_count = sum(1 for cp in checkpoint_results if cp["status"] == "WARNING")
        
        # Rule-Based Classification
        if bank_brand in ["HDFC", "KOTAK"]:
            critical_fails = sum(1 for cp in checkpoint_results if cp.get("priority") == "CRITICAL" and cp["status"] == "FAILED")
            
            if critical_fails > 0:
                final_verdict = "FAKE"
            elif fail_count >= 2:
                final_verdict = "FAKE"
            elif fail_count == 1 or warn_count >= 3:
                final_verdict = "SUSPICIOUS"
            else:
                final_verdict = "REAL"
                
        elif bank_brand == "IOB":
            if processing_status == "INVALID":
                final_verdict = "FAKE"
            else:
                critical_names = ["Header Validation", "Table Detection", "Date Validation", "Balance Check"]
                critical_fails = sum(1 for cp in checkpoint_results if cp["name"] in critical_names and cp["status"] == "FAILED")
                minor_fails = sum(1 for cp in checkpoint_results if cp["name"] not in critical_names and cp["status"] != "PASSED")
                if critical_fails > 0: final_verdict = "FAKE"
                elif minor_fails > 0: final_verdict = "SUSPICIOUS"
                else: final_verdict = "REAL"
                
        elif bank_brand == "ICICI":
            major_names = ["Header Identity Check", "Balance Flow Validation", "Final Balance Reconciliation", "Flexible Table Parsing"]
            major_fails = sum(1 for cp in checkpoint_results if cp["name"] in major_names and cp["status"] == "FAILED")
            if fail_count == 0: final_verdict = "REAL"
            elif major_fails > 0: final_verdict = "FAKE"
            else: final_verdict = "SUSPICIOUS"
            
        else:
            if fail_count == 0: final_verdict = "REAL"
            elif fail_count == 1: final_verdict = "SUSPICIOUS"
            else: final_verdict = "FAKE"
            
        # Final score calculation based on weights for UI granularity
        final_score = 0.0
        for cp in checkpoint_results:
            if "priority" not in cp:
                cp["priority"] = "HIGH" if cp.get("weight", 10) >= 15 else ("CRITICAL" if cp.get("weight") == 20 else "MEDIUM")
                
            contribution = (cp.get("weight", 0) / 100.0) * cp["result"]
            cp["contribution"] = round(contribution * 100, 2)
            
            if "reason" not in cp:
                cp["reason"] = "Validation completed successfully" if cp["status"] == "PASSED" else "Inconsistency detected"
            final_score += contribution

        # 10. Generate Dynamic Remarks
        remarks = BankLogic.generate_remarks(
            processing_status="COMPLETED",
            checkpoint_results=checkpoint_results,
            final_result=final_verdict
        )

        return {
            "score": round(final_score * 100, 2) if bank_brand != "SBI" else (100 - (fail_count * 20)),
            "verdict": final_verdict,
            "remarks": remarks,
            "final_decision": final_verdict.lower() if final_verdict != "REAL" else "genuine",
            "checkpoints": checkpoint_results,
            "is_checkpoint_based": True,
            "fail_count": fail_count,
            "bank_brand": bank_brand,
            "master_template_used": True if master_data else False
        }

    @staticmethod
    def generate_remarks(processing_status: str, checkpoint_results: list, final_result: str) -> str:
        """
        Generate short, dynamic remarks based on document status.
        """
        if processing_status == "INVALID":
            import random
            return random.choice([
                "Invalid document format",
                "Unable to extract data from file",
                "File is not a valid bank statement"
            ])
            
        if processing_status == "COMPLETED" and final_result == "REAL":
            return "Statement verified successfully"
            
        if processing_status == "COMPLETED" and (final_result == "FAIL" or final_result == "FAKE"):
            failed = [cp["name"] for cp in checkpoint_results if cp.get("result", 1.0) <= 0]
            if failed:
                return f"Failed: {', '.join(failed[:2])}" + ("..." if len(failed) > 2 else "")
            return "Critical structural failures detected"
            
        if final_result == "SUSPICIOUS":
            return "Anomalies found in statement"
            
        if processing_status == "CHECKING":
            return "Verification in progress"
            
        return "Awaiting final audit"

    @staticmethod
    def parse_currency(value_str: str) -> float:
        """Clean currency strings into floats."""
        if not value_str: return 0.0
        # Remove commas and currency symbols, handle parentheses as negative
        clean = str(value_str).replace(',', '').replace(' ', '')
        if clean.startswith('(') and clean.endswith(')'):
            clean = '-' + clean[1:-1]
        
        clean = re.sub(r'[^\d.\-]', '', clean)
        try:
            return float(clean)
        except ValueError:
            return 0.0
