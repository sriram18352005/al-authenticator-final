// vehicleDetection.ts — shared extraction & detection logic for VehicleModule

export interface ExtractionResult {
    fullText: string;
    lvm: Record<string, string>;
    method: string;
    itemCount: number;
    // Direct results from PaddleOCR backend (skip regex pipeline if present)
    backendChassis?: string | null;
    backendReg?: string | null;
}

// ── BACKEND API EXTRACTION (PaddleOCR via FastAPI) ────────────────────────────
// Calls localhost:8000/api/v1/vehicle/upload.
// Falls back silently to browser-side PDF.js + Tesseract if unavailable.

const VEHICLE_API = "http://localhost:8000/api/v1/vehicle/upload";

export async function extractDocumentViaAPI(
    file: File
): Promise<ExtractionResult | null> {
    try {
        const form = new FormData();
        form.append("file", file, file.name);

        const resp = await fetch(VEHICLE_API, {
            method: "POST",
            body: form,
            signal: AbortSignal.timeout(30_000),  // 30s max
        });

        if (!resp.ok) return null;

        const data = await resp.json();

        // Build a unified ExtractionResult from the backend response
        const fullText: string =
            data.ocr_text_preview || data.ocr_preview || data.preview || "";

        const lvm: Record<string, string> = data.lvm || {};

        // If the backend already extracted chassis/reg (PaddleOCR path), pass them through
        const backendChassis: string | null = data.chassis_number || null;
        const backendReg: string | null = data.registration_number || null;

        const method = `Backend (${data.ocr_engine || "API"})`;
        const itemCount = data.ocr_text_length || 0;

        return { fullText, lvm, method, itemCount, backendChassis, backendReg };
    } catch {
        // Network error / backend offline — fall back to browser pipeline
        return null;
    }
}

// ── TESSERACT EXTRACTION ─────────────────────────────────────────────────────

export const extractWithTesseract = async (
    file: File
): Promise<ExtractionResult> => {
    const Tesseract = (await import("tesseract.js")).default;
    let source: File | HTMLCanvasElement = file;

    if (file.type === "application/pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const ab = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
        const page = await pdf.getPage(1);
        
        const pixelRatio = window.devicePixelRatio || 1;
        const RENDER_SCALE = 2.5 * pixelRatio;
        const vp = page.getViewport({ scale: RENDER_SCALE });
        
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.width = Math.floor(vp.width / pixelRatio) + 'px';
        canvas.style.height = Math.floor(vp.height / pixelRatio) + 'px';
        
        const ctx = canvas.getContext("2d")!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        await page.render({ 
            canvasContext: ctx, 
            viewport: vp,
            intent: 'print'
        }).promise;
        source = canvas;
    }

    const worker = await Tesseract.createWorker("eng", 1);
    await worker.setParameters({ tessedit_pageseg_mode: "6" } as any);
    const res = await worker.recognize(source as any);
    await worker.terminate();

    const fullText = res.data.text;
    const lvm = buildLVM(fullText);
    return { fullText, lvm, method: "Tesseract OCR (300 DPI)", itemCount: 0 };
};

// ── PDF.JS EXTRACTION ────────────────────────────────────────────────────────

export const extractDocument = async (
    file: File
): Promise<ExtractionResult> => {
    if (file.type !== "application/pdf") return extractWithTesseract(file);

    try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const ab = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
        const allItems: { text: string; x: number; y: number }[] = [];

        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            (content.items as any[]).forEach((item: any) => {
                if (item.str?.trim())
                    allItems.push({
                        text: item.str.trim(),
                        x: Math.round(item.transform[4]),
                        y: Math.round(item.transform[5]),
                    });
            });
        }

        if (allItems.length === 0) return extractWithTesseract(file);

        allItems.sort((a, b) =>
            Math.abs(a.y - b.y) > 5 ? b.y - a.y : a.x - b.x
        );

        const lineGroups: typeof allItems[] = [];
        let cur: typeof allItems = [],
            curY: number | null = null;
        allItems.forEach((item) => {
            if (curY === null) {
                curY = item.y;
                cur = [item];
            } else if (Math.abs(item.y - curY) > 5) {
                lineGroups.push([...cur]);
                cur = [item];
                curY = item.y;
            } else cur.push(item);
        });
        if (cur.length) lineGroups.push(cur);

        const fullText = lineGroups
            .map((l) => l.map((i) => i.text).join(" "))
            .join("\n");
        const lvm = buildLVM(fullText);

        // Also capture adjacent-item label-value pairs from PDF layout
        lineGroups.forEach((line) => {
            for (let i = 0; i < line.length - 1; i++) {
                const label = line[i].text
                    .replace(/[.:\s]+$/, "")
                    .trim()
                    .toUpperCase();
                const value = line[i + 1].text.trim();
                if (label.length > 1 && value.length > 0 && !lvm[label])
                    lvm[label] = value;
            }
        });

        return {
            fullText,
            lvm,
            method: "Native PDF (PDF.js)",
            itemCount: allItems.length,
        };
    } catch {
        return extractWithTesseract(file);
    }
};

// ── BUILD LVM FROM FULL TEXT ──────────────────────────────────────────────────
// Handles colon-separated label:value patterns including multi-space gaps
// from Tesseract OCR output

function buildLVM(text: string): Record<string, string> {
    const lvm: Record<string, string> = {};
    const lines = text.split("\n");

    for (const line of lines) {
        // Pattern 1: "LABEL : VALUE" or "LABEL: VALUE"
        const colonIdx = line.indexOf(":");
        if (colonIdx > 0 && colonIdx < 60) {
            const label = line
                .substring(0, colonIdx)
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9\s\/\.]/g, "")
                .trim();
            const value = line.substring(colonIdx + 1).trim();
            if (label.length > 1 && value.length > 0 && !lvm[label]) {
                lvm[label] = value;
            }
        }
    }

    // Pattern 2: lines with multiple label:value pairs separated by 2+ spaces
    // e.g. "CHASSIS NO : MBLJA05EWH9A32747   ENGINE NO : JA05ECH9A32765"
    for (const line of lines) {
        const parts = line.split(/\s{2,}/);
        for (const part of parts) {
            const ci = part.indexOf(":");
            if (ci > 0 && ci < 40) {
                const label = part
                    .substring(0, ci)
                    .trim()
                    .toUpperCase()
                    .replace(/[^A-Z0-9\s\/\.]/g, "")
                    .trim();
                const value = part.substring(ci + 1).trim();
                if (label.length > 1 && value.length > 0 && !lvm[label]) {
                    lvm[label] = value;
                }
            }
        }
    }

    return lvm;
}

// ── EXCLUSIONS ────────────────────────────────────────────────────────────────

const EXCLUDE_LABELS = [
    "APPLICATION NO", "APPLICATION NO.", "APPLICATION NO/RECEIPT NO",
    "RECEIPT NO", "RECEIPT NO.", "APPL NO",
    "PAYMENT TRANSACTION NO", "TRANSACTION NO",
    "BANK REFERENCE NUMBER", "BANK REFERENCE NO", "GRN NO",
    "ENGINE NO", "ENGINE NUMBER", "ENGINE NO.", "ENG NO", "ENG. NO",
    "INVOICE NO", "INVOICE NUMBER", "ORDER NO", "STOCK NO",
    "CUSTOMER NO", "CUSTOMER NUMBER", "LR NO", "BILL NO",
];

export function buildExclusions(lvm: Record<string, string>): Set<string> {
    const ex = new Set<string>();
    EXCLUDE_LABELS.forEach((label) => {
        const v = lvm[label];
        if (v)
            v.split("/").forEach((part) => {
                const c = part.replace(/[^A-Z0-9]/gi, "").toUpperCase().trim();
                if (c) {
                    ex.add(c);
                    if (c.length > 17) ex.add(c.substring(0, 17));
                }
            });
    });
    return ex;
}

// ── CHASSIS ───────────────────────────────────────────────────────────────────

export const CHASSIS_LABELS_LIST = [
    "CHASSIS NO", "CHASSIS NUMBER", "CHASSIS NO.", "CHASIS NO", "CHASIS NO.",
    "CHASSISNO", "CHAS NO", "CHAS. NO", "CH NO", "CH. NO",
    "FRAME NO", "FRAME NUMBER", "FRAME NO.", "VIN", "VIN NO", "VIN NUMBER",
    "BODY NO", "VEHICLE IDENTIFICATION NUMBER", "CHASSIS N0", "CHASIS N0",
];

export const KNOWN_PREFIXES: Record<string, string> = {
    // Mercedes
    WDD: "Mercedes-Benz", MEC: "Mercedes-Benz",
    // Honda India
    ME4: "Honda (India)",
    // Tata
    MAT: "Tata Motors",
    // Bajaj
    MBJ: "Bajaj Auto", MBH: "Bajaj (Export)",
    // Maruti Suzuki
    MA3: "Maruti Suzuki", MA1: "Maruti (old)",
    // Hero MotoCorp
    MBL: "Hero MotoCorp", MAH: "Hero MotoCorp",
    MBLJA: "Hero Splendor", MBLHA: "Hero HF Deluxe",
    // Mahindra
    MA1M: "Mahindra",
    // BMW
    WBA: "BMW", WBS: "BMW M",
    // Honda Japan/USA
    JHM: "Honda (Japan)", "1HG": "Honda (USA)",
    // Toyota
    "2T1": "Toyota", "4T1": "Toyota (USA)", NMT: "Toyota (Turkey)",
    // Hyundai/Kia
    KNA: "Kia", KMH: "Hyundai",
    // Land Rover
    SAL: "Land Rover",
    // Volvo
    YV1: "Volvo", LFV: "Volvo Cars",
    // Royal Enfield
    MD2: "Royal Enfield", MD6: "Royal Enfield",
    // Ashok Leyland
    AAB: "Ashok Leyland",
    // Others
    MAK: "Kawasaki India", SHH: "Honda (UK)",
    ZFF: "Ferrari", VF1: "Renault", VF3: "Renault (India)",
    SCF: "Aston Martin", WAU: "Audi",
    "3VW": "Volkswagen", "5YJ": "Tesla",
    JN1: "Nissan", "2C3": "Chrysler",
    "1FA": "Ford", "1G1": "Chevrolet",
    "2G1": "Chevrolet (CA)", "3G1": "Chevrolet (MX)",
    MCL: "McLaren", MDH: "Yamaha India",
    MB1: "Hero/Bajaj (India)", MA1H: "Maruti/Mahindra",
    MA1F: "Maruti Ciaz/Ertiga",
};

// ── OCR NORMALIZATION ────────────────────────────────────────────────────────
// Corrects common OCR misreads inside VIN candidates only
// Apply AFTER extracting the raw value — do NOT apply to full text

function normalizeOCR(raw: string): string {
    return raw
        .toUpperCase()
        .replace(/O/g, "0")   // letter O → digit 0
        .replace(/I/g, "1")   // letter I → digit 1
        .replace(/S/g, "5")   // letter S → digit 5
        .replace(/B(?=[0-9])/g, "8");  // B before digit → 8 (conservative)
}

// ── VIN VALIDATION ───────────────────────────────────────────────────────────
// Simple, permissive: accept any 6–17 alphanumeric with letters+digits,
// not in exclusion set. Do NOT apply English-word filters here — they cause
// false rejections of valid manufacturer prefixes (e.g. MBLJA → "9+ letters").

function isValidVIN(
    val: string,
    ex: Set<string>
): { ok: boolean; reason?: string } {
    if (!val) return { ok: false, reason: "empty" };
    const c = val.replace(/[\s\-]/g, "").toUpperCase();

    if (c.length < 6 || c.length > 17)
        return { ok: false, reason: `wrong length (${c.length})` };
    if (!/^[A-Z0-9]+$/.test(c))
        return { ok: false, reason: "non-alphanumeric chars" };
    if (!/[A-Z]/.test(c))
        return { ok: false, reason: "no letters" };
    if (!/[0-9]/.test(c))
        return { ok: false, reason: "no digits" };

    // Only hard-reject values explicitly listed as non-chassis (engine, invoice, app numbers)
    if (ex.has(c)) return { ok: false, reason: "in exclusion set" };
    // Also reject if it's a prefix of a known exclusion (prevents partial matches like JK250611)
    for (const e of ex)
        if (e.length > c.length && e.startsWith(c))
            return { ok: false, reason: `prefix of excluded: ${e}` };

    // Reject purely numeric (transaction/reference numbers)
    if (/^[0-9]+$/.test(c))
        return { ok: false, reason: "all digits — reference number" };
    // Reject purely alphabetic (label text, not a VIN)
    if (/^[A-Z]+$/.test(c))
        return { ok: false, reason: "all letters — label text" };

    return { ok: true };
}

export interface ChassisResult {
    value: string | null;
    source: string;
    confidence: "HIGH" | "MEDIUM" | "LOW" | null;
    manufacturer: string | null;
    candidate: string | null;
    log: { layer: string; value: string; result: string; pass: boolean }[];
}

export function detectChassis(
    fullText: string,
    lvm: Record<string, string>,
    ex: Set<string>
): ChassisResult {
    const upper = fullText.toUpperCase();
    const lines = upper.split("\n").map((l) => l.trim()).filter(Boolean);
    const log: ChassisResult["log"] = [];
    let candidate: string | null = null;

    const tryAdd = (layer: string, raw: string, skipNorm?: boolean): string | null => {
        // Apply OCR normalization on the raw value before stripping
        const normalized = skipNorm ? raw : normalizeOCR(raw);
        const c = normalized.replace(/[^A-Z0-9]/g, "").toUpperCase();
        if (!c) return null;
        const check = isValidVIN(c, ex);
        log.push({
            layer,
            value: c,
            result: check.ok ? "✅ MATCH" : `❌ ${check.reason}`,
            pass: check.ok,
        });
        if (!check.ok && c.length >= 6 && !candidate) candidate = c;
        return check.ok ? c : null;
    };

    const resolve = (val: string): ChassisResult => {
        // Check longest prefix first for best manufacturer match
        let manufacturer: string | null = null;
        for (let len = 5; len >= 2; len--) {
            const pfx = val.substring(0, len);
            if (KNOWN_PREFIXES[pfx]) { manufacturer = KNOWN_PREFIXES[pfx]; break; }
        }
        const confidence: ChassisResult["confidence"] =
            manufacturer ? "HIGH" : val.length === 17 ? "MEDIUM" : "LOW";
        return {
            value: val,
            source: log.find((l) => l.pass)?.layer || "",
            confidence,
            manufacturer,
            candidate,
            log,
        };
    };

    // ── L1: Exact label from LVM (highest trust) ─────────────────────────────
    for (const label of CHASSIS_LABELS_LIST) {
        if (!lvm[label]) continue;
        const v = tryAdd(`Label: ${label}`, lvm[label]);
        if (v) return resolve(v);
    }

    // ── L2: Line-level colon/dash pattern ────────────────────────────────────
    // Catches "CHASSIS NO : MBLJA05EWH9A32747" and OCR-garbled variants
    // Also catches "CHASIS NO- XXXXX" and tab-separated layouts
    for (const line of lines) {
        if (/ENGINE|APPLICATION|TRANSACTION|RECEIPT|INVOICE[ \t]*NO|LR NO/.test(line))
            continue;
        const m = line.match(
            /(?:CH(?:ASS?IS)?|FRAME|VIN|BODY|VEHICLE\s*IDENT)[\s\/:]*(?:NO|NUMBER|N[O0])?[\s\.:\-]*([A-Z0-9][A-Z0-9\s]{4,16})/
        );
        if (m) {
            const raw = m[1].replace(/\s/g, "");
            const v = tryAdd("Line pattern", raw);
            if (v) return resolve(v);
        }
    }

    // ── L3: Known manufacturer prefix scan ───────────────────────────────────
    const noSp = upper.replace(/\s/g, "");
    const sortedPrefixes = Object.keys(KNOWN_PREFIXES).sort(
        (a, b) => b.length - a.length
    );
    const pfxPat = new RegExp(
        `(${sortedPrefixes.join("|")})[A-Z0-9]{8,14}`,
        "g"
    );
    for (const m of [...noSp.matchAll(pfxPat)]) {
        const raw = m[0].substring(0, 17);
        const v = tryAdd("Manufacturer prefix", raw);
        if (v) return resolve(v);
    }

    // ── L4: Token scan (whitespace-split tokens, 10–17 chars, letter-first) ──
    const tokens = upper.split(/[\s,;\|\n\r]+/);
    for (const token of tokens) {
        const c = token.replace(/[^A-Z0-9]/g, "");
        if (c.length < 10 || c.length > 17) continue;
        if (/^[0-9]/.test(c)) continue;
        // Skip if near engine/invoice context
        const idx = upper.indexOf(token);
        const ctx = upper.substring(
            Math.max(0, idx - 30),
            idx + token.length + 30
        );
        if (/ENGINE|INVOICE NO|LR NO|BILL NO|TRANSACTION/.test(ctx)) continue;
        const v = tryAdd("Token scan", c);
        if (v) return resolve(v);
    }

    // ── L5: 17-char strict VIN scan ──────────────────────────────────────────
    // Accept any 17-char alphanumeric with at least 1 letter + 1 digit.
    // OCR normalization already applied by tryAdd.
    for (const m of [...noSp.matchAll(/[A-Z0-9]{17}/g)]) {
        const val = m[0];
        // Skip if purely numeric (application/receipt numbers start with digits only)
        if (/^[0-9]{4,}/.test(val)) continue;
        if (/^[A-Z]+$/.test(val)) continue;
        const v = tryAdd("17-char VIN", val);
        if (v) return resolve(v);
    }

    return {
        value: null,
        source: "Not found",
        confidence: null,
        manufacturer: null,
        candidate,
        log,
    };
}

// ── REGISTRATION ──────────────────────────────────────────────────────────────

const INDIAN_STATES = new Set([
    "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA", "GJ",
    "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD", "MH", "ML", "MN", "MP",
    "MZ", "NL", "OD", "OR", "PB", "PY", "RJ", "SK", "TN", "TR", "TS", "UK", "UP", "WB",
]);

const STATE_NAMES: Record<string, string> = {
    AN: "Andaman & Nicobar", AP: "Andhra Pradesh", AR: "Arunachal Pradesh",
    AS: "Assam", BR: "Bihar", CG: "Chhattisgarh", CH: "Chandigarh",
    DD: "Daman & Diu", DL: "Delhi", DN: "Dadra & Nagar Haveli",
    GA: "Goa", GJ: "Gujarat", HP: "Himachal Pradesh", HR: "Haryana",
    JH: "Jharkhand", JK: "Jammu & Kashmir", KA: "Karnataka", KL: "Kerala",
    LA: "Ladakh", LD: "Lakshadweep", MH: "Maharashtra", ML: "Meghalaya",
    MN: "Manipur", MP: "Madhya Pradesh", MZ: "Mizoram", NL: "Nagaland",
    OD: "Odisha", OR: "Odisha (old)", PB: "Punjab", PY: "Puducherry",
    RJ: "Rajasthan", SK: "Sikkim", TN: "Tamil Nadu", TR: "Tripura",
    TS: "Telangana", UK: "Uttarakhand", UP: "Uttar Pradesh", WB: "West Bengal",
};

const MONTHS = new Set([
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
]);

const REG_LABELS_LIST = [
    "VEHICLE NO", "VEHICLE NO.", "VEHICLE NUMBER", "VEH NO", "VEH. NO",
    "REG NO", "REG. NO", "REGNO", "REGO NO", "REGO NO.", "REGO",
    "REGD NO", "REGD. NO", "REGN NO", "REGN. NO",
    "REGISTRATION NO", "REGISTRATION NO.", "REGISTRATION NUMBER",
    "PLATE NO", "NUMBER PLATE", "PLATE NUMBER", "RC NO", "RC NUMBER",
    "VEHICLE MO", "VEHICLE N0", "VEHICLE ND", "VEH MO", "REG N0", "VEHICLENO",
];

function isValidIndianReg(val: string): { ok: boolean; reason?: string } {
    const c = val.replace(/[\s\-]/g, "").toUpperCase();
    if (c.length < 6 || c.length > 10)
        return { ok: false, reason: `bad length (${c.length})` };

    const m = c.match(/^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{1,4})$/);
    if (!m)
        return { ok: false, reason: "does not match [STATE][DIST][SERIES][NUM]" };

    if (!INDIAN_STATES.has(m[1]))
        return { ok: false, reason: `unknown state code: ${m[1]}` };
    if (MONTHS.has(m[3]))
        return { ok: false, reason: `series is a month: ${m[3]}` };
    if (/^(NO|OF|IN|IS|AT|BY|BE|DO|TO|AS|OR|AN|AM)$/.test(m[3]))
        return { ok: false, reason: `series is common word: ${m[3]}` };

    return { ok: true };
}

export function formatReg(val: string): string {
    const c = val.replace(/[\s\-]/g, "").toUpperCase();
    const m = c.match(/^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{1,4})$/);
    if (!m) return c;
    return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
}

export function parseRegParts(val: string) {
    const c = val.replace(/[\s\-]/g, "").toUpperCase();
    const m = c.match(/^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{1,4})$/);
    if (!m) return null;
    return {
        state: `${m[1]} — ${STATE_NAMES[m[1]] || "Unknown"}`,
        district: m[2],
        series: m[3],
        number: m[4],
    };
}

export interface RegResult {
    value: string | null;
    source: string;
    parts: ReturnType<typeof parseRegParts>;
    log: { layer: string; value: string; result: string; pass: boolean }[];
}

export function detectRegistration(
    fullText: string,
    lvm: Record<string, string>,
    ex: Set<string>
): RegResult {
    const upper = fullText.toUpperCase();
    const log: RegResult["log"] = [];

    const tryReg = (layer: string, raw: string): string | null => {
        const c = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase().trim();
        if (!c || c === "NEW" || c.length < 6 || c.length > 10) {
            log.push({ layer, value: c || raw, result: "⛔ skip", pass: false });
            return null;
        }
        if (ex.has(c)) {
            log.push({ layer, value: c, result: "⛔ excluded", pass: false });
            return null;
        }
        const check = isValidIndianReg(c);
        if (check.ok) {
            log.push({ layer, value: c, result: "✅ MATCH", pass: true });
            return c;
        }
        log.push({ layer, value: c, result: `❌ ${check.reason}`, pass: false });
        return null;
    };

    // L1: Exact label from LVM
    for (const label of REG_LABELS_LIST) {
        if (!lvm[label]) continue;
        const v = tryReg(`Label: ${label}`, lvm[label]);
        if (v)
            return {
                value: formatReg(v),
                source: `Label: ${label}`,
                parts: parseRegParts(v),
                log,
            };
    }

    // L2: REG heading scan — "REG NO : JH09AF3278" large heading style
    const regHeadingMatch = upper.match(
        /REG(?:ISTRATION)?\s*(?:NO|NUMBER|N[O0])?\s*[:\-]\s*([A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4})/
    );
    if (regHeadingMatch) {
        const v = tryReg("REG heading", regHeadingMatch[1]);
        if (v)
            return {
                value: formatReg(v),
                source: "REG heading scan",
                parts: parseRegParts(v),
                log,
            };
    }

    // L3: Line keyword search
    const lines = upper.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
        if (
            /CHASSIS|CHASIS|ENGINE|APPLICATION|TRANSACTION|RECEIPT|BANK|INVOICE|FRAME|VIN/.test(
                line
            )
        )
            continue;
        const m = line.match(
            /(?:VEHICLE\s*(?:NO|N[O0D])|VEH\s*(?:NO|N[O0])|REG(?:O|D|N)?\s*NO|PLATE\s*NO|RC\s*NO)[.\s:\-]+([A-Z]{2}[0-9\s]{1,3}[A-Z]{1,3}[0-9\s]{1,4})/
        );
        if (m) {
            const v = tryReg("Line keyword", m[1]);
            if (v)
                return {
                    value: formatReg(v),
                    source: "Line keyword",
                    parts: parseRegParts(v),
                    log,
                };
        }
    }

    // L4: Strict state-anchored token scan (word-boundary enforced)
    const stateList = [...INDIAN_STATES].join("|");
    const strictPat = new RegExp(
        `(?<![A-Z0-9])((?:${stateList})[0-9]{1,2}[A-Z]{1,3}[0-9]{1,4})(?![A-Z0-9])`,
        "g"
    );
    for (const m of [...upper.matchAll(strictPat)]) {
        const v = tryReg("State scan", m[1]);
        if (v)
            return {
                value: formatReg(v),
                source: "State code scan",
                parts: parseRegParts(v),
                log,
            };
    }

    // L5: BH (Bharat) series
    const noSp = upper.replace(/\s/g, "");
    const bh = noSp.match(
        /(?<![A-Z0-9])[0-9]{2}BH[0-9]{4}[A-Z]{1,2}(?![A-Z0-9])/
    );
    if (bh) {
        log.push({ layer: "BH series", value: bh[0], result: "✅ MATCH", pass: true });
        return { value: bh[0], source: "BH series", parts: null, log };
    }

    return { value: null, source: "Not found", parts: null, log };
}

// ── VEHICLE KEYWORD CHECK ─────────────────────────────────────────────────────

const VEHICLE_KEYWORDS = [
    "chassis", "chasis", "registration", "vehicle no", "reg no", "rego",
    "rto", "rc book", "motor vehicle", "vahan", "parivahan",
    "registration certificate", "hypothecation", "engine no",
    "frame no", "vin", "transport invoice", "transport bill",
    "lorry receipt", "auto transport", "reg no :",
];

export function isVehicleDocument(fullText: string): boolean {
    const lower = fullText.toLowerCase();
    return VEHICLE_KEYWORDS.some((k) => lower.includes(k));
}