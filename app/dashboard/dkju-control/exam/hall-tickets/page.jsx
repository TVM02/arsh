"use client";

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

const CLASSES = ["Class 4", "Class 5", "Class 9", "Class 10"];
const EMPTY_TICKET = {name:"",gender:"",examCenter:"",className:"Class 4",hallTicketNumber:"",mekhala:""};
const DEFAULT_SETTINGS = {
  boardName: "ദക്ഷിണ കേരള ഇസ്ലാം മത വിദ്യാഭ്യാസ ബോർഡ്",
  examName: "മോഡൽ പരീക്ഷ", academicYear: "2027",
  timetables: Object.fromEntries(CLASSES.map(c=>[c,[]])),
};
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

function HallTicketPaper({ ticket, settings, paperRef }) {
  const grade = String(ticket.className || "Class 4").replace(/\D/g, "") || "4";
  const rows = settings.timetables?.[ticket.className] || [];
  return (
    <div ref={paperRef} className={`ticket-paper ticket-${grade}`} id="dkju-printable-hall-ticket">
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
        <div className="ticket-student">
          <div className="ticket-field full"><span className="k">Name:</span><span className="v">{ticket.name || "____________________________"}</span></div>
          <div className="ticket-field"><span className="k">Gender:</span><span className="v">{ticket.gender || "________"}</span></div>
          <div className="ticket-field"><span className="k">Class:</span><span className="v">{ticket.className || "________"}</span></div>
          <div className="ticket-field full"><span className="k">Exam Center:</span><span className="v">{ticket.examCenter || "____________________________"}</span></div>
          <div className="ticket-field full"><span className="k">Mekhala:</span><span className="v">{ticket.mekhala || "—"}</span></div>
        </div>
        <div className="ticket-ribbon">Examination Timetable</div>
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
        <div className="ticket-bottom">DKJU MODEL EXAMINATION • ADMIT CARD</div>
      </div>
    </div>
  );
}

export default function ModelExamHallTicketPage() {
  const [tab, setTab] = useState("tickets");
  const [tickets, setTickets] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [selectedClassSettings, setSelectedClassSettings] = useState("Class 4");
  const [form, setForm] = useState(EMPTY_TICKET);
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
        setSettings({...DEFAULT_SETTINGS, ...timetableData.settings,
          timetables:{...DEFAULT_SETTINGS.timetables,...timetableData.settings?.timetables}});
      } catch(error) { if (mounted) toast.error(error.message); }
      finally { if(mounted) setInitialLoading(false); }
    })();
    return ()=>{mounted=false};
  },[]);

  const filteredTickets = useMemo(()=>{
    const q = search.trim().toLowerCase();
    return tickets.filter(t=>!q || [t.name,t.hallTicketNumber,t.className,t.examCenter].some(x=>String(x||"").toLowerCase().includes(q)));
  },[tickets,search]);

  const resetForm = () => {setForm(EMPTY_TICKET);setEditingId(null)};
  const updateForm = (key,value) => setForm(prev=>({...prev,[key]:value}));
  const editTicket = ticket => {
    setForm({name:ticket.name,gender:ticket.gender,examCenter:ticket.examCenter,
      className:ticket.className,hallTicketNumber:ticket.hallTicketNumber,mekhala:ticket.mekhala||""});
    setEditingId(ticket.id);
    setSelectedTicket(ticket);
    setTab("tickets");
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const saveTicket = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = editingId
        ? await editModelExamHallTicket(editingId,form)
        : await createModelExamHallTicket(form);
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
  const editScheduleCell = (i,key,value) => setScheduleRows(rows=>rows.map((r,j)=>j===i?{...r,[key]:value}:r));
  const saveTimetables = async () => {
    if(savingSettings) return;
    setSavingSettings(true);
    try {
      const result = await saveModelExamTimetables(settings);
      setSettings(s=>({...s,...result.settings}));
      toast.success("All four class timetables and exam settings saved to Firebase.");
    } catch(error){toast.error(error.message)}
    finally{setSavingSettings(false)}
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

  const printable = selectedTicket;
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
                <button type="button" disabled={scheduleRows.length>=7} className={`${buttonClass} bg-slate-100 text-slate-700`} onClick={()=>setScheduleRows(rows=>[...rows,{date:"",subject:"",time:"",duration:""}])}><Plus size={16}/>Add Row ({scheduleRows.length}/7)</button>
              </div>
              <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-sm">
                <thead className="bg-slate-100 text-slate-700"><tr>{["Date","Subject","Time","Duration",""].map(x=><th key={x} className="border px-2 py-3 text-left">{x}</th>)}</tr></thead>
                <tbody>{scheduleRows.map((row,i)=><tr key={i}>
                  <td className="border p-2"><input className={inputClass} type="date" value={row.date} onChange={e=>editScheduleCell(i,"date",e.target.value)}/></td>
                  <td className="border p-2"><input className={inputClass} placeholder="Fiqh / Quran" value={row.subject} onChange={e=>editScheduleCell(i,"subject",e.target.value)}/></td>
                  <td className="border p-2"><input className={inputClass} placeholder="10:00 AM - 12:00 PM" value={row.time} onChange={e=>editScheduleCell(i,"time",e.target.value)}/></td>
                  <td className="border p-2"><input className={inputClass} placeholder="2 Hours" value={row.duration} onChange={e=>editScheduleCell(i,"duration",e.target.value)}/></td>
                  <td className="border p-2"><button aria-label={`Remove row ${i+1}`} type="button" className="text-rose-600" onClick={()=>setScheduleRows(rows=>rows.filter((_,j)=>j!==i))}><Trash2 size={18}/></button></td>
                </tr>)}</tbody>
              </table></div>
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
                  <label className="block space-y-1 text-sm font-semibold">Exam Center *<input required maxLength={180} className={inputClass} value={form.examCenter} onChange={e=>updateForm("examCenter",e.target.value)} placeholder="Examination center name"/></label>
                  <label className="block space-y-1 text-sm font-semibold">Class *<select required className={inputClass} value={form.className} onChange={e=>updateForm("className",e.target.value)}>{CLASSES.map(c=><option key={c} value={c}>{c}</option>)}</select></label>
                  <label className="block space-y-1 text-sm font-semibold">Hall Ticket Number *<input required inputMode="numeric" pattern="[0-9]{1,16}" maxLength={16} className={inputClass} value={form.hallTicketNumber} onChange={e=>updateForm("hallTicketNumber",e.target.value)} placeholder="2254"/></label>
                  <label className="block space-y-1 text-sm font-semibold">Mekhala (optional)<input className={inputClass} maxLength={160} value={form.mekhala} onChange={e=>updateForm("mekhala",e.target.value)}/></label>
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
