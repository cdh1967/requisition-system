// Simple localStorage wrapper
const KEY_INVENTORY = 'rsi_inventory';
const KEY_REQUISITIONS = 'rsi_requisitions';
const KEY_LOGS = 'rsi_inventory_logs';

export function loadInventory() {
  return JSON.parse(localStorage.getItem(KEY_INVENTORY)) || [];
}

export function saveInventory(items) {
  localStorage.setItem(KEY_INVENTORY, JSON.stringify(items));
}

export function loadRequisitions() {
  return JSON.parse(localStorage.getItem(KEY_REQUISITIONS)) || [];
}

export function saveRequisitions(slips) {
  localStorage.setItem(KEY_REQUISITIONS, JSON.stringify(slips));
}

export function loadLogs() {
  return JSON.parse(localStorage.getItem(KEY_LOGS)) || [];
}

export function saveLogs(logs) {
  localStorage.setItem(KEY_LOGS, JSON.stringify(logs));
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function loadSeedData() {
  const medicalSupplies = [
    "SCRUB POVIDONE IODINE 7.5%", "SOLUSET", "ALCOHOL", "ASEPTO SYRINGE", "AUTOCLAVE TAPE", "BLOODSET", 
    "BRACELET ADULT", "BRACELET PEDIA BLUE", "BRACELET PEDIA PINK", "CHROMIC 0", "CHROMIC 1", "CHROMIC 2-0", 
    "CHROMIC 3-0", "CHROMIC 4-0", "CIDEX-STERANIOS", "COTTON 400 GRMS", "DISPOSABLE FACE MASK (EARLOOP) 2 PLY 50'S", 
    "ECG PAPER 80MM X 20M", "ELASTIC BANDAGE 2", "ELASTIC BANDAGE 4", "ELASTIC BANDAGE 6", "ETT 2.5", "ETT 2", 
    "ETT 3.5", "ETT 3", "ETT 4.5", "ETT 4", "ETT 5.5", "ETT 5", "ETT 6 .5", "ETT 6", "ETT 7.5", "ETT 7", "ETT 8", 
    "EXAMINATION GLOVES (M) DONATION", "EXAMINATION GLOVES LARGE", "EXAMINATION GLOVES MEDIUM", "EXAMINATION GLOVES SMALL", 
    "EXAMINATION GLOVES XL", "Foley Bag Catheter 2 way FR.10", "Foley Bag Catheter 2 way FR.12", "Foley Bag Catheter 2 way FR.14", 
    "Foley Bag Catheter 2 way FR.16", "GAUZE", "GLOVES S6.5", "GLOVES S6", "GLOVES S7.5", "GLOVES S7", "GOGGLES", 
    "HEAD COVER", "HEPLOCK", "HOT WATER BAG", "HYPOALLERGENIC PLASTER", "ICE CAPS", "INSULINE SYRINGE", "ISOLATION GOWN", 
    "KELLY PAD", "KN 95", "KY JELLY 150 GRMS", "LYSOL SPRAY 510 GRMS", "LYSOL", "MERSILK 2.0 CUTTING", "MERSILK 3.0 CUTTING", 
    "MERSILK 4.0 CUTTING", "N95", "NEWBORN SCREENING KIT", "NGT-STOMACH TUBE FR 5", "NGT-STOMACH TUBE FR 8", "NGT-STOMACH TUBE FR 10", 
    "NGT-STOMACH TUBE FR 12", "NGT-STOMACH TUBE FR 14", "NGT-STOMACH TUBE FR 16", "ORAL CONTRACEPTIVE", "OXYGEN FACE MASK RESERVOIR (ADULT)", 
    "OXYGEN FACE MASK RESERVOIR (PEDIA)", "PLAIN 2-0", "PLASTER 0.5 INCH", "PLASTER 1 INCH", "PLASTER 2 INCH", "PLASTER 3 INCH", 
    "PLASTER", "POVIDONE IODINE 7.5", "POVIDONE IODINE 10%", "POVIDONE IODINE SCRUB", "PPE", "SHOE COVER", "SILK 2-0", "SILK 4-0", 
    "SPINAL NEEDLE G-23", "SPINAL NEEDLE G-25", "SUCTION CATHER FR 5", "SUCTION CATHER FR 8", "SUCTION CATHER FR 10", 
    "SUCTION CATHER FR 12", "SUCTION CATHER FR 14", "SUCTION CATHER FR 16", "SURGICAL BLADE 10", "SURGICAL BLADE 12", 
    "SURGICAL BLADE 20", "SYRINGE 1CC", "SYRINGE 3CC", "SYRINGE 5CC", "SYRINGE 10CC", "THERMOMETER", "UMBILICAL CORD CLAMP", 
    "UNDERPADS 60 X 180CM", "URINE BAG", "URINE COLLECTOR", "VICRYL 3-0 CUTTING", "VICRYL 3-0 ROUND", "VICRYL 4-0 ROUND", 
    "WHITE PLASTIC CUP WITH COVER FOR URINE ...", "X-RAY DEVELOPER", "X-RAY FILM 11X14", "X-RAY FILM 14X14", "X-RAY FILM 14X17", 
    "X-RAY FILM", "X-RAY FIXER", "YANKUER SUCKER", "D5 0.3 NACL 500ML (BLUE)", "D5 0.3 NACL 1000ML (BLUE)", "D5 IMB 500ML", 
    "D5 LR 500ML (PINK)", "D5 LR 1000ML", "D5 NM 1 LITER (ORANGE)", "D5 NSS 1000ML (YELLOW)", "D5 WATER 500ML", "D5 WATER 1000ML", 
    "FOLEY CATHETER FR 14", "FOLEY CATHETER FR 16", "I.V. CATHETER NEEDLE G-18 INJ. PORT", "I.V. CATHETER NEEDLE G-20 INJ. PORT", 
    "I.V. CATHETER NEEDLE G-22", "I.V. CATHETER NEEDLE G-24 INJ. PORT", "I.V. CATHETER NEEDLE G-26 INJ. PORT -", "MACROSET", 
    "MICROSET", "NASAL OXYGEN CANNULA (ADULT)", "NASAL OXYGEN CANNULA (PEDIA)", "NEBULIZING KIT (ADULT)", "NEBULIZING KIT (PEDIA)", 
    "NON REBREATHING MASK (ADULT)", "PLR 1000ML", "PNSS 1000ML"
  ];

  const officeSupplies = [
    "BALLPEN BLACK", "BALLPEN BLUE", "BATTERY, AA", "BATTERY, AAA", "BATTERY, C SIZE", "BONDPAPER A4", "BONDPAPER LONG", 
    "CARBON FILM LEGAL", "CORRECTION TAPE", "CUTTER BLADE", "ENVELOPE LONG", "ENVELOPE SHORT", "FLAG", "FOLDER A4", 
    "FOLDER LONG (VIOLET)", "FOLDER LONG GREEN", "FOLDER LONG", "FOLDER SHORT", "HIGHLIGHTER", "MAILING ENVELOPE", 
    "PAPER CLIP", "PAPER FASTENER", "PASTE", "PAYROL PAPER", "PENTELPEN", "RECORD BOOK 300 pgs", "RUBBER BAND", "SCOTCH TAPE", 
    "SIGNPEN", "STAMP PAD", "STAPLE WIRE #35", "SUPPLY LEDGER CARD", "TAPE PAPER", "TAPE TRANSPARENT", "UNIVERSAL INK 1000ML BLACK", 
    "UNIVERSAL INK 1000ML BLUE", "UNIVERSAL INK 1000ML RED", "UNIVERSAL INK 1000ML YELLOW", "WATER 10 LITERS", "WHITE BOARD MARKER"
  ];

  const janitorialSupplies = [
    "BOWL BRUSH", "BROOM", "BRUSH WITH HANDLE", "DETERGENT", "DISINFECTANT", "DUSH PAN", "GARBAGE BAG LARGE", "GARBAGE BAG XL", 
    "LAUNDRY GLOVES", "LED BULB 9 WTTS", "MOP HANDLE", "MOP HEAD", "NATURAL CITRUS", "PUMP", "RUG", "WAX", "ZONROX"
  ];

  const formatItems = (items, category) => items.map((name) => ({
    id: generateId(),
    name: name,
    category: category,
    qty: 100,
    unit: 'pcs',
    unitCost: 100 // <-- Added default unitCost
  }));

  return [
    ...formatItems(medicalSupplies, 'Medical Supplies'),
    ...formatItems(officeSupplies, 'Office Supplies'),
    ...formatItems(janitorialSupplies, 'Janitorial Supplies')
  ];
}