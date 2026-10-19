"use client";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import {
  listModelExamHallTickets, createModelExamHallTicket, editModelExamHallTicket,
  deleteModelExamHallTicket, getModelExamTimetables, saveModelExamTimetables,
} from "@/lib/modelExamClient";
import {
  Plus, Save, Download, Printer, Eye, Pencil, Trash2, CalendarDays,
  FileText, Search, RotateCcw, X, Loader2,
} from "lucide-react";
import "./hall-ticket.css";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { madrasaMatchesMekhala } from "@/lib/madrasaHierarchy";

const CLASSES = ["Class 5", "Class 7", "Class 10", "Class 12"];
const EMPTY_TICKET = {
  name: "",
  gender: "",
  examCenter: "",
  className: "Class 5",
  hallTicketNumber: "",
  madarsaId: "",
  madarsaName: "",
  mekhalaId: "",
  mekhala: "",
};
const DEFAULT_SETTINGS = {
  boardName: "ദക്ഷിണ കേരള ഇസ്ലാം മത വിദ്യാഭ്യാസ ബോർഡ്",
  examName: "മോഡൽ പരീക്ഷ", academicYear: "2027",
  timetables: Object.fromEntries(CLASSES.map(c=>[c,[]])),
};


/* ============================================
   TIME CONVERSION AND AUTO DURATION
============================================ */

// Converts 9:30 AM or 14:30 to HH:mm
function normalizeTime(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)?$/i);

  if (!match) return "";

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (period) {
    if (hours < 1 || hours > 12) return "";

    hours =
      (hours % 12) +
      (period === "PM" ? 12 : 0);
  } else if (hours > 23) {
    return "";
  }

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0")
  );
}

// Convert 24-hour time to 12-hour format
function formatTime12(value) {
  const time = normalizeTime(value);

  if (!time) return "";

  const [hours, minutes] = time
    .split(":")
    .map(Number);

  const hour12 = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";

  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

// Automatically calculate time and duration
function calculateTimeRange(startTime, endTime) {
  const start = normalizeTime(startTime);
  const end = normalizeTime(endTime);

  if (!start || !end) return null;

  const [startHour, startMinute] = start
    .split(":")
    .map(Number);

  const [endHour, endMinute] = end
    .split(":")
    .map(Number);

  const startTotal =
    startHour * 60 + startMinute;

  const endTotal =
    endHour * 60 + endMinute;

  const totalMinutes = endTotal - startTotal;

  // Same-day exams only
  if (totalMinutes <= 0) return null;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const duration = [
    hours
      ? `${hours} ${hours === 1 ? "Hour" : "Hours"}`
      : "",
    minutes
      ? `${minutes} ${minutes === 1 ? "Minute" : "Minutes"}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    startTime: start,
    endTime: end,
    time: `${formatTime12(start)} - ${formatTime12(end)}`,
    duration,
  };
}

/* ============================================
   LOAD OLD FIREBASE TIMETABLE FORMAT
============================================ */

function hydrateTimetableRow(row) {
  const oldTime = String(row?.time || "");

  const match = oldTime.match(
    /^\s*(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)\s*[-–—]\s*(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)\s*$/i
  );

  const startTime = normalizeTime(
    row?.startTime || match?.[1] || ""
  );

  const endTime = normalizeTime(
    row?.endTime || match?.[2] || ""
  );

  const calculated = calculateTimeRange(
    startTime,
    endTime
  );

  return {
    ...row,
    startTime,
    endTime,
    ...(calculated
      ? {
          time: calculated.time,
          duration: calculated.duration,
        }
      : {}),
  };
}

const TERMS = [
  "ഉത്തരപ്പേപ്പറിൽ രജിസ്റ്റർ നമ്പർ മാത്രം എഴുതുക.",
  "ഹാൾ ടിക്കറ്റ് പരീക്ഷയുടെ അവസാന നിമിഷം വരെ സൂക്ഷിക്കുക.",
  'ഫിഖ്ഹ് പേപ്പറുകളിൽ ശാഫികൾ "ശാഫി" എന്നും ഹനഫികൾ "ഹനഫി" എന്നും എഴുതുക.',
  "തിരിച്ചറിയാൻ കഴിയുന്ന വിധത്തിൽ പേന കൊണ്ട് വൃത്തിയായി എഴുതുക.",
  "നിശ്ചിത സമയം കഴിഞ്ഞ് 15 മിനിറ്റ് താമസിച്ച് വരുന്നവർക്ക് പരീക്ഷാ ഹാളിൽ പ്രവേശനം ലഭിക്കുന്നതല്ല.",
  "ക്രമക്കേട് കാണിക്കുന്നവരെ പുറത്താക്കാനുള്ള അധികാരം സൂപ്പർവൈസർക്ക് ഉണ്ടായിരിക്കുന്നതാണ്.",
  "പരീക്ഷാ ഹാളിൽ മൊബൈൽ ഫോൺ ഉപയോഗിക്കാൻ പാടില്ല. അടിയന്തര ആവശ്യങ്ങൾക്ക് സൂപ്പർവൈസറുടെ അനുമതി വാങ്ങണം.",
];
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";

const getMadrasaId = (m) =>
  String(
    m?.madarsaId ||
    m?.madrasaId ||
    m?.mid ||
    m?.id ||
    ""
  ).trim();

function findMadrasa(madarsas, id) {
  const wanted = String(id ?? "").trim().toLowerCase();
  if (!wanted) return null;

  return madarsas.find((m) =>
    [m.id, m.madarsaId, m.madrasaId, m.mid].some(
      (v) => String(v ?? "").trim().toLowerCase() === wanted
    )
  ) || null;
}

function findMekhala(madrasa, mekhalas) {
  if (!madrasa || !Array.isArray(mekhalas)) return null;

  // Important DKJU hierarchy distinction:
  // "mekhala" collection / madrasa.mekhalaId is the broader district-level scope.
  // In the reference Students page, the local Mekhala is taken from
  // madrasa.district / madrasa.districtName and "districts" collection.
  // Therefore DO NOT resolve madrasa.mekhalaId against "mekhala" here.
  const norm = (value) => String(value ?? "").trim().toLowerCase();

  const localIds = [
    madrasa.districtId,
    madrasa.subMekhalaId,
    madrasa.localMekhalaId,
  ].map(norm).filter(Boolean);

  const localNames = [
    madrasa.subMekhalaName,
    madrasa.localMekhalaName,
    madrasa.districtName,
    madrasa.district,
  ].map(norm).filter(Boolean);

  const byId = mekhalas.find((m) => localIds.includes(norm(m.id)));
  if (byId) return byId;

  const byName = mekhalas.find((m) =>
    localNames.includes(norm(m.name))
  );
  if (byName) return byName;

  // Reuse the same hierarchy-matching logic as the reference Students page.
  const matches = mekhalas.filter((m) => {
    try {
      return Boolean(m.name && madrasaMatchesMekhala(madrasa, m.name));
    } catch {
      return false;
    }
  });

  return matches.length === 1 ? matches[0] : null;
}

/* SEARCHABLE MADRASA DROPDOWN */

function MadrasaDropdown({
  madarsas,
  value,
  selectedName = "",
  onSelect,
  loading,
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const selected = findMadrasa(madarsas, value);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return madarsas
      .filter((m) =>
        !q ||
        String(m.name || "").toLowerCase().includes(q) ||
        [m.id, m.madarsaId, m.madrasaId, m.mid].some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        )
      )
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      )
      .slice(0, 100);
  }, [madarsas, search]);

  const choose = (m) => {
    onSelect(m);
    setSearch("");
    setOpen(false);
  };

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <input
        type="text"
        className={inputClass}
        placeholder={
          loading
            ? "Loading Madrasas..."
            : "Search Madrasa name or MID"
        }
        value={
          open
            ? search
            : selected?.name || selectedName || ""
        }
        onFocus={() => {
          setSearch("");
          setOpen(true);
        }}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);

          if (e.key === "Enter" && open && filtered[0]) {
            e.preventDefault();
            choose(filtered[0]);
          }
        }}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
      />

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {filtered.length === 0 && (
            <p className="p-3 text-sm text-slate-500">
              No Madrasa found
            </p>
          )}

          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => choose(m)}
              className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm hover:bg-teal-50"
            >
              <span>{m.name}</span>
              <span className="text-xs text-slate-500">
                {getMadrasaId(m)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HallTicketPaper({ ticket, settings, paperRef }) {
  const grade = String(ticket.className || "Class 5").replace(/\D/g, "") || "5";
  const rows = settings.timetables?.[ticket.className] || [];
  return (
    <div ref={paperRef} className={`ticket-paper ticket-${grade}`} id="dkju-printable-hall-ticket">
      {/* Second decorative A4 page border (requires .ticket-inner-page-border CSS) */}
      <div className="ticket-inner-page-border" aria-hidden="true" />
      <div className="ticket-content">
       <div className="ticket-header-logo">
  <img
    src="/model-exam/hall-ticket-header.png"
    alt="Exam Board Arabic Header and Logos"
  />
</div>
        <div className="ticket-board">{settings.boardName}</div>
        <div className="ticket-examtitle">{settings.academicYear} — {settings.examName}</div>
        <div className="ticket-banner">
          Hall Ticket No: <span>{ticket.hallTicketNumber || "________"}</span> &nbsp;|&nbsp; {ticket.className}
        </div>
        <div className="ticket-student-layout">
          <div className="ticket-student">
            <div className="ticket-field full">
              <span className="k">Name:</span>
              <span className="v">{ticket.name || "________________"}</span>
            </div>
            <div className="ticket-field">
              <span className="k">Gender:</span>
              <span className="v">{ticket.gender || "________"}</span>
            </div>
            <div className="ticket-field">
              <span className="k">Class:</span>
              <span className="v">{ticket.className || "________"}</span>
            </div>
            <div className="ticket-field full">
              <span className="k">Exam Center:</span>
              <span className="v">{ticket.madarsaName || "—"}</span>
            </div>
        
            <div className="ticket-field full">
              <span className="k">Mekhala:</span>
              <span className="v">{ticket.mekhala || "—"}</span>
            </div>
          </div>

          {ticket.hallTicketNumber && (
            <div className="ticket-qr-box">
              <QRCodeCanvas
                value={String(ticket.hallTicketNumber)}
                size={180}
                level="H"
                bgColor="#ffffff"
                fgColor="#000000"
                includeMargin={true}
              />
              <span className="ticket-qr-label">SCAN HALL TICKET</span>
              <strong className="ticket-qr-number">{ticket.hallTicketNumber}</strong>
            </div>
          )}
        </div>
        <div className="ticket-ribbon">Examination Timetable</div>
        <div className="ticket-schedule-frame">
        <table className="ticket-schedule">
          <thead><tr>
            <th className="col-date">Date</th><th className="col-subject">Subject</th><th className="col-time">Time</th><th className="col-duration">Duration</th>
          </tr></thead>
          <tbody>
            {rows.length ? rows.map((row, idx)=>(<tr key={idx}>
              <td>{row.date}</td><td>{row.subject}</td><td>{row.time}</td><td>{row.duration}</td>
            </tr>)) : <tr><td colSpan={4} className="ticket-loading">Timetable is not configured for this class.</td></tr>}
            {Array.from({length:Math.max(0,7-rows.length)},(_,i)=>(<tr key={`blank-${i}`}><td> </td><td> </td><td> </td><td> </td></tr>))}
          </tbody>
        </table>
        </div>
        <div className="ticket-terms-title">നിബന്ധനകൾ</div>
        <ol className="ticket-terms">{TERMS.map((term,i)=><li key={i}>{term}</li>)}</ol>
        <div className="ticket-spacer" />
        <div className="ticket-signatures">
          <div className="ticket-sign">
            {/* Signature image supplied by the user; available as a project public asset. */}
            <img src="/model-exam/convener-signature.png" alt="General Convener signature" />
            <div className="sign-line" />
            <strong>Palluvalli Abdul Jabbar Moulavi MFB</strong>
            <span className="sign-role">General Convener</span>
          </div>
          <div className="ticket-sign">
            <div className="sign-line" />
            <strong>സൂപ്പർവൈസറുടെ പേര്, ഒപ്പ്</strong>
            <span className="sign-role">Supervisor Name &amp; Signature</span>
          </div>
        </div>
        <div className="ticket-bottom">DKIMV Public Examination • ADMIT CARD</div>
      </div>
    </div>
  );
}

export default function ModelExamHallTicketPage() {
  const [tab, setTab] = useState("tickets");
  const [tickets, setTickets] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [selectedClassSettings, setSelectedClassSettings] = useState("Class 5");
  const [form, setForm] = useState(EMPTY_TICKET);
  const [madarsas, setMadarsas] = useState([]);
const [mekhalas, setMekhalas] = useState([]);
const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const paperRef = useRef(null);

  useEffect(()=>{
    let mounted = true;
    (async()=>{
      try {
        const [ticketData, timetableData] = await Promise.all([
          listModelExamHallTickets(), getModelExamTimetables(),
        ]);
        if (!mounted) return;
        setTickets(ticketData.tickets || []);
        const savedSettings = timetableData?.settings || {};
        setSettings({
          ...DEFAULT_SETTINGS,
          ...savedSettings,
          timetables: Object.fromEntries(
            CLASSES.map((className) => [
              className,
              (savedSettings.timetables?.[className] || []).map(hydrateTimetableRow),
            ])
          ),
        });
      } catch(error) { if (mounted) toast.error(error.message); }
      finally { if(mounted) setInitialLoading(false); }
    })();
    return ()=>{mounted=false};
  },[]);


useEffect(() => {
  let active = true;

  const loadMadrasas = async () => {
    try {
      setHierarchyLoading(true);

      const [madarsaSnap, localMekhalaSnap] = await Promise.all([
        getDocs(collection(db, "madarsas")),
        // The Students reference uses districts as the local Mekhala level.
        getDocs(collection(db, "districts")),
      ]);

      if (!active) return;

      setMadarsas(
        madarsaSnap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        }))
      );

      setMekhalas(
        localMekhalaSnap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        }))
      );

    } catch (error) {
      console.error("Madrasa loading error:", error);
      toast.error("Unable to load Madrasa / Mekhala data.");
    } finally {
      if (active) setHierarchyLoading(false);
    }
  };

  loadMadrasas();

  return () => {
    active = false;
  };
}, []);


  const filteredTickets = useMemo(()=>{
    const q = search.trim().toLowerCase();
    return tickets.filter(t=>!q || [t.name,t.hallTicketNumber,t.className,t.examCenter,t.madarsaName,t.mekhala].some(x=>String(x||"").toLowerCase().includes(q)));
  },[tickets,search]);

  const resetForm = () => {
    setForm({ ...EMPTY_TICKET });
    setEditingId(null);
  };
  const updateForm = (key,value) => setForm(prev=>({...prev,[key]:value}));
const handleMadrasaSelect = (madrasa) => {
  const mekhala = findMekhala(madrasa, mekhalas);

  setForm((prev) => ({
    ...prev,
    madarsaId: getMadrasaId(madrasa),
    madarsaName: madrasa.name || "",
    mekhalaId: mekhala?.id || "",
    mekhala: mekhala?.name || "",
  }));

  if (!mekhala) {
    toast.warning("Local Mekhala not found for this Madrasa. Check the districts mapping.");
  }
};

  const editTicket = ticket => {
    const linkedMadrasa = findMadrasa(madarsas, ticket.madarsaId);
    const localMekhala = findMekhala(linkedMadrasa, mekhalas);
    setForm({
  name: ticket.name || "",
  gender: ticket.gender || "",
  examCenter: ticket.examCenter || "",
  className: ticket.className || "Class 5",
  hallTicketNumber: ticket.hallTicketNumber || "",
  madarsaId: ticket.madarsaId || "",
  madarsaName: ticket.madarsaName || "",
  // Discard the older stored district display; resolve the actual local Mekhala.
  mekhalaId: localMekhala?.id || "",
  mekhala: localMekhala?.name || "",
});
    setEditingId(ticket.id);
    setSelectedTicket(ticket);
    setTab("tickets");
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const saveTicket = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!form.madarsaId) {
  toast.error("Please select a Madrasa.");
  return;
}

const selectedMadrasa = findMadrasa(
  madarsas,
  form.madarsaId
);

const selectedMekhala = findMekhala(
  selectedMadrasa,
  mekhalas
);

if (!selectedMadrasa || !selectedMekhala) {
  toast.error("Please select a Madrasa with a valid Mekhala.");
  return;
}

const payload = {
  ...form,
  madarsaId: getMadrasaId(selectedMadrasa),
  madarsaName: selectedMadrasa.name,
  mekhalaId: selectedMekhala.id,
  mekhala: selectedMekhala.name,
};
    setBusy(true);
    try {
      const result = editingId
        ? await editModelExamHallTicket(editingId, payload)
        : await createModelExamHallTicket(payload);
      setTickets(prev=>[result.ticket,...prev.filter(t=>t.id!==editingId && t.id!==result.ticket.id)]);
      setSelectedTicket(result.ticket);
      resetForm();
      toast.success(editingId ? "Hall ticket updated." : "Hall ticket saved to Firebase.");
    } catch(error) {toast.error(error.message)}
    finally {setBusy(false)}
  };

  const removeTicket = async() => {
    if(!deleteTarget || busy) return;
    setBusy(true);
    try {
      await deleteModelExamHallTicket(deleteTarget.id);
      setTickets(prev=>prev.filter(t=>t.id!==deleteTarget.id));
      if(selectedTicket?.id===deleteTarget.id) setSelectedTicket(null);
      if(editingId===deleteTarget.id) resetForm();
      setDeleteTarget(null);
      toast.success("Hall ticket deleted.");
    } catch(error){toast.error(error.message)}
    finally{setBusy(false)}
  };

  const updateSetting = (key,value) => setSettings(s=>({...s,[key]:value}));
  const setScheduleRows = updater => setSettings(prev=>({
    ...prev,
    timetables:{...prev.timetables,
      [selectedClassSettings]:typeof updater === "function" ? updater(prev.timetables?.[selectedClassSettings] || []) : updater},
  }));
 
/* ============================================
   UPDATE TIME AND AUTO CALCULATE DURATION
============================================ */

const editScheduleCell = (index, key, value) => {
  setScheduleRows((rows) =>
    rows.map((row, i) => {
      if (i !== index) return row;

      const updatedRow = {
        ...row,
        [key]: value,
      };

      const calculated = calculateTimeRange(
        updatedRow.startTime,
        updatedRow.endTime
      );

      return {
        ...updatedRow,
        time: calculated?.time || "",
        duration: calculated?.duration || "",
      };
    })
  );
};


/* ============================================
   SAVE TIMETABLES TO FIREBASE
============================================ */

const saveTimetables = async () => {
  if (savingSettings) return;

  // Validate all four classes
  for (const className of CLASSES) {
    const rows =
      settings.timetables?.[className] || [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (
        !row.date ||
        !String(row.subject || "").trim() ||
        !calculateTimeRange(
          row.startTime,
          row.endTime
        )
      ) {
        setSelectedClassSettings(className);

        toast.error(
          `${className}, Row ${i + 1}: Please enter Date, Subject and valid Start/End Time.`
        );

        return;
      }
    }
  }

  setSavingSettings(true);

  try {
    // Recalculate all time ranges before saving
    const updatedSettings = {
      ...settings,

      timetables: Object.fromEntries(
        CLASSES.map((className) => [
          className,

          (
            settings.timetables?.[className] || []
          ).map((row) => ({
            ...row,
            ...calculateTimeRange(
              row.startTime,
              row.endTime
            ),
          })),
        ])
      ),
    };

    const result =
      await saveModelExamTimetables(
        updatedSettings
      );

    // Restore Start/End inputs after Firebase save
    const savedSettings =
      result?.settings || updatedSettings;

    setSettings({
      ...updatedSettings,
      ...savedSettings,

      timetables: Object.fromEntries(
        CLASSES.map((className) => [
          className,

          (
            savedSettings.timetables?.[className] || []
          ).map(hydrateTimetableRow),
        ])
      ),
    });

    toast.success(
      "All class timetables saved successfully."
    );
  } catch (error) {
    console.error(
      "SAVE TIMETABLE ERROR:",
      error
    );

    toast.error(
      error?.message ||
      "Unable to save timetable."
    );
  } finally {
    setSavingSettings(false);
  }
};


  const downloadPdf = async () => {
    if(!selectedTicket || !paperRef.current || exporting) return;
    setExporting(true);
    try {
      if(document.fonts?.ready) await document.fonts.ready;
      const images = paperRef.current.querySelectorAll("img");
      await Promise.all(Array.from(images).map(img=>img.decode?.().catch(()=>{}) || Promise.resolve()));
      const [{default:html2canvas},{jsPDF}] = await Promise.all([
        import("html2canvas"), import("jspdf"),
      ]);
      const canvas = await html2canvas(paperRef.current,{
        scale:2.5,backgroundColor:"#ffffff",useCORS:true,logging:false,
      });
      const pdf = new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
      pdf.addImage(canvas.toDataURL("image/jpeg",0.95),"JPEG",0,0,210,297);
      pdf.save(`Model-Exam-Hall-Ticket-${selectedTicket.hallTicketNumber}.pdf`);
    } catch(error){console.error(error);toast.error("PDF generation failed. Try Print → Save as PDF.")}
    finally{setExporting(false)}
  };

  const printable = useMemo(() => {
    if (!selectedTicket) return null;
    if (!selectedTicket.madarsaId || hierarchyLoading) return selectedTicket;
    const madrasa = findMadrasa(madarsas, selectedTicket.madarsaId);
    const mekhala = findMekhala(madrasa, mekhalas);
    return {
      ...selectedTicket,
      mekhala: mekhala?.name || "",
    };
  }, [selectedTicket, hierarchyLoading, madarsas, mekhalas]);
  const scheduleRows = settings.timetables?.[selectedClassSettings] || [];
  return (
    <Layout>
      <main className="min-h-screen bg-slate-50 p-4 md:p-7">
        <div className="mx-auto max-w-[1600px] space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Model Exam Hall Tickets</h1>
              <p className="mt-1 text-sm text-slate-500">Create A4 hall tickets and reuse one saved timetable per class.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className={`${buttonClass} ${tab==="tickets"?"bg-teal-700 text-white":"border bg-white text-slate-700"}`} onClick={()=>setTab("tickets")}><FileText size={16}/>Hall Tickets</button>
              <button type="button" className={`${buttonClass} ${tab==="timetable"?"bg-teal-700 text-white":"border bg-white text-slate-700"}`} onClick={()=>setTab("timetable")}><CalendarDays size={16}/>Timetable Settings</button>
            </div>
          </div>

          {initialLoading ? <div className="rounded-xl bg-white p-14 text-center text-slate-500"><Loader2 className="mx-auto mb-3 animate-spin"/>Loading Exam Board data...</div> : tab==="timetable" ? (
            <section className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm font-semibold">Board / Organization Name<input className={inputClass} value={settings.boardName} onChange={e=>updateSetting("boardName",e.target.value)}/></label>
                <label className="space-y-1 text-sm font-semibold">Exam Name<input className={inputClass} value={settings.examName} onChange={e=>updateSetting("examName",e.target.value)}/></label>
                <label className="space-y-1 text-sm font-semibold">Academic Year<input className={inputClass} value={settings.academicYear} onChange={e=>updateSetting("academicYear",e.target.value)}/></label>
              </div>
              <div className="flex flex-wrap gap-2">{CLASSES.map(c=><button key={c} type="button" className={`${buttonClass} ${c===selectedClassSettings?"bg-indigo-700 text-white":"bg-slate-100 text-slate-700"}`} onClick={()=>setSelectedClassSettings(c)}>{c}</button>)}</div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{selectedClassSettings} Examination Timetable</h2>
                <button type="button" disabled={scheduleRows.length>=7} className={`${buttonClass} bg-slate-100 text-slate-700`} onClick={()=>setScheduleRows(rows=>[...rows,{date: "", subject: "", startTime: "", endTime: "", time: "", duration: ""}])}><Plus size={16}/>Add Row ({scheduleRows.length}/7)</button>
              </div>
              
{/* ============================================
    EXAMINATION TIMETABLE SETTINGS
============================================ */}

<div className="overflow-x-auto">
  <table className="w-full min-w-[850px] border-collapse text-sm">

    <thead className="bg-slate-100 text-slate-700">
      <tr>
        {[
          "Date",
          "Subject",
          "Start Time",
          "End Time",
          "Duration (Auto)",
          "",
        ].map((heading) => (
          <th
            key={heading}
            className="border px-3 py-3 text-left"
          >
            {heading}
          </th>
        ))}
      </tr>
    </thead>

    <tbody>
      {scheduleRows.map((row, i) => {
        const calculated = calculateTimeRange(
          row.startTime,
          row.endTime
        );

        const invalidTime =
          row.startTime &&
          row.endTime &&
          !calculated;

        return (
          <tr key={i}>

            {/* DATE */}
            <td className="border p-2">
              <input
                type="date"
                className={inputClass}
                value={row.date || ""}
                onChange={(e) =>
                  editScheduleCell(
                    i,
                    "date",
                    e.target.value
                  )
                }
              />
            </td>

            {/* SUBJECT */}
            <td className="border p-2">
              <input
                type="text"
                className={inputClass}
                placeholder="Fiqh / Quran"
                value={row.subject || ""}
                onChange={(e) =>
                  editScheduleCell(
                    i,
                    "subject",
                    e.target.value
                  )
                }
              />
            </td>

            {/* START TIME */}
            <td className="border p-2">
              <input
                type="time"
                step="60"
                className={inputClass}
                value={row.startTime || ""}
                onChange={(e) =>
                  editScheduleCell(
                    i,
                    "startTime",
                    e.target.value
                  )
                }
              />
            </td>

            {/* END TIME */}
            <td className="border p-2">
              <input
                type="time"
                step="60"
                className={inputClass}
                value={row.endTime || ""}
                onChange={(e) =>
                  editScheduleCell(
                    i,
                    "endTime",
                    e.target.value
                  )
                }
              />

              {invalidTime && (
                <p className="mt-1 text-xs text-red-600">
                  End Time must be later than Start Time.
                </p>
              )}
            </td>

            {/* AUTO DURATION */}
            <td className="border p-2">
              <input
                type="text"
                readOnly
                value={calculated?.duration || ""}
                placeholder="Auto calculated"
                className={`${inputClass} bg-slate-100 font-semibold text-teal-700`}
              />
            </td>

            {/* REMOVE ROW */}
            <td className="border p-2 text-center">
              <button
                type="button"
                aria-label={`Remove row ${i + 1}`}
                className="text-rose-600 hover:text-rose-800"
                onClick={() =>
                  setScheduleRows((rows) =>
                    rows.filter(
                      (_, index) => index !== i
                    )
                  )
                }
              >
                <Trash2 size={18} />
              </button>
            </td>

          </tr>
        );
      })}
    </tbody>

  </table>
</div>

              <p className="text-xs text-slate-500">Save once. Every saved ticket uses the latest timetable of its class when viewed, printed or downloaded. Seven rows maximum to keep one A4 page.</p>
              <button type="button" disabled={savingSettings} className={`${buttonClass} bg-teal-700 text-white`} onClick={saveTimetables}>{savingSettings?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>}Save All Class Timetables</button>
            </section>
          ) : (
            <div className="grid items-start gap-5 xl:grid-cols-[350px_minmax(0,1fr)]">
              <div className="space-y-5">
                <form onSubmit={saveTicket} className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{editingId?"Edit Hall Ticket":"New Hall Ticket"}</h2><button title="Clear form" type="button" onClick={resetForm} className="text-slate-500"><RotateCcw size={17}/></button></div>
                  <label className="block space-y-1 text-sm font-semibold">Student Name *<input required maxLength={140} className={inputClass} value={form.name} onChange={e=>updateForm("name",e.target.value)} placeholder="Full name"/></label>
                  <label className="block space-y-1 text-sm font-semibold">Gender *<select required className={inputClass} value={form.gender} onChange={e=>updateForm("gender",e.target.value)}><option value="">Select Gender</option>{["Male","Female","Other"].map(g=><option key={g}>{g}</option>)}</select></label>
                  
                  
{/* MADRASA SEARCH */}

<div className="space-y-1">
  <label className="text-sm font-semibold">
    Exam Center *
  </label>

  <MadrasaDropdown
    madarsas={madarsas}
    value={form.madarsaId}
    selectedName={form.madarsaName}
    onSelect={handleMadrasaSelect}
    loading={hierarchyLoading}
  />
</div>

{/* AUTO MEKHALA */}

<label className="block space-y-1 text-sm font-semibold">
  Mekhala (Automatic)

  <input
    type="text"
    readOnly
    className={`${inputClass} bg-slate-100 font-semibold text-teal-700`}
    value={form.mekhala || ""}
    placeholder="Select Madrasa first"
  />
</label>

                  <label className="block space-y-1 text-sm font-semibold">Class *<select required className={inputClass} value={form.className} onChange={e=>updateForm("className",e.target.value)}>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
                  <label className="block space-y-1 text-sm font-semibold">Hall Ticket Number *<input required inputMode="numeric" pattern="[0-9]{1,16}" maxLength={16} className={inputClass} value={form.hallTicketNumber} onChange={e=>updateForm("hallTicketNumber",e.target.value)} placeholder="2254"/></label>
                  
                  <div className="flex gap-2"><button disabled={busy} className={`${buttonClass} flex-1 bg-teal-700 text-white`} type="submit">{busy?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>} {editingId?"Update Ticket":"Save"}</button><button type="button" className={`${buttonClass} bg-slate-100`} onClick={resetForm}><Plus size={16}/>New</button></div>
                </form>
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2"><h2 className="font-bold">Saved Hall Tickets</h2><span className="text-xs text-slate-500">{tickets.length} saved</span></div>
                  <label className="relative mt-3 block"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className={`${inputClass} pl-9`} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name / number / class"/></label>
                  <div className="mt-3 max-h-[450px] space-y-2 overflow-auto">
                    {filteredTickets.length===0?<p className="py-6 text-center text-sm text-slate-500">No hall tickets found.</p>:filteredTickets.map(t=><div key={t.id} className={`rounded-xl border p-3 ${selectedTicket?.id===t.id?"border-teal-300 bg-teal-50":"border-slate-100 bg-slate-50"}`}>
                      <div className="font-semibold text-slate-900">{t.name}</div>
                      <div className="mt-1 text-xs text-slate-500">No. {t.hallTicketNumber} • {t.className}</div>
                      <div className="mt-2 flex gap-1.5">
                        <button type="button" title="View ticket and download PDF" className={`${buttonClass} bg-white text-slate-700`} onClick={()=>setSelectedTicket(t)}><Eye size={15}/>View</button>
                        <button type="button" title="Edit ticket" className={`${buttonClass} bg-white text-slate-700`} onClick={()=>editTicket(t)}><Pencil size={15}/>Edit</button>
                        <button type="button" title="Delete ticket" className={`${buttonClass} bg-rose-50 text-rose-600`} onClick={()=>setDeleteTarget(t)}><Trash2 size={15}/></button>
                      </div>
                    </div>)}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white p-4">
                  <div><h2 className="font-bold">A4 Hall Ticket Preview</h2><p className="text-xs text-slate-500">Open a saved ticket to download or print.</p></div>
                  <div className="flex gap-2">
                    <button type="button" className={`${buttonClass} bg-teal-700 text-white`} onClick={downloadPdf} disabled={!printable || exporting}>{exporting?<Loader2 className="animate-spin" size={16}/>:<Download size={16}/>} Download PDF</button>
                    <button type="button" className={`${buttonClass} border bg-white text-slate-800`} onClick={()=>window.print()} disabled={!printable}><Printer size={16}/>Print</button>
                  </div>
                </div>
                {printable ? <div className="overflow-x-auto rounded-2xl border bg-slate-200 p-3 shadow-sm"><div className="mx-auto w-max shadow-lg"><HallTicketPaper ticket={printable} settings={settings} paperRef={paperRef}/></div></div> : <div className="rounded-2xl border border-dashed bg-white p-20 text-center text-sm text-slate-500">Create a hall ticket, or click View on a saved hall ticket.</div>}
              </div>
            </div>
          )}
        </div>
      </main>
      {deleteTarget && <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-bold">Delete Hall Ticket?</h2><button type="button" onClick={()=>setDeleteTarget(null)} aria-label="Close"><X size={20}/></button></div>
        <p className="my-4 text-sm text-slate-600">Delete <strong>{deleteTarget.name}</strong> (Hall Ticket No. {deleteTarget.hallTicketNumber}) permanently from Firebase?</p>
        <div className="flex justify-end gap-2"><button type="button" className={`${buttonClass} bg-slate-100`} onClick={()=>setDeleteTarget(null)} disabled={busy}>Cancel</button><button type="button" className={`${buttonClass} bg-rose-600 text-white`} onClick={removeTicket} disabled={busy}>{busy?"Deleting...":"Delete"}</button></div>
      </div></div>}
    </Layout>
  );
}