import React, { useState, useEffect, useRef } from "react";
import { Loader2, Ticket, CheckCircle2, XCircle, AlertTriangle, FileText, FolderOpen, Search, Copy, Info, Zap, X, Download, Play, Square, Filter, ArrowUp, ArrowDown, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

type StepStatus = "pending" | "processing" | "pass" | "fail" | "warn";
type Verdict = "ACCEPTED" | "REJECTED" | "SUSPICIOUS" | null;
type TicketCategory = "WARR" | "GOODWILL" | "CAMPAIGN" | "PAID_REJECTED" | "PAID_PURE" | "UNKNOWN";
type FileType = "investigation" | "estimate" | "rejection" | "invoice" | "image" | "other";

interface Step { id: string; label: string; status: StepStatus; detail: string; }
interface FileInfo {
  name: string; type: FileType; size: number; file: File;
  summary?: string; confidence?: number; fullText?: string;
  ocr_engine?: string; text_type?: string;
}
interface DuplicatePair { file1: string; file2: string; similarity: number; }

interface AmtData { subtotal: number; gst_pct: number; gst_amount: number; total: number; }
interface AmountVerification {
  estimation: AmtData | null;
  invoice: AmtData | null;
  estimationCheck: { passed: boolean; message: string; expected: number; found: number } | null;
  invoiceCheck: { passed: boolean; message: string; expected: number; found: number } | null;
  crossCheck: { passed: boolean; message: string; estTotal: number; invTotal: number; diffPct: number } | null;
}
interface VehicleData { chassis: string | null; registration: string | null; }
interface VehicleVerification {
  inv: VehicleData; est: VehicleData;
  chassisFormatOk: boolean; chassisWmiOk: boolean; chassisMatch: boolean | null;
  regFormatOk: boolean; regStateOk: boolean; regMatch: boolean | null;
  overallValid: boolean;
}
interface InvoiceValidation {
  present: boolean; valid: boolean; message: string;
  subtotal: number; gst_percentage: number; gst_amount: number; total: number;
  errors: { check: string; expected: number; found: number; difference: number; message: string; passed: boolean }[];
}
interface TicketResult {
  ticketId: string; category: TicketCategory;
  files: FileInfo[]; duplicates: DuplicatePair[];
  duplicateGroups: Record<string, string[]>;
  checklist: { name: string; present: boolean }[];
  verdict: Verdict; verdictReason: string; steps: Step[];
  invoiceValidation: InvoiceValidation | null;
  amountVerification: AmountVerification | null;
  vehicleVerification: VehicleVerification | null;
}

const CATEGORY_REQUIRED: Record<TicketCategory, string[]> = {
  WARR: ["Investigation Report", "Image/Supporting Doc"],
  GOODWILL: ["Investigation Report", "Image/Supporting Doc"],
  CAMPAIGN: ["Investigation Report", "Image/Supporting Doc"],
  PAID_REJECTED: ["Estimation Report", "Invoice", "Investigation Report", "Image/Supporting Doc"],
  PAID_PURE: ["Invoice", "Investigation Report", "Image/Supporting Doc"],
  UNKNOWN: []
};
const CATEGORY_LABELS: Record<TicketCategory, string> = {
  WARR: "WARR / WARRANTY", GOODWILL: "GOODWILL", CAMPAIGN: "CAMPAIGN",
  PAID_REJECTED: "PAID / REJECTED", PAID_PURE: "PAID / PURE", UNKNOWN: "UNKNOWN"
};

// ── Helpers ────────────────────────────────────────────────────────────────
function extractAmounts(text: string): AmtData {
  // Helper: find the LAST number on the first line matching `rx`
  // This handles multi-column tables like: "Sub Total  Rs.990  Rs.950  Rs.1,940"
  const lastNumOnLine = (rx: RegExp): number => {
    const m = text.match(rx);
    if (!m) return 0;
    const nums = m[0].match(/[\d,]+(?:\.\d+)?/g);
    return nums ? parseFloat(nums[nums.length - 1].replace(/,/g, "")) : 0;
  };

  // GST %
  const gstPctMatch = text.match(/gst\s*@\s*(\d+(?:\.\d+)?)%/i);
  const gst_pct = gstPctMatch ? parseFloat(gstPctMatch[1]) : 0;

  // GST amount — take last number on the GST @ X% line
  const gstLineMatch = text.match(/gst\s*@\s*\d+(?:\.\d+)?%[^\n]*/i);
  const gst_amount = gstLineMatch
    ? (() => { const ns = gstLineMatch[0].match(/[\d,]+(?:\.\d+)?/g); return ns ? parseFloat(ns[ns.length - 1].replace(/,/g, "")) : 0; })()
    : 0;

  // Sub Total — last number on "Sub Total" line
  const subtotal = lastNumOnLine(/sub\s*total[^\n]*/i);

  // Grand Total — try "grand total" line first (handles "GRAND TOTAL ESTIMATE Rs. 2,289")
  const total = (() => {
    const gtLine = text.match(/grand\s*total[^\n]*/i);
    if (gtLine) {
      const ns = gtLine[0].match(/[\d,]+(?:\.\d+)?/g);
      if (ns && ns.length > 0) return parseFloat(ns[ns.length - 1].replace(/,/g, ""));
    }
    // Fallback: last line containing "total" that isn't the sub total
    const allTotals = [...text.matchAll(/^[^\n]*total[^\n]*/gim)];
    for (let i = allTotals.length - 1; i >= 0; i--) {
      const line = allTotals[i][0];
      if (/sub\s*total/i.test(line)) continue; // skip sub total lines
      const ns = line.match(/[\d,]+(?:\.\d+)?/g);
      if (ns && ns.length > 0) return parseFloat(ns[ns.length - 1].replace(/,/g, ""));
    }
    return 0;
  })();

  return { subtotal, gst_pct, gst_amount, total };
}
const VALID_WMI = ["MA1", "MA3", "MAT", "MAL", "MAK", "MBA", "MB1", "MB8", "MBH", "MBL", "MD2", "MD7", "MDH", "ME3", "MEE", "MEF", "MEG", "MEL", "MES"];
const VALID_STATES = ["TN", "MH", "KA", "DL", "AP", "TS", "KL", "GJ", "RJ", "UP", "MP", "WB", "HR", "PB", "BR", "OR", "AS", "JH", "UK", "HP", "CG", "GA", "JK", "MN", "ML", "MZ", "NL", "SK", "TR", "AR", "CH", "DN", "DD", "PY", "AN", "LA", "LD"];
function extractVehicleData(text: string): VehicleData {
  const chLbl = text.match(/chassis\s*no\.?[:\s]+([A-HJ-NPR-Z0-9]{17})/i);
  const ch = text.match(/[A-HJ-NPR-Z0-9]{17}/);
  const chassis = (chLbl?.[1] || ch?.[0] || null)?.toUpperCase() ?? null;
  const regLbl = text.match(/reg(?:istration)?\s*no\.?[:\s]+([A-Z]{2}[\s]?\d{2}[\s]?[A-Z]{1,3}[\s]?\d{4})/i);
  const reg = text.match(/[A-Z]{2}[\s]?\d{2}[\s]?[A-Z]{1,3}[\s]?\d{4}/);
  const registration = (regLbl?.[1] || reg?.[0] || null)?.replace(/\s/g, "").toUpperCase() ?? null;
  return { chassis, registration };
}

function simpleHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(16).toUpperCase().padStart(8, "0");
}

function StepRow({ step }: { step: Step }) {
  const colors: Record<StepStatus, string> = {
    pending: "#2d3748", processing: "#00c2cb", pass: "#00c853", fail: "#ff1744", warn: "#ffab00",
  };
  const icons: Record<StepStatus, React.ReactNode> = {
    pending: <span style={{ fontSize: 11, color: "#4a5568" }}>○</span>,
    processing: <Loader2 size={14} color="#00c2cb" className="animate-spin" />,
    pass: <CheckCircle2 size={14} color="#00c853" />,
    fail: <XCircle size={14} color="#ff1744" />,
    warn: <AlertTriangle size={14} color="#ffab00" />,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${colors[step.status]}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: step.status === "pending" ? "#080c14" : `${colors[step.status]}15` }}>
        {icons[step.status]}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: colors[step.status], textTransform: "uppercase", letterSpacing: "0.5px" }}>{step.label}</div>
        {step.detail && <div style={{ fontSize: 10, color: "#4a5568", marginTop: 2 }}>{step.detail}</div>}
      </div>
    </div>
  );
}

const INIT_STEPS: Step[] = [
  { id: "folder_validation", label: "Step 1 — Folder & Ticket ID Validation", status: "pending", detail: "" },
  { id: "file_detection", label: "Step 2 — File Detection & Listing", status: "pending", detail: "" },
  { id: "category_classification", label: "Step 3 — Category Classification", status: "pending", detail: "" },
  { id: "checklist_verification", label: "Step 4 — Document Checklist Verification", status: "pending", detail: "" },
  { id: "duplicate_detection", label: "Step 5 — Duplicate Detection", status: "pending", detail: "" },
  { id: "amount_verification", label: "Step 6 — Amount Verification", status: "pending", detail: "" },
  { id: "vehicle_verification", label: "Step 7 — Chassis & Registration Verification", status: "pending", detail: "" },
  { id: "final_verdict", label: "Step 8 — Final Verdict", status: "pending", detail: "" },
];

export function TicketValidationModule() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TicketResult | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const [detectedTicketId, setDetectedTicketId] = useState<string>("");
  const [ocrPreview, setOcrPreview] = useState<{ name: string, text: string, engine?: string, type?: string } | null>(null);
  const [filePreviewResult, setFilePreviewResult] = useState<TicketResult | null>(null);

  // BATCH MODE STATE
  const [validationMode, setValidationMode] = useState<"single" | "batch">("single");
  const [batchData, setBatchData] = useState<{
    name: string;
    tickets: Record<string, File[]>;
    validIds: string[];
    invalidIds: string[];
  } | null>(null);
  const [batchResults, setBatchResults] = useState<TicketResult[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentTicket: string }>({ current: 0, total: 0, currentTicket: "" });
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchAborted, setBatchAborted] = useState(false);
  const abortRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);


  // SORTING & FILTERING
  const [batchSort, setBatchSort] = useState<{ key: keyof TicketResult | "filesCount"; dir: "asc" | "desc" }>({ key: "ticketId", dir: "asc" });
  const [batchFilter, setBatchFilter] = useState<Verdict | "ALL">("ALL");

  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("webkitdirectory", "");
      fileInputRef.current.setAttribute("directory", "");
    }
    if (batchInputRef.current) {
      batchInputRef.current.setAttribute("webkitdirectory", "");
      batchInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const detectFileType = (filename: string): FileType => {
    const fn = filename.toLowerCase();

    // CHANGE 1 — STRICT FILENAME PRIORITY
    // STEP 1 — Check for REJECTION first
    if (fn.includes("reject") || fn.includes("rejection") || fn.includes("rej")) {
      return "rejection";
    }

    // STEP 2 — Check for ESTIMATION
    if (fn.includes("estimat") || fn.includes("estimation") || fn.includes("est")) {
      return "estimate";
    }

    // STEP 3 — Check for INVESTIGATION
    if (fn.includes("invest") || fn.includes("investigation") || fn.includes("inves")) {
      return "investigation";
    }

    // STEP 4 — Check for INVOICE
    if (fn.includes("invoice") || fn.includes("bill") || fn.includes("billing")) {
      return "invoice";
    }

    // STEP 5 — Check for IMAGE (extensions only)
    const ext = fn.split('.').pop() || "";
    if (["jpg", "jpeg", "png", "webp", "tiff"].includes(ext)) {
      return "image";
    }

    return "other";
  };

  const classifyCategory = (files: FileInfo[]): TicketCategory => {
    const t = new Set(files.map(f => f.type));
    const hasInve = t.has("investigation");
    const hasInv = t.has("invoice");
    const hasEst = t.has("estimate");
    const hasRej = t.has("rejection");
    const hasSupp = t.has("image") || t.has("other");
    const allText = files.map(f => (f.fullText || "").toLowerCase()).join(" ");

    // PAID / REJECTED — Estimation + Invoice + Investigation + Image (all 4)
    if (hasEst && hasInv && hasInve && hasSupp) {
      return "PAID_REJECTED";
    }
    // PAID / PURE — Invoice + Investigation + Image (no Estimation, no Rejection)
    if (hasInv && hasInve && hasSupp && !hasEst && !hasRej) {
      return "PAID_PURE";
    }
    // WARR / GOODWILL / CAMPAIGN — Investigation + Image only
    if (hasInve && hasSupp && !hasInv && !hasEst && !hasRej) {
      if (allText.includes("goodwill")) return "GOODWILL";
      if (allText.includes("campaign")) return "CAMPAIGN";
      return "WARR";
    }
    return "UNKNOWN";
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const firstPath = (files[0] as any).webkitRelativePath;
    const folderName = firstPath.split('/')[0];
    setDetectedTicketId(folderName);

    const rawFiles = Array.from(files);
    setResult(null);
    setSteps([]);

    validateFolder(folderName, rawFiles);
  };

  const validateFolder = async (ticketId: string, rawFiles: File[]) => {
    setRunning(true);
    const stepsInit = INIT_STEPS.map(s => ({ ...s }));
    setSteps(stepsInit);

    const finalResult = await runValidationPipeline(
      ticketId,
      rawFiles,
      (id, status, detail) => setSteps(prev => prev.map(s => s.id === id ? { ...s, status, detail } : s)),
      (forensicFiles) => setSelectedFiles(forensicFiles)
    );

    setResult(finalResult);
    setRunning(false);
  };

  const runValidationPipeline = async (
    ticketId: string,
    rawFiles: File[],
    update: (id: string, status: StepStatus, detail: string) => void,
    onForensicFiles?: (files: FileInfo[]) => void,
    batchId?: string
  ): Promise<TicketResult> => {
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
    const files: FileInfo[] = rawFiles.map(file => ({
      name: file.name,
      type: detectFileType(file.name),
      size: file.size,
      file: file
    }));

    // STEP 1 — Folder & Ticket ID
    update("folder_validation", "processing", "Validating folder name...");
    await delay(400);
    if (!/^4\d{9}$/.test(ticketId)) {
      update("folder_validation", "fail", "Folder name must be exactly 10 digits and start with 4");
      throw new Error("Invalid Ticket ID");
    }
    update("folder_validation", "pass", `Ticket ID: ${ticketId} detected`);

    // STEP 2 — Forensic Content Analysis
    update("file_detection", "processing", "Running forensic content analysis (OCR)...");
    let duplicates: DuplicatePair[] = [];
    let forensicFiles = [...files];
    let ocrFailed = false;
    let apiData: any = null;

    try {
      const formData = new FormData();
      rawFiles.forEach(f => formData.append("files", f, (f as any).webkitRelativePath || f.name));

      const resp = await fetch("http://localhost:8000/api/v1/tickets/analyze-folder", {
        method: "POST",
        body: formData
      });

      if (resp.ok) {
        const data = await resp.json();
        apiData = data;
        duplicates = data.duplicates || [];

        forensicFiles = files.map(f => {
          const analysis = data.analysis.find((a: any) => a.filename === f.name);
            return {
              ...f,
              type: (analysis?.detected_type || f.type) as FileType,
              summary: analysis?.summary || "No content summary",
              confidence: analysis?.confidence || 0.5,
              fullText: analysis?.full_text || "",
              ocr_engine: analysis?.ocr_engine || "unknown",
              text_type: analysis?.text_type || "printed"
            };
          });
        update("file_detection", "pass", `${files.length} files analyzed via content keywords`);
      } else {
        ocrFailed = true;
        update("file_detection", "fail", "Forensic analysis failed on backend");
      }
    } catch (err: any) {
      ocrFailed = true;
      update("file_detection", "fail", "Network error in forensic pipeline");
    }

    if (onForensicFiles) onForensicFiles(forensicFiles);

    // STEP 3 — Category Classification
    update("category_classification", "processing", "Determining category from content...");
    await delay(400);
    const category = classifyCategory(forensicFiles);
    if (category === "UNKNOWN") {
      update("category_classification", "warn", "Manual review needed: Document set incomplete");
    } else {
      update("category_classification", "pass", `Category: ${CATEGORY_LABELS[category]}`);
    }

    // STEP 4 — Checklist
    update("checklist_verification", "processing", "Checking required documents...");
    await delay(400);
    const required = CATEGORY_REQUIRED[category];
    const checklist = required.map(name => {
      let isPresent = false;
      if (name === "Investigation Report") isPresent = forensicFiles.some(f => f.type === "investigation");
      else if (name === "Invoice") isPresent = forensicFiles.some(f => f.type === "invoice");
      else if (name === "Estimation Report") isPresent = forensicFiles.some(f => f.type === "estimate");
      else if (name === "Rejection Report") isPresent = forensicFiles.some(f => f.type === "rejection");
      else if (name === "Image/Supporting Doc") isPresent = forensicFiles.some(f => f.type === "image" || f.type === "other");
      return { name, present: isPresent };
    });

    const missingCount = checklist.filter(c => !c.present).length;
    if (missingCount > 0) {
      update("checklist_verification", "fail", `${missingCount} required documents missing`);
    } else {
      update("checklist_verification", "pass", "All required documents present");
    }

    // STEP 5 — Duplicate Detection
    update("duplicate_detection", "processing", "Verifying duplicates...");
    await delay(300);

    const duplicateGroups: Record<string, string[]> = {};
    const typeToFiles: Record<string, string[]> = {};

    forensicFiles.forEach(f => {
      const docType = f.type.toUpperCase();
      if (docType !== 'IMAGE' && docType !== 'OTHER') {
        if (!typeToFiles[docType]) typeToFiles[docType] = [];
        typeToFiles[docType].push(f.name);
      }
    });

    for (const [docType, fileNames] of Object.entries(typeToFiles)) {
      if (fileNames.length > 1) {
        duplicateGroups[docType] = fileNames;
      }
    }

    const hasDuplicates = Object.keys(duplicateGroups).length > 0;
    if (hasDuplicates) {
      const typesStr = Object.keys(duplicateGroups).join(", ");
      update("duplicate_detection", "warn", `Duplicate document types detected: ${typesStr}`);
    } else {
      update("duplicate_detection", "pass", "No duplicate files detected");
    }

    // STEP 6 — Amount Verification
    update("amount_verification", "processing", "Checking amounts...");
    await delay(400);

    const estFile = forensicFiles.find(f => f.type === "estimate");
    const invFile = forensicFiles.find(f => f.type === "invoice");
    const invoiceValidation: InvoiceValidation | null = apiData?.invoice_validation ?? null;

    let amountVerification: AmountVerification | null = null;
    let amountError = false;

    if (!estFile && !invFile) {
      update("amount_verification", "warn", "No estimation or invoice file");
    } else {
      const estAmt = estFile?.fullText ? extractAmounts(estFile.fullText) : null;
      const invAmt = invFile?.fullText ? extractAmounts(invFile.fullText) : null;
      const TOLS = 2;

      const estCheck = estAmt && estAmt.subtotal && estAmt.gst_amount && estAmt.total
        ? (() => {
          const exp = +(estAmt.subtotal + estAmt.gst_amount).toFixed(2);
          const diff = Math.abs(exp - estAmt.total);
          const passed = diff <= TOLS;
          if (!passed) amountError = true;
          return { passed, expected: exp, found: estAmt.total, message: passed ? "Estimation correct" : `Mismatch: Rs.${exp} vs Rs.${estAmt.total}` };
        })()
        : null;

      const invCheck = invAmt && invAmt.subtotal && invAmt.gst_amount && invAmt.total
        ? (() => {
          const exp = +(invAmt.subtotal + invAmt.gst_amount).toFixed(2);
          const diff = Math.abs(exp - invAmt.total);
          const passed = diff <= TOLS;
          if (!passed) amountError = true;
          return { passed, expected: exp, found: invAmt.total, message: passed ? "Invoice correct" : `Mismatch: Rs.${exp} vs Rs.${invAmt.total}` };
        })()
        : null;

      const crossCheck = estAmt?.total && invAmt?.total
        ? (() => {
          const diffPct = Math.abs(estAmt.total - invAmt.total) / estAmt.total * 100;
          const passed = diffPct <= 10;
          if (!passed) amountError = true;
          return { passed, estTotal: estAmt.total, invTotal: invAmt.total, diffPct: +diffPct.toFixed(1), message: passed ? "Cross-check OK" : `Difference ${diffPct.toFixed(1)}%` };
        })()
        : null;

      amountVerification = { estimation: estAmt, invoice: invAmt, estimationCheck: estCheck, invoiceCheck: invCheck, crossCheck };
      update("amount_verification", amountError ? "fail" : "pass", amountError ? "Amount validation failed" : "All amount checks passed");
    }

    // STEP 7 — Chassis & Registration
    update("vehicle_verification", "processing", "Checking vehicle identity...");
    await delay(400);

    const invesFile = forensicFiles.find(f => f.type === "investigation");
    let vehicleVerification: VehicleVerification | null = null;
    let vehicleCriticalFail = false;

    if (!invesFile && !estFile) {
      update("vehicle_verification", "warn", "No vehicle data source");
    } else {
      const invVeh = extractVehicleData(invesFile?.fullText || "");
      const estVeh = extractVehicleData(estFile?.fullText || "");

      const ch = invVeh.chassis || estVeh.chassis;
      const chassisFormatOk = !!ch && ch.length === 17 && !/[IOQ]/.test(ch);
      const chassisWmiOk = !!ch && VALID_WMI.some(w => ch.startsWith(w));
      const chassisMatch = invVeh.chassis && estVeh.chassis ? invVeh.chassis === estVeh.chassis : null;

      const reg = invVeh.registration || estVeh.registration;
      const regFormatOk = !!reg && /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(reg);
      const regStateOk = !!reg && VALID_STATES.includes(reg.substring(0, 2));
      const regMatch = invVeh.registration && estVeh.registration ? invVeh.registration === estVeh.registration : null;

      const overallValid = chassisFormatOk && chassisWmiOk && regFormatOk && regStateOk && chassisMatch !== false && regMatch !== false;
      if (chassisMatch === false || regMatch === false) vehicleCriticalFail = true;

      vehicleVerification = { inv: invVeh, est: estVeh, chassisFormatOk, chassisWmiOk, chassisMatch, regFormatOk, regStateOk, regMatch, overallValid };
      update("vehicle_verification", vehicleCriticalFail ? "fail" : overallValid ? "pass" : "warn", vehicleCriticalFail ? "Identity mismatch!" : "Vehicle verified");
    }

    // STEP 8 — Verdict
    update("final_verdict", "processing", "Finalizing verdict...");
    await delay(300);

    let verdict: Verdict = "ACCEPTED";
    let reason = "All documents verified";

    if (vehicleCriticalFail) {
      verdict = "REJECTED";
      reason = "Critical: Document mismatch (Chassis/Reg)";
    } else if (missingCount > 0) {
      verdict = "REJECTED";
      reason = "Required documents missing";
    } else if (amountError) {
      verdict = "SUSPICIOUS";
      reason = "Amount mismatch detected";
    } else if (hasDuplicates) {
      const isCriticalDuplicate = duplicateGroups["INVOICE"] || duplicateGroups["ESTIMATION"] || duplicateGroups["ESTIMATE"];
      if (isCriticalDuplicate) {
        verdict = "REJECTED";
        const criticalType = duplicateGroups["INVOICE"] ? "INVOICE" : "ESTIMATION";
        reason = `Critical duplicate detected: Multiple ${criticalType} files found in same ticket folder`;
      } else {
        verdict = "SUSPICIOUS";
        const types = Object.keys(duplicateGroups).join(", ");
        reason = `Duplicate document type detected: ${types}`;
      }
    } else if (category === "UNKNOWN") {
      verdict = "SUSPICIOUS";
      reason = "Category ambiguous";
    }

    const verdictStatus: StepStatus = verdict === "ACCEPTED" ? "pass" : verdict === "REJECTED" ? "fail" : "warn";
    update("final_verdict", verdictStatus, `${verdict} — ${reason}`);

    const result: TicketResult = {
      ticketId, category, files: forensicFiles, duplicates, duplicateGroups, checklist,
      verdict, verdictReason: reason, steps: INIT_STEPS.map(s => ({ ...s })),
      invoiceValidation, amountVerification, vehicleVerification
    };

    // Audit log
    try {
      const audit = JSON.parse(localStorage.getItem("verentis_audit") || "[]");
      audit.push({
        caseId: `TV-${ticketId}-${Math.floor(Date.now() / 1000)}`,
        timestamp: new Date().toISOString(),
        fileName: `Ticket Folder: ${ticketId}`,
        ticketId,
        batch_id: batchId || null,
        category: CATEGORY_LABELS[category],
        files: rawFiles.map(f => f.name),
        status: verdict?.toLowerCase() || "unknown",
        verdict,
        extractionMethod: "FOLDER_FORENSICS",
        resultHash: simpleHash(ticketId + verdict + Date.now().toString())
      });
      localStorage.setItem("verentis_audit", JSON.stringify(audit.slice(-200)));
    } catch { }

    // Analytics
    try {
      const analytics = JSON.parse(localStorage.getItem("verentis_analytics") || "[]");
      const regNum = vehicleVerification?.inv?.registration || vehicleVerification?.est?.registration || "";
      const stateCode = regNum.length >= 2 ? regNum.substring(0, 2).toUpperCase() : "";
      const statesMap: Record<string, number> = stateCode ? { [stateCode]: 1 } : {};

      analytics.push({
        id: Date.now(),
        date: new Date().toISOString(),
        total: 1,
        valid: verdict === "ACCEPTED" ? 1 : 0,
        invalid: verdict === "REJECTED" ? 1 : 0,
        partial: verdict === "SUSPICIOUS" ? 1 : 0,
        skipped: 0,
        manufacturers: {},
        states: statesMap,
      });
      localStorage.setItem("verentis_analytics", JSON.stringify(analytics.slice(-500)));
    } catch { }

    return result;
  };

  const handleBatchSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const ticketFolders: Record<string, File[]> = {};
    const validIds: string[] = [];
    const invalidIds: string[] = [];

    // Improved detection: find the first 10-digit ID in the path
    for (const file of Array.from(files)) {
      const path = (file as any).webkitRelativePath;
      const pathParts = path.split('/');

      // Find the first part that looks like a 10-digit ID starting with 4
      let foundId = "";
      for (const part of pathParts) {
        if (/^4\d{9}$/.test(part)) {
          foundId = part;
          break;
        }
      }

      if (foundId) {
        if (!ticketFolders[foundId]) {
          ticketFolders[foundId] = [];
          validIds.push(foundId);
        }
        ticketFolders[foundId].push(file);
      } else {
        // Only track as invalid if it's a directory (no file extension and not a hidden file)
        const possibleDir = pathParts[pathParts.length - 2];
        if (possibleDir && !possibleDir.includes('.') && !invalidIds.includes(possibleDir)) {
          invalidIds.push(possibleDir);
        }
      }
    }

    const batchName = (files[0] as any).webkitRelativePath.split('/')[0] || "Batch Analysis";
    setBatchData({ name: batchName, tickets: ticketFolders, validIds, invalidIds });
    setBatchResults([]);
    setBatchProgress({ current: 0, total: validIds.length, currentTicket: "" });
    setBatchRunning(false);
    setBatchAborted(false);
    abortRef.current = false;
  };

  const startBatch = async () => {
    if (!batchData || batchData.validIds.length === 0) return;

    setBatchRunning(true);
    setBatchAborted(false);
    abortRef.current = false;
    setBatchResults([]);

    const results: TicketResult[] = [];
    const batchId = `BATCH-${batchData.name}-${Date.now()}`;

    for (let i = 0; i < batchData.validIds.length; i++) {
      if (abortRef.current) {
        setBatchAborted(true);
        break;
      }

      const ticketId = batchData.validIds[i];
      const files = batchData.tickets[ticketId];

      setBatchProgress({
        current: i + 1,
        total: batchData.validIds.length,
        currentTicket: ticketId
      });

      try {
        const result = await runValidationPipeline(
          ticketId,
          files,
          () => { }, // Batch mode doesn't show individual steps for all
          undefined,
          batchId
        );
        results.push(result);
        setBatchResults([...results]);
      } catch (err) {
        console.error(`Error processing ticket ${ticketId}:`, err);
      }

      // Small delay between tickets
      await new Promise(r => setTimeout(r, 500));
    }

    setBatchRunning(false);
  };

  const stopBatch = () => {
    abortRef.current = true;
  };

  // ── Excel Export ──────────────────────────────────────────────────────────
  const exportToExcel = (r: TicketResult) => {
    const ts = new Date().toLocaleString("en-IN");

    // ALL possible document columns in a fixed order
    const ALL_DOCS = [
      "Investigation Report",
      "Invoice",
      "Estimation Report",
      "Rejection Report",
      "Image/Supporting Doc",
    ];

    // Which docs are required for this category
    const requiredForCategory = new Set(CATEGORY_REQUIRED[r.category]);

    // Which docs are actually present
    const isPresent = (docName: string): boolean | null => {
      if (!requiredForCategory.has(docName)) return null; // N/A for this category
      return r.checklist.find(c => c.name === docName)?.present ?? false;
    };

    // Helper cell: ✓ YES (green), ✗ NO (red), — N/A (grey)
    const cell = (v: boolean | null) =>
      v === true
        ? `<td style="color:green;font-weight:bold;text-align:center;font-size:13pt;">✓</td>`
        : v === false
          ? `<td style="color:red;font-weight:bold;text-align:center;font-size:13pt;">✗</td>`
          : `<td style="color:#aaa;text-align:center;">—</td>`;

    const verdictColor =
      r.verdict === "ACCEPTED" ? "green" : r.verdict === "REJECTED" ? "red" : "orange";

    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  h1   { color: #1a3a5c; border-bottom: 3px solid #1a3a5c; padding-bottom: 8px; font-size: 15pt; }
  p    { color: #555; font-size: 9pt; margin: 0 0 16px; }
  table { border-collapse: collapse; width: auto; }
  th {
    background: #1a3a5c; color: white;
    padding: 10px 16px; text-align: center;
    font-size: 10pt; border: 1px solid #b0c4de;
    white-space: nowrap;
  }
  th.left { text-align: left; }
  td { padding: 9px 16px; border: 1px solid #c8d6e5; font-size: 10pt; white-space: nowrap; }
  tr:nth-child(even) td { background: #f0f4fa; }
</style></head>
<body>
<h1>Ticket Forensic Validation — Document Checklist</h1>
<p>Generated: ${ts}</p>
<table>
  <thead>
    <tr>
      <th class="left">Ticket ID</th>
      <th class="left">Category</th>
      <th class="left">Verdict</th>
      ${ALL_DOCS.map(d => `<th>${d}</th>`).join("")}
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="font-weight:bold;font-family:monospace;">${r.ticketId}</td>
      <td style="font-weight:bold;color:#1a3a5c;">${CATEGORY_LABELS[r.category]}</td>
      <td style="font-weight:bold;color:${verdictColor};">${r.verdict}</td>
      ${ALL_DOCS.map(d => cell(isPresent(d))).join("")}
    </tr>
  </tbody>
</table>

<p style="margin-top:12px;color:#888;">
  ✓ = Present &nbsp;&nbsp; ✗ = Missing &nbsp;&nbsp; — = Not required for this category
</p>
<p style="color:#aaa;font-size:8pt;margin-top:4px;">Verentis Forensic Validation System — ${ts}</p>
</body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Forensic_Report_${r.ticketId}_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportBatchCSV = () => {
    if (batchResults.length === 0) return;

    const now = new Date().toLocaleString("en-IN");
    const dateOnly = new Date().toLocaleDateString("en-IN");
    const BOM = '\uFEFF';
    const lines: string[] = [];

    // Header title
    lines.push('Ticket Forensic Validation - Document Checklist');
    lines.push('');
    lines.push(`Generated: ${now}`);

    // Column headers
    const headers = [
      'Ticket ID',
      'Category',
      'Verdict',
      'Investigation Report',
      'Invoice',
      'Estimation Report',
      'Rejection Report',
      'Image/Supporting Doc',
      'Duplicates Found'
    ];
    lines.push(headers.join(','));

    const ALL_DOCS = [
      "Investigation Report",
      "Invoice",
      "Estimation Report",
      "Rejection Report",
      "Image/Supporting Doc",
    ];

    // One row per ticket
    batchResults.forEach(r => {
      const requiredForCategory = new Set(CATEGORY_REQUIRED[r.category]);

      const row = [
        `="${r.ticketId}"`,
        CATEGORY_LABELS[r.category],
        r.verdict,
        ...ALL_DOCS.map(docName => {
          if (!requiredForCategory.has(docName)) return 'N/A';
          const present = r.checklist.find(c => c.name === docName)?.present ?? false;
          return present ? 'Present' : 'Missing';
        }),
        Object.keys(r.duplicateGroups || {}).length > 0
          ? `"${Object.values(r.duplicateGroups || {}).flat().join(", ")}"`
          : "None"
      ];
      lines.push(row.join(','));
    });

    // Footer
    lines.push('');
    lines.push('Present = Document found   Missing = Document not found   N/A = Not required for this category');
    lines.push(`Verentis Forensic Validation System - ${dateOnly}`);

    const csvContent = lines.join('\n');
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const folderName = (batchData?.name || "batch").replace(/\s+/g, '_');

    link.setAttribute("href", url);
    link.setAttribute("download", `batch_${folderName}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportBatchExcel = () => {
    if (batchResults.length === 0) return;
    const now = new Date().toLocaleString("en-IN");
    const dateOnly = new Date().toLocaleDateString("en-IN");

    const ALL_DOCS = [
      "Investigation Report",
      "Invoice",
      "Estimation Report",
      "Rejection Report",
      "Image/Supporting Doc",
    ];

    const cell = (v: boolean | null) =>
      v === true
        ? `<td style="color:green;font-weight:bold;text-align:center;">Present</td>`
        : v === false
          ? `<td style="color:red;font-weight:bold;text-align:center;">Missing</td>`
          : `<td style="color:#aaa;text-align:center;">N/A</td>`;

    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  h1   { color: #1a3a5c; border-bottom: 3px solid #1a3a5c; padding-bottom: 8px; font-size: 15pt; }
  p    { color: #555; font-size: 9pt; margin: 0 0 16px; }
  table { border-collapse: collapse; width: auto; }
  th {
    background: #1a3a5c; color: white;
    padding: 10px 16px; text-align: center;
    font-size: 10pt; border: 1px solid #b0c4de;
    white-space: nowrap;
  }
  th.left { text-align: left; }
  td { padding: 9px 16px; border: 1px solid #c8d6e5; font-size: 10pt; white-space: nowrap; }
  tr:nth-child(even) td { background: #f0f4fa; }++_
</style></head>
<body>
<h1>Ticket Forensic Validation - Batch Document Checklist</h1>
<p>Generated: ${now}</p>
<table>
  <thead>
    <tr>
      <th class="left">Ticket ID</th>
      <th class="left">Category</th>
      <th class="left">Verdict</th>
      ${ALL_DOCS.map(d => `<th>${d}</th>`).join("")}
      <th class="left">Duplicates Found</th>
    </tr>
  </thead>
  <tbody>
    ${batchResults.map(r => {
      const required = new Set(CATEGORY_REQUIRED[r.category]);
      const getStatus = (d: string) => {
        if (!required.has(d)) return null;
        return r.checklist.find(c => c.name === d)?.present ?? false;
      };
      const verdictColor = r.verdict === "ACCEPTED" ? "green" : r.verdict === "REJECTED" ? "red" : "orange";
      return `
    <tr>
      <td style="font-weight:bold;font-family:monospace;">${r.ticketId}</td>
      <td style="font-weight:bold;color:#1a3a5c;">${CATEGORY_LABELS[r.category]}</td>
      <td style="font-weight:bold;color:${verdictColor};">${r.verdict}</td>
      ${ALL_DOCS.map(d => cell(getStatus(d))).join("")}
      <td style="color:${Object.keys(r.duplicateGroups || {}).length > 0 ? 'red' : 'green'};">${Object.keys(r.duplicateGroups || {}).length > 0 ? Object.values(r.duplicateGroups || {}).flat().join(", ") : 'None'}</td>
    </tr>`;
    }).join("")}
  </tbody>
</table>
<p style="margin-top:12px;color:#888;">
  Present = Document found &nbsp;&nbsp; Missing = Document not found &nbsp;&nbsp; N/A = Not required for this category
</p>
<p style="color:#aaa;font-size:8pt;margin-top:4px;">Verentis Forensic Validation System - ${dateOnly}</p>
</body></html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const folderName = (batchData?.name || "batch").replace(/\s+/g, '_');

    a.href = url;
    a.download = `batch_${folderName}_${dateStr}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportSingleCSV = (r: TicketResult) => {
    const now = new Date().toLocaleString("en-IN");
    const dateOnly = new Date().toLocaleDateString("en-IN");
    const BOM = '\uFEFF';
    const lines: string[] = [];

    lines.push('Ticket Forensic Validation - Document Checklist');
    lines.push('');
    lines.push(`Generated: ${now}`);

    const headers = [
      'Ticket ID',
      'Category',
      'Verdict',
      'Investigation Report',
      'Invoice',
      'Estimation Report',
      'Rejection Report',
      'Image/Supporting Doc',
      'Duplicates Found'
    ];
    lines.push(headers.join(','));

    const ALL_DOCS = [
      "Investigation Report",
      "Invoice",
      "Estimation Report",
      "Rejection Report",
      "Image/Supporting Doc",
    ];

    const requiredForCategory = new Set(CATEGORY_REQUIRED[r.category]);
    const row = [
      `="${r.ticketId}"`,
      CATEGORY_LABELS[r.category],
      r.verdict,
      ...ALL_DOCS.map(docName => {
        if (!requiredForCategory.has(docName)) return 'N/A';
        const present = r.checklist.find(c => c.name === docName)?.present ?? false;
        return present ? 'Present' : 'Missing';
      }),
      Object.keys(r.duplicateGroups || {}).length > 0
        ? `"${Object.values(r.duplicateGroups || {}).flat().join(", ")}"`
        : "None"
    ];
    lines.push(row.join(','));

    lines.push('');
    lines.push('Present = Document found   Missing = Document not found   N/A = Not required for this category');
    lines.push(`Verentis Forensic Validation System - ${dateOnly}`);

    const csvContent = lines.join('\n');
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    link.setAttribute("href", url);
    link.setAttribute("download", `ticket_${r.ticketId}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };



  const verdictColor: Record<string, string> = { ACCEPTED: "#00c853", REJECTED: "#ff1744", SUSPICIOUS: "#ffab00" };
  const verdictBg: Record<string, string> = { ACCEPTED: "#0a1f10", REJECTED: "#1a0a0a", SUSPICIOUS: "#1a1200" };
  const verdictBorder: Record<string, string> = { ACCEPTED: "rgba(0,200,83,0.4)", REJECTED: "rgba(255,23,68,0.4)", SUSPICIOUS: "rgba(255,171,0,0.4)" };

  return (
    <div style={{ background: "#050810", minHeight: "100vh", padding: "24px", color: "#e8ecf4", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg,#050d1a,#0a1628)", border: "1px solid #1e2535", borderRadius: 16, padding: "24px 32px", marginBottom: 24, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(0,194,203,0.1)", border: "1px solid rgba(0,194,203,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FolderOpen size={24} color="#00c2cb" />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "3px", color: "#00c2cb", textTransform: "uppercase", marginBottom: 4 }}>Forensic Analysis Engine</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#e8ecf4", letterSpacing: "-0.3px" }}>Ticket Validation</div>
          <div style={{ fontSize: 12, color: "#4a5568", marginTop: 2 }}>Automated forensic verification for claim documents</div>
        </div>

        {/* MODE TOGGLE */}
        <div style={{ marginLeft: "auto", display: "flex", background: "rgba(0,0,0,0.2)", padding: 4, borderRadius: 12, border: "1px solid #1e2535" }}>
          <button
            onClick={() => setValidationMode("single")}
            style={{
              padding: "8px 20px",
              borderRadius: 10,
              border: "none",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              transition: "all 0.3s",
              background: validationMode === "single" ? "#00d4aa" : "transparent",
              color: validationMode === "single" ? "#050d1a" : "#4a5568"
            }}
          >
            SINGLE TICKET
          </button>
          <button
            onClick={() => setValidationMode("batch")}
            style={{
              padding: "8px 20px",
              borderRadius: 10,
              border: "none",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              transition: "all 0.3s",
              background: validationMode === "batch" ? "#00d4aa" : "transparent",
              color: validationMode === "batch" ? "#050d1a" : "#4a5568"
            }}
          >
            BATCH TICKETS
          </button>
        </div>
      </div>

      {validationMode === "single" ? (
        <>
          <div style={{ background: "#0a0d14", border: "1px solid #1e2535", borderRadius: 14, padding: "32px", marginBottom: 24, textAlign: "center" }}>
            <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFolderSelect} {...({ webkitdirectory: "", directory: "", multiple: true } as any)} />
            <div onClick={() => fileInputRef.current?.click()} style={{ cursor: "pointer", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,194,203,0.05)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(0,194,203,0.2)", marginBottom: 8 }}>
                <FolderOpen size={32} color="#00c2cb" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#e8ecf4" }}>Upload Ticket Folder</div>
              <div style={{ fontSize: 12, color: "#4a5568" }}>Folder name must be the 10 digit Ticket ID</div>
              <button style={{ marginTop: 8, padding: "10px 24px", background: "linear-gradient(135deg,#00c2cb,#00a0a8)", border: "none", borderRadius: 8, color: "#050d1a", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                Select Folder
              </button>
            </div>
            {detectedTicketId && (
              <div style={{ marginTop: 24, padding: "12px 16px", background: "#080c14", border: "1px solid #1e2535", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 12 }}>
                <Ticket size={16} color="#00c2cb" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#00c2cb" }}>Detected ID: {detectedTicketId}</span>
                <span style={{ fontSize: 11, color: "#4a5568" }}>| {selectedFiles.length} files found</span>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {steps.length > 0 && (
                <div style={{ background: "#080c14", border: "1px solid #1e2535", borderRadius: 14, padding: "20px 24px", marginBottom: 24 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", color: "#4a5568", textTransform: "uppercase", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Validation Pipeline</span>
                    {running && <Loader2 size={14} className="animate-spin" color="#00c2cb" />}
                  </div>
                  {steps.map(s => <StepRow key={s.id} step={s} />)}
                </div>
              )}
              {selectedFiles.length > 0 && (
                <div style={{ background: "#080c14", border: "1px solid #1e2535", borderRadius: 14, padding: "20px 24px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", color: "#4a5568", textTransform: "uppercase", marginBottom: 16 }}>Detected Files</div>
                  <div style={{ maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
                    {selectedFiles.map((file, idx) => {
                      const isDuplicate = result?.duplicateGroups && Object.values(result.duplicateGroups).flat().includes(file.name);

                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 12px",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            borderRadius: 8,
                            transition: "background 0.2s",
                            border: isDuplicate ? "1px solid rgba(255,23,68,0.3)" : "1px solid transparent",
                            background: isDuplicate ? "rgba(255,23,68,0.02)" : "transparent"
                          }}
                        >
                          <div
                            onClick={() => {
                              const url = URL.createObjectURL(file.file);
                              window.open(url, '_blank');
                            }}
                            title="View Original Document"
                            style={{ width: 32, height: 32, borderRadius: 8, background: isDuplicate ? "rgba(255,23,68,0.1)" : "rgba(0,194,203,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: `1px solid ${isDuplicate ? "rgba(255,23,68,0.3)" : "rgba(0,194,203,0.2)"}` }}
                          >
                            <FileText size={16} color={isDuplicate ? "#ff1744" : "#00c2cb"} />
                          </div>
                          <div
                            style={{ flex: 1, cursor: "pointer" }}
                            onClick={() => setOcrPreview({ 
                              name: file.name, 
                              text: file.fullText || "No text available",
                              engine: file.ocr_engine,
                              type: file.text_type
                            })}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: isDuplicate ? "#ff1744" : "inherit" }}>{file.name}</div>
                              {isDuplicate && <AlertTriangle size={12} color="#ff1744" />}
                              {!isDuplicate && file.confidence !== undefined && (
                                <div style={{ fontSize: 9, fontWeight: 900, padding: "2px 6px", borderRadius: 4, background: file.confidence > 0.8 ? "rgba(0,200,83,0.1)" : "rgba(255,171,0,0.1)", color: file.confidence > 0.8 ? "#00c853" : "#ffab00", border: `1px solid ${file.confidence > 0.8 ? "rgba(0,200,83,0.2)" : "rgba(255,171,0,0.2)"}` }}>
                                  {Math.round(file.confidence * 100)}% Forensic Match
                                </div>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 2, marginBottom: 6 }}>
                              <span style={{ fontSize: 9, fontWeight: 800, color: isDuplicate ? "#ff1744" : "#00c2cb", textTransform: "uppercase", padding: "1px 4px", background: isDuplicate ? "rgba(255,23,68,0.1)" : "rgba(0,194,203,0.1)", borderRadius: 3 }}>
                                {file.type} {isDuplicate && "· DUPLICATE ⚠"}
                              </span>
                              {file.ocr_engine && (
                                <span style={{ 
                                  fontSize: 9, 
                                  fontWeight: 800, 
                                  padding: "1px 4px", 
                                  borderRadius: 3,
                                  background: file.ocr_engine === "pdfplumber" ? "rgba(0,200,83,0.1)" : 
                                              file.ocr_engine === "paddleocr" ? "rgba(49,130,206,0.1)" :
                                              file.ocr_engine === "easyocr" ? "rgba(128,90,213,0.1)" : "rgba(255,171,0,0.1)",
                                  color: file.ocr_engine === "pdfplumber" ? "#00c853" : 
                                         file.ocr_engine === "paddleocr" ? "#3182ce" :
                                         file.ocr_engine === "easyocr" ? "#805ad5" : "#ffab00",
                                  textTransform: "uppercase"
                                }}>
                                  {file.ocr_engine === "pdfplumber" ? "PDF TEXT" : 
                                   file.ocr_engine === "paddleocr" ? "PRINTED" :
                                   file.ocr_engine === "easyocr" ? "HANDWRITTEN" : "FALLBACK"}
                                </span>
                              )}
                              <span style={{ fontSize: 9, color: "#4a5568" }}>{(file.size / 1024).toFixed(1)} KB</span>
                            </div>
                            {file.summary && (
                              <div style={{ fontSize: 10, color: "#4a5568", background: "#050810", padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.03)", fontStyle: "italic", lineBreak: "anywhere" }}>
                                <span style={{ color: isDuplicate ? "#ff1744" : "#00c2cb", fontWeight: 700, marginRight: 6 }}>Content:</span>
                                {file.summary}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {result && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div style={{ padding: "20px 24px", borderRadius: 14, background: verdictBg[result.verdict!], border: `1px solid ${verdictBorder[result.verdict!]}`, boxShadow: `0 0 30px ${verdictBorder[result.verdict!]}30` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      {result.verdict === "ACCEPTED" ? <CheckCircle2 color="#00c853" size={24} /> : result.verdict === "REJECTED" ? <XCircle color="#ff1744" size={24} /> : <AlertTriangle color="#ffab00" size={24} />}
                      <span style={{ fontSize: 20, fontWeight: 900, color: verdictColor[result.verdict!], letterSpacing: "1px" }}>{result.verdict}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#e8ecf4", opacity: 0.8 }}>{result.verdictReason}</div>
                  </div>

                  {Object.keys(result.duplicateGroups || {}).length > 0 && (
                    <div style={{ padding: "20px", background: "rgba(255,23,68,0.05)", border: "1.5px solid #ff4757", borderRadius: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ff4757", marginBottom: 14 }}>
                        <AlertTriangle size={20} />
                        <span style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: "1px" }}>DUPLICATE FILES DETECTED</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        {Object.entries(result.duplicateGroups).map(([docType, fileNames], i) => (
                          <div key={i} style={{ paddingLeft: 12, borderLeft: "2px solid rgba(255,71,87,0.3)" }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "#ff4757", marginBottom: 6 }}>Document Type: {docType}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <div style={{ fontSize: 11, color: "#e8ecf4", opacity: 0.8 }}>Duplicate Files:</div>
                              {fileNames.map((name, idx) => (
                                <div key={idx} style={{ fontSize: 11, color: "#a0aec0", display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#ff4757" }} />
                                  {name}
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: 10, color: "#ff4757", marginTop: 10, fontStyle: "italic", fontWeight: 700 }}>
                              ⚠ Only one {docType} file allowed per ticket folder. Remove the duplicate.
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ background: "#0d1020", border: "1px solid #1e2535", borderRadius: 14, padding: "20px 24px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", color: "#00c2cb", textTransform: "uppercase", marginBottom: 16 }}>Classification Details</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span style={{ fontSize: 12, color: "#4a5568" }}>Ticket ID</span>
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "monospace" }}>{result.ticketId}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                      <span style={{ fontSize: 12, color: "#4a5568" }}>Detected Category</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#ffab00" }}>{CATEGORY_LABELS[result.category]}</span>
                    </div>
                  </div>

                  <div style={{ background: "#0d1020", border: "1px solid #1e2535", borderRadius: 14, padding: "20px 24px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", color: "#00c2cb", textTransform: "uppercase", marginBottom: 16 }}>Forensic Segregation Logic</div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
                      {/* Card 1 — WARR / GOODWILL / CAMPAIGN */}
                      {(() => {
                        const matched = ["WARR", "GOODWILL", "CAMPAIGN"].includes(result.category);
                        const clr = matched ? "#00c853" : "#3a4558";
                        const txtClr = matched ? "#e8ecf4" : "#4a5568";
                        return (
                          <div style={{ background: matched ? "rgba(0,200,83,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${matched ? "#00c853" : "#1e2535"}`, borderRadius: 14, padding: "16px 14px", position: "relative", opacity: matched ? 1 : 0.4, transition: "all 0.3s ease", display: "flex", flexDirection: "column" }}>
                            {matched && <div style={{ position: "absolute", top: 10, right: 10, background: "#00c853", color: "#050810", fontSize: 8, fontWeight: 900, padding: "2px 6px", borderRadius: 4 }}>MATCHED</div>}
                            <div style={{ fontSize: 10, fontWeight: 900, color: matched ? "#00c853" : "#4a5568", marginBottom: 10, lineHeight: 1.3, paddingRight: matched ? 52 : 0 }}>WARR /<br />GOODWILL /<br />CAMPAIGN</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {["Investigation Report", "Photos / Images"].map((req, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 10, color: txtClr, lineHeight: 1.3 }}>
                                  <CheckCircle2 size={11} color={clr} style={{ flexShrink: 0, marginTop: 1 }} /> {req}
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop: 10, fontSize: 9, color: "#4a5568", fontStyle: "italic" }}>Investigation + Photos only</div>
                            <div style={{ marginTop: 3, fontSize: 9, color: "#ff5555", fontStyle: "italic" }}>No Invoice / Est / Rej</div>
                            {matched && <div style={{ marginTop: 8, fontSize: 9, fontWeight: 800, color: "#00c853" }}>{CATEGORY_LABELS[result.category]}</div>}
                          </div>
                        );
                      })()}

                      {/* Card 2 — PAID / REJECTED */}
                      {(() => {
                        const matched = result.category === "PAID_REJECTED";
                        const clr = matched ? "#00c853" : "#3a4558";
                        const txtClr = matched ? "#e8ecf4" : "#4a5568";
                        return (
                          <div style={{ background: matched ? "rgba(0,200,83,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${matched ? "#00c853" : "#1e2535"}`, borderRadius: 14, padding: "16px 14px", position: "relative", opacity: matched ? 1 : 0.4, transition: "all 0.3s ease", display: "flex", flexDirection: "column" }}>
                            {matched && <div style={{ position: "absolute", top: 10, right: 10, background: "#00c853", color: "#050810", fontSize: 8, fontWeight: 900, padding: "2px 6px", borderRadius: 4 }}>MATCHED</div>}
                            <div style={{ fontSize: 10, fontWeight: 900, color: matched ? "#00c853" : "#4a5568", marginBottom: 10, lineHeight: 1.3, paddingRight: matched ? 52 : 0 }}>PAID /<br />REJECTED</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {["Estimation Report", "Invoice", "Investigation Report", "Photos / Images"].map((req, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 10, color: txtClr, lineHeight: 1.3 }}>
                                  <CheckCircle2 size={11} color={clr} style={{ flexShrink: 0, marginTop: 1 }} /> {req}
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop: 10, fontSize: 9, color: "#4a5568", fontStyle: "italic" }}>All 4 must be present</div>
                          </div>
                        );
                      })()}

                      {/* Card 3 — PAID / PURE */}
                      {(() => {
                        const matched = result.category === "PAID_PURE";
                        const clr = matched ? "#00c853" : "#3a4558";
                        const txtClr = matched ? "#e8ecf4" : "#4a5568";
                        return (
                          <div style={{ background: matched ? "rgba(0,200,83,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${matched ? "#00c853" : "#1e2535"}`, borderRadius: 14, padding: "16px 14px", position: "relative", opacity: matched ? 1 : 0.4, transition: "all 0.3s ease", display: "flex", flexDirection: "column" }}>
                            {matched && <div style={{ position: "absolute", top: 10, right: 10, background: "#00c853", color: "#050810", fontSize: 8, fontWeight: 900, padding: "2px 6px", borderRadius: 4 }}>MATCHED</div>}
                            <div style={{ fontSize: 10, fontWeight: 900, color: matched ? "#00c853" : "#4a5568", marginBottom: 10, lineHeight: 1.3, paddingRight: matched ? 52 : 0 }}>PAID /<br />PURE</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {["Invoice", "Investigation Report", "Photos / Images"].map((req, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 10, color: txtClr, lineHeight: 1.3 }}>
                                  <CheckCircle2 size={11} color={clr} style={{ flexShrink: 0, marginTop: 1 }} /> {req}
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop: 10, fontSize: 9, color: "#4a5568", fontStyle: "italic" }}>Invoice + Investigation + Photos</div>
                            <div style={{ marginTop: 3, fontSize: 9, color: "#ff5555", fontStyle: "italic" }}>No Estimation required</div>
                          </div>
                        );
                      })()}
                    </div>

                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", color: "#00c2cb", textTransform: "uppercase", marginBottom: 16 }}>Document Checklist — {result.category}</div>
                    {result.checklist.map(c => {
                      const matchedFiles = result.files.filter(f => {
                        if (c.name === "Investigation Report") return f.type === "investigation";
                        if (c.name === "Invoice") return f.type === "invoice";
                        if (c.name === "Estimation Report") return f.type === "estimate";
                        if (c.name === "Rejection Report") return f.type === "rejection";
                        if (c.name === "Image/Supporting Doc") return f.type === "image" || f.type === "other";
                        return false;
                      });

                      return (
                        <div key={c.name} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#e8ecf4", marginBottom: 4 }}>{c.name}</div>
                            {matchedFiles.map((mf, i) => (
                              <div
                                key={i}
                                onClick={() => setOcrPreview({ name: mf.name, text: mf.fullText || "No text could be extracted from this file" })}
                                style={{
                                  fontSize: 11,
                                  color: "#00d4aa",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  cursor: "pointer",
                                  padding: "4px 0",
                                  transition: "all 0.2s",
                                  textDecoration: "none"
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.textDecoration = "underline";
                                  e.currentTarget.style.opacity = "0.8";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.textDecoration = "none";
                                  e.currentTarget.style.opacity = "1";
                                }}
                              >
                                <FileText size={12} /> {mf.name}
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, color: c.present ? "#00c853" : "#ff1744", marginTop: 2 }}>
                            {c.present ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                            <span style={{ fontSize: 10, fontWeight: 800 }}>{c.present ? "PRESENT" : "MISSING"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AMOUNT VERIFICATION CARD */}
              {result && result.amountVerification && (
                <div style={{ background: "#0d1020", border: "1px solid #1e2535", borderRadius: 14, padding: "20px 24px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", color: "#00c2cb", textTransform: "uppercase", marginBottom: 16 }}>Amount Verification</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ background: "#080c14", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e2535" }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#a0aec0", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Estimation</div>
                      {result.amountVerification.estimation && result.amountVerification.estimation.subtotal > 0 ? (<>
                        {([["Sub Total", result.amountVerification.estimation.subtotal], ["GST", result.amountVerification.estimation.gst_amount], ["Grand Total", result.amountVerification.estimation.total]] as [string, number][]).map(([lbl, val], i, arr) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                            <span style={{ fontSize: 11, color: "#4a5568" }}>{lbl}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>Rs. {val.toFixed(2)}</span>
                          </div>
                        ))}
                        {result.amountVerification.estimationCheck && <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>{result.amountVerification.estimationCheck.passed ? <CheckCircle2 size={12} color="#00c853" /> : <XCircle size={12} color="#ff1744" />}<span style={{ fontSize: 10, color: result.amountVerification.estimationCheck.passed ? "#00c853" : "#ff6b6b" }}>{result.amountVerification.estimationCheck.message}</span></div>}
                      </>) : <div style={{ fontSize: 10, color: "#4a5568", fontStyle: "italic" }}>No amounts extracted</div>}
                    </div>
                    <div style={{ background: "#080c14", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e2535" }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#a0aec0", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Invoice</div>
                      {result.amountVerification.invoice && result.amountVerification.invoice.subtotal > 0 ? (<>
                        {([["Sub Total", result.amountVerification.invoice.subtotal], ["GST", result.amountVerification.invoice.gst_amount], ["Final Total", result.amountVerification.invoice.total]] as [string, number][]).map(([lbl, val], i, arr) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                            <span style={{ fontSize: 11, color: "#4a5568" }}>{lbl}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>Rs. {val.toFixed(2)}</span>
                          </div>
                        ))}
                        {result.amountVerification.invoiceCheck && <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>{result.amountVerification.invoiceCheck.passed ? <CheckCircle2 size={12} color="#00c853" /> : <XCircle size={12} color="#ff1744" />}<span style={{ fontSize: 10, color: result.amountVerification.invoiceCheck.passed ? "#00c853" : "#ff6b6b" }}>{result.amountVerification.invoiceCheck.message}</span></div>}
                      </>) : <div style={{ fontSize: 10, color: "#4a5568", fontStyle: "italic" }}>No amounts extracted</div>}
                    </div>
                  </div>
                  {result.amountVerification.crossCheck && (
                    <div style={{ padding: "12px 16px", borderRadius: 10, background: result.amountVerification.crossCheck.passed ? "rgba(0,200,83,0.06)" : "rgba(255,23,68,0.06)", border: `1px solid ${result.amountVerification.crossCheck.passed ? "rgba(0,200,83,0.2)" : "rgba(255,23,68,0.2)"}` }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#a0aec0", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 8 }}>Cross Check — Estimation vs Invoice</div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ fontSize: 11, color: "#4a5568" }}>Estimation Grand Total</span><span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>Rs. {result.amountVerification.crossCheck.estTotal.toFixed(2)}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}><span style={{ fontSize: 11, color: "#4a5568" }}>Invoice Final Total</span><span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>Rs. {result.amountVerification.crossCheck.invTotal.toFixed(2)}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", marginBottom: 8 }}><span style={{ fontSize: 11, color: "#4a5568" }}>Difference</span><span style={{ fontSize: 12, fontWeight: 800, color: result.amountVerification.crossCheck.passed ? "#00c853" : "#ff1744" }}>{result.amountVerification.crossCheck.diffPct}%</span></div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{result.amountVerification.crossCheck.passed ? <CheckCircle2 size={14} color="#00c853" /> : <XCircle size={14} color="#ff1744" />}<span style={{ fontSize: 11, fontWeight: 800, color: result.amountVerification.crossCheck.passed ? "#00c853" : "#ff1744" }}>{result.amountVerification.crossCheck.passed ? "WITHIN RANGE" : "SIGNIFICANT DIFFERENCE — possible tampering"}</span></div>
                    </div>
                  )}
                </div>
              )}
              {/* VEHICLE IDENTITY VERIFICATION CARD */}
              {result && result.vehicleVerification && (
                <div style={{ background: "#0d1020", border: `1px solid ${result.vehicleVerification.overallValid ? "rgba(0,200,83,0.3)" : "rgba(255,23,68,0.3)"}`, borderRadius: 14, padding: "20px 24px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", color: result.vehicleVerification.overallValid ? "#00c853" : "#ff1744", textTransform: "uppercase", marginBottom: 16 }}>Vehicle Identity Verification</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ background: "#080c14", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e2535" }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#a0aec0", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Chassis Number</div>
                      <div style={{ padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><div style={{ fontSize: 9, color: "#4a5568" }}>Investigation</div><div style={{ fontSize: 11, fontFamily: "monospace", color: "#e8ecf4", marginTop: 1 }}>{result.vehicleVerification.inv.chassis || "—"}</div></div>
                      <div style={{ padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", marginBottom: 8 }}><div style={{ fontSize: 9, color: "#4a5568" }}>Estimation</div><div style={{ fontSize: 11, fontFamily: "monospace", color: "#e8ecf4", marginTop: 1 }}>{result.vehicleVerification.est.chassis || "—"}</div></div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{result.vehicleVerification.chassisFormatOk ? <CheckCircle2 size={11} color="#00c853" /> : <XCircle size={11} color="#ff1744" />}<span style={{ fontSize: 10, color: result.vehicleVerification.chassisFormatOk ? "#00c853" : "#ff6b6b" }}>Format valid (17 chars)</span></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{result.vehicleVerification.chassisWmiOk ? <CheckCircle2 size={11} color="#00c853" /> : <XCircle size={11} color="#ff1744" />}<span style={{ fontSize: 10, color: result.vehicleVerification.chassisWmiOk ? "#00c853" : "#ff6b6b" }}>WMI valid</span></div>
                        {result.vehicleVerification.chassisMatch !== null && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{result.vehicleVerification.chassisMatch ? <CheckCircle2 size={11} color="#00c853" /> : <XCircle size={11} color="#ff1744" />}<span style={{ fontSize: 10, fontWeight: 800, color: result.vehicleVerification.chassisMatch ? "#00c853" : "#ff1744" }}>{result.vehicleVerification.chassisMatch ? "MATCH" : "MISMATCH — Fraud risk"}</span></div>}
                      </div>
                    </div>
                    <div style={{ background: "#080c14", borderRadius: 10, padding: "14px 16px", border: "1px solid #1e2535" }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: "#a0aec0", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 10 }}>Registration Number</div>
                      <div style={{ padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}><div style={{ fontSize: 9, color: "#4a5568" }}>Investigation</div><div style={{ fontSize: 11, fontFamily: "monospace", color: "#e8ecf4", marginTop: 1 }}>{result.vehicleVerification.inv.registration || "—"}</div></div>
                      <div style={{ padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", marginBottom: 8 }}><div style={{ fontSize: 9, color: "#4a5568" }}>Estimation</div><div style={{ fontSize: 11, fontFamily: "monospace", color: "#e8ecf4", marginTop: 1 }}>{result.vehicleVerification.est.registration || "—"}</div></div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{result.vehicleVerification.regFormatOk ? <CheckCircle2 size={11} color="#00c853" /> : <XCircle size={11} color="#ff1744" />}<span style={{ fontSize: 10, color: result.vehicleVerification.regFormatOk ? "#00c853" : "#ff6b6b" }}>Format valid</span></div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{result.vehicleVerification.regStateOk ? <CheckCircle2 size={11} color="#00c853" /> : <XCircle size={11} color="#ff1744" />}<span style={{ fontSize: 10, color: result.vehicleVerification.regStateOk ? "#00c853" : "#ff6b6b" }}>State code valid</span></div>
                        {result.vehicleVerification.regMatch !== null && <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{result.vehicleVerification.regMatch ? <CheckCircle2 size={11} color="#00c853" /> : <XCircle size={11} color="#ff1744" />}<span style={{ fontSize: 10, fontWeight: 800, color: result.vehicleVerification.regMatch ? "#00c853" : "#ff1744" }}>{result.vehicleVerification.regMatch ? "MATCH" : "MISMATCH — Fraud risk"}</span></div>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* EXPORT BUTTONS */}
              {result && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, gap: 12 }}>
                  <button
                    onClick={() => exportSingleCSV(result)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "rgba(0,194,203,0.05)",
                      border: "1px solid rgba(0,194,203,0.3)",
                      borderRadius: 12, padding: "12px 24px",
                      color: "#00c2cb", fontSize: 11, fontWeight: 800,
                      cursor: "pointer", letterSpacing: "0.5px",
                      transition: "all 0.2s ease",
                      textTransform: "uppercase"
                    }}
                  >
                    <FileText size={16} />
                    Export CSV
                  </button>
                  <button
                    onClick={() => exportToExcel(result)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "linear-gradient(135deg, rgba(0,194,203,0.15), rgba(0,200,83,0.1))",
                      border: "1px solid rgba(0,194,203,0.4)",
                      borderRadius: 12, padding: "12px 24px",
                      color: "#00c2cb", fontSize: 11, fontWeight: 800,
                      cursor: "pointer", letterSpacing: "0.5px",
                      transition: "all 0.2s ease",
                      textTransform: "uppercase"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(0,194,203,0.25), rgba(0,200,83,0.18))"; e.currentTarget.style.borderColor = "rgba(0,194,203,0.8)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,194,203,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(0,194,203,0.15), rgba(0,200,83,0.1))"; e.currentTarget.style.borderColor = "rgba(0,194,203,0.4)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Export Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* BATCH MODE UI */
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* UPLOAD & CONTROLS */}
          <div style={{ background: "#0a0d14", border: "1px solid #1e2535", borderRadius: 14, padding: "32px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div style={{ textAlign: "center", paddingRight: 32, borderRight: "1px solid #1e2535" }}>
              <input type="file" ref={batchInputRef} style={{ display: "none" }} onChange={handleBatchSelect} {...({ webkitdirectory: "", directory: "", multiple: true } as any)} />
              <div onClick={() => batchInputRef.current?.click()} style={{ cursor: "pointer", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(0,194,203,0.05)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(0,194,203,0.2)" }}>
                  <Download size={28} color="#00c2cb" />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#e8ecf4" }}>Upload Batch Folder</div>
                <div style={{ fontSize: 11, color: "#4a5568" }}>Select a folder containing multiple ticket folders</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
              {batchData ? (
                <>
                  <div style={{ fontSize: 12, color: "#e8ecf4" }}>
                    Detected: <span style={{ color: "#00d4aa", fontWeight: 800 }}>{batchData.validIds.length} Valid Folders</span>
                    {batchData.invalidIds.length > 0 && <span style={{ color: "#ff1744", marginLeft: 12 }}>{batchData.invalidIds.length} Skipped</span>}
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    {!batchRunning ? (
                      <button
                        onClick={startBatch}
                        disabled={batchData.validIds.length === 0}
                        style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#00d4aa", color: "#050d1a", border: "none", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <Play size={16} fill="currentColor" /> START BATCH
                      </button>
                    ) : (
                      <button
                        onClick={stopBatch}
                        style={{ flex: 1, padding: "12px", borderRadius: 10, background: "#ff1744", color: "#e8ecf4", border: "none", fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      >
                        <Square size={16} fill="currentColor" /> STOP BATCH
                      </button>
                    )}
                    <button onClick={() => setBatchData(null)} style={{ padding: "12px 20px", borderRadius: 10, background: "transparent", color: "#4a5568", border: "1px solid #1e2535", fontWeight: 800, cursor: "pointer" }}>CLEAR</button>
                  </div>
                </>
              ) : (
                <div style={{ color: "#4a5568", fontSize: 12, fontStyle: "italic", textAlign: "center" }}>Ready for bulk processing.</div>
              )}
            </div>
          </div>

          {/* PROGRESS */}
          {batchRunning && (
            <div style={{ background: "#0d1526", border: "1px solid #1a2744", borderRadius: 14, padding: "20px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Loader2 size={16} className="animate-spin" color="#00d4aa" />
                  <span style={{ fontSize: 13, fontWeight: 800 }}>Processing: {batchProgress.currentTicket}</span>
                </div>
                <span style={{ fontSize: 12, color: "#4a5568" }}>{batchProgress.current} / {batchProgress.total}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} style={{ height: "100%", background: "#00d4aa" }} />
              </div>
            </div>
          )}

          {batchResults.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
              {/* ANALYTICS */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ background: "#080c14", border: "1px solid #1e2535", borderRadius: 14, padding: "24px" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#00c2cb", textTransform: "uppercase", marginBottom: 20 }}>Aggregate Results</div>
                  <div style={{ height: 180, display: "flex", justifyContent: "center", position: "relative" }}>
                    <Doughnut
                      data={{
                        labels: ["ACCEPTED", "REJECTED", "SUSPICIOUS"],
                        datasets: [{
                          data: [
                            batchResults.filter(r => r.verdict === "ACCEPTED").length,
                            batchResults.filter(r => r.verdict === "REJECTED").length,
                            batchResults.filter(r => r.verdict === "SUSPICIOUS").length
                          ],
                          backgroundColor: ["#00c853", "#ff1744", "#ffab00"],
                          borderWidth: 0, cutout: "70%"
                        }]
                      }}
                      options={{ plugins: { legend: { display: false } } }}
                    />
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 900 }}>{batchResults.length}</div>
                      <div style={{ fontSize: 8, color: "#4a5568", fontWeight: 800 }}>TOTAL</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { lbl: "Accepted", count: batchResults.filter(r => r.verdict === "ACCEPTED").length, clr: "#00c853" },
                      { lbl: "Rejected", count: batchResults.filter(r => r.verdict === "REJECTED").length, clr: "#ff1744" },
                      { lbl: "Suspicious", count: batchResults.filter(r => r.verdict === "SUSPICIOUS").length, clr: "#ffab00" },
                    ].map(s => (
                      <div key={s.lbl} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: "#4a5568" }}>{s.lbl}</span>
                        <span style={{ fontWeight: 800, color: s.clr }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={exportBatchCSV} style={{ padding: "14px", borderRadius: 12, background: "rgba(0,194,203,0.1)", border: "1px solid rgba(0,194,203,0.3)", color: "#00c2cb", fontWeight: 800, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Download size={16} /> EXPORT CSV
                  </button>
                  <button onClick={exportBatchExcel} style={{ padding: "14px", borderRadius: 12, background: "linear-gradient(135deg, rgba(0,194,203,0.15), rgba(0,200,83,0.1))", border: "1px solid rgba(0,194,203,0.4)", color: "#00c2cb", fontWeight: 800, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Download size={16} /> EXPORT EXCEL
                  </button>
                </div>
              </div>

              {/* TABLE */}
              <div style={{ background: "#080c14", border: "1px solid #1e2535", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "12px 20px", borderBottom: "1px solid #1e2535", display: "flex", gap: 12 }}>
                  <Filter size={14} color="#4a5568" />
                  {["ALL", "ACCEPTED", "REJECTED", "SUSPICIOUS"].map(f => (
                    <button key={f} onClick={() => setBatchFilter(f as any)} style={{ fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 6, border: "none", cursor: "pointer", background: batchFilter === f ? "#00c2cb" : "transparent", color: batchFilter === f ? "#050d1a" : "#4a5568" }}>{f}</button>
                  ))}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid #1e2535" }}>
                      <th style={{ padding: "12px 20px", textAlign: "left", color: "#4a5568" }}>TICKET ID</th>
                      <th style={{ padding: "12px 20px", textAlign: "left", color: "#4a5568" }}>VERDICT</th>
                      <th style={{ padding: "12px 20px", textAlign: "left", color: "#4a5568" }}>DUPLICATES</th>
                      <th style={{ padding: "12px 20px", textAlign: "right", color: "#4a5568" }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResults.filter(r => batchFilter === "ALL" || r.verdict === batchFilter).map(r => {
                      const duplicateCount = Object.keys(r.duplicateGroups || {}).length;
                      return (
                        <tr key={r.ticketId} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          <td style={{ padding: "12px 20px", fontWeight: 800, fontFamily: "monospace" }}>{r.ticketId}</td>
                          <td style={{ padding: "12px 20px", color: verdictColor[r.verdict!], fontWeight: 800 }}>{r.verdict}</td>
                          <td style={{ padding: "12px 20px" }}>
                            {duplicateCount > 0 ? (
                              <span style={{ color: "#ff1744", fontSize: 11, fontWeight: 800 }}>⚠ {duplicateCount} duplicate(s)</span>
                            ) : (
                              <span style={{ color: "#00c853", fontSize: 11, fontWeight: 800 }}>None</span>
                            )}
                          </td>
                          <td style={{ padding: "12px 20px", textAlign: "right" }}>
                            <button
                              onClick={() => setFilePreviewResult(r)}
                              title="View Files in Folder"
                              style={{
                                background: "rgba(0,194,203,0.05)",
                                border: "1px solid rgba(0,194,203,0.3)",
                                color: "#00c2cb",
                                padding: "4px 8px",
                                borderRadius: 6,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 8,
                                height: 24,
                                verticalAlign: "middle",
                                transition: "all 0.2s"
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = "rgba(0,194,203,0.15)"}
                              onMouseLeave={e => e.currentTarget.style.background = "rgba(0,194,203,0.05)"}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => { setValidationMode("single"); setDetectedTicketId(r.ticketId); setSelectedFiles(r.files); setResult(r); setSteps(INIT_STEPS.map(s => ({ ...s, status: "pass" }))); }}
                              style={{ background: "transparent", border: "1px solid #1e2535", color: "#00c2cb", padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800, cursor: "pointer", height: 24, verticalAlign: "middle" }}
                            >
                              VIEW
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* OCR MODAL */}
      {ocrPreview && (
        <div
          onClick={() => setOcrPreview(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#0d1526", border: "0.5px solid #1a2744", borderRadius: 12, width: "65vw", height: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 50px 100px -20px rgba(0,0,0,0.7)" }}
          >
            {/* MODAL TITLE BAR */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2744", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: "#00d4aa", textTransform: "uppercase", letterSpacing: "2px", marginBottom: 4 }}>
                  OCR Text Preview
                  {ocrPreview.engine && (
                    <span style={{ marginLeft: 12, color: "#4a5568", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4, textTransform: "none", fontSize: 9 }}>
                      OCR Engine: {ocrPreview.engine === "easyocr" ? "EasyOCR" : ocrPreview.engine === "paddleocr" ? "PaddleOCR" : ocrPreview.engine} ({ocrPreview.type === "handwritten" ? "Handwritten detected" : ocrPreview.type === "printed" ? "Printed text" : ocrPreview.type === "pdfplumber" ? "Digital PDF" : ocrPreview.type})
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e8ecf4" }}>{ocrPreview.name}</div>
              </div>
              <button
                onClick={() => setOcrPreview(null)}
                style={{ background: "transparent", border: "none", color: "#4a5568", cursor: "pointer", padding: 8, transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ff1744")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4a5568")}
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "#0d1526" }}>
              {ocrPreview.text && ocrPreview.text.length > 10 ? (
                <>
                  <div style={{ padding: "16px 12px", borderRight: "1px solid #1a2744", background: "rgba(0,0,0,0.1)", textAlign: "right", userSelect: "none" }}>
                    {ocrPreview.text.split("\n").map((_, i) => (
                      <div key={i} style={{ fontSize: 13, color: "#2d3748", fontFamily: "monospace", lineHeight: "1.6" }}>{i + 1}</div>
                    ))}
                  </div>
                  <div style={{ flex: 1, padding: 16, overflowY: "auto", fontFamily: "monospace", fontSize: 13, lineHeight: "1.6", color: "#00d4aa", whiteSpace: "pre-wrap" }}>
                    {ocrPreview.text}
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center", color: "#4a5568" }}>
                  <AlertTriangle size={48} style={{ marginBottom: 20, opacity: 0.5 }} />
                  <div style={{ fontSize: 14, color: "#e8ecf4", marginBottom: 12, maxWidth: 400 }}>
                    Text extraction attempted but no readable text found in this file.
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: "20px 24px", borderTop: "1px solid #1a2744", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.1)" }}>
              <button
                onClick={() => { navigator.clipboard.writeText(ocrPreview.text); alert("Copied!"); }}
                style={{ background: "rgba(0,212,170,0.1)", border: "1px solid rgba(0,212,170,0.2)", color: "#00d4aa", padding: "8px 20px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                COPY TEXT
              </button>
              <button onClick={() => setOcrPreview(null)} style={{ background: "#1a2744", border: "none", color: "#e8ecf4", padding: "8px 20px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {/* FILE LIST PREVIEW MODAL */}
      <AnimatePresence>
        {filePreviewResult && (
          <div
            onClick={() => setFilePreviewResult(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: "#0d1526", border: "0.5px solid #1a2744", borderRadius: 12, width: 420, maxHeight: "70vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 50px 100px -20px rgba(0,0,0,0.5)" }}
            >
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #1a2744", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#e8ecf4" }}>Files in Ticket {filePreviewResult.ticketId}</div>
                  <div style={{ fontSize: 11, color: "#4a5568", marginTop: 2 }}>{filePreviewResult.files.length} files found</div>
                </div>
                <button
                  onClick={() => setFilePreviewResult(null)}
                  style={{ background: "transparent", border: "none", color: "#4a5568", cursor: "pointer", padding: 4 }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
                {filePreviewResult.files.map((file, idx) => {
                  const badgeColors: Record<string, string> = {
                    investigation: "#00c2cb",
                    invoice: "#3182ce",
                    estimate: "#dd6b20",
                    rejection: "#e53e3e",
                    image: "#38a169",
                    other: "#718096"
                  };
                  const isImage = ["image"].includes(file.type);
                  const isDuplicate = filePreviewResult.duplicateGroups && Object.values(filePreviewResult.duplicateGroups).flat().includes(file.name);

                  return (
                    <div key={idx} style={{ padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.02)", display: "flex", alignItems: "center", gap: 16, background: isDuplicate ? "rgba(255,23,68,0.03)" : "transparent" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: isDuplicate ? "rgba(255,23,68,0.1)" : "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: isDuplicate ? "1px solid rgba(255,23,68,0.2)" : "none" }}>
                        {isImage ? <Zap size={16} color="#38a169" /> : <FileText size={16} color={isDuplicate ? "#ff4757" : "#00c2cb"} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isDuplicate ? "#ff4757" : "#e8ecf4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name} {isDuplicate && "⚠"}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 900, color: isDuplicate ? "#ff4757" : (badgeColors[file.type] || "#718096"), textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {file.type.toUpperCase()} {isDuplicate && "· DUPLICATE"}
                          </span>
                          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#4a5568" }} />
                          <span style={{ fontSize: 9, color: "#4a5568" }}>{(file.size / 1024).toFixed(1)} KB</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
