"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileSpreadsheet, FileText, ClipboardList, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { madrasaMatchesMekhala } from "@/lib/madrasaHierarchy";
import { SearchableSelect } from "@/components/ui/searchable-select";

export default function AttendanceReport({ userRole, requiredRoleTitle = "Attendance Daily Report" }) {
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [classLevels] = useState(["LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]);
  
  const [availableMadarsas, setAvailableMadarsas] = useState([]);
  
  const [filters, setFilters] = useState({
    selectedDate: new Date().toISOString().split("T")[0],
    classLevel: "all",
    search: "",
    gender: "all",
    madarsaFilter: "all" // For Mekhala
  });

  // Fetch Madarsas for dropdown
  useEffect(() => {
    if (userData && (userRole === "mekhala_admin" || userRole === "central_admin")) {
      const fetchMadarsas = async () => {
        if (userRole === "central_admin") {
          const mSnap = await getDocs(collection(db, "madarsas"));
          setAvailableMadarsas(mSnap.docs.map(d => ({id: d.id, ...d.data()})));
        } else {
          const mekhalaId = userData.uid || userData.id;
          const isSubMekhala = userData.mekhalaDocType === "sub_mekhala";
          
          let madarsasData = [];
          if (isSubMekhala) {
            const specificName = userData.mekhalaName || userData.name || "";
            const mSnap = await getDocs(collection(db, "madarsas"));
            madarsasData = mSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(m => madrasaMatchesMekhala(m, specificName));
          } else {
            const dSnap = await getDocs(query(collection(db, "districts"), where("mekhalaId", "==", mekhalaId)));
            const dNames = new Set(dSnap.docs.map(d => d.data().name?.toLowerCase()));
            const userDataDistricts = userData.districts || userData.assignedDistricts || [];
            userDataDistricts.forEach(d => dNames.add(d.toLowerCase()));
            
            const mSnap = await getDocs(collection(db, "madarsas"));
            madarsasData = mSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(m => 
              dNames.has(m.district?.toLowerCase()) || m.mekhalaId === mekhalaId
            );
          }
          setAvailableMadarsas(madarsasData);
        }
      };
      fetchMadarsas();
    }
  }, [userData, userRole]);

  const fetchAttendances = async () => {
    if (!userData) return;
    try {
      setLoading(true);
      
      let allowedMadarsaIds = new Set();
      let fetchAll = false;

      if (userRole === "madarsa_admin" || userRole === "sadar") {
        allowedMadarsaIds.add(userData.madarsaId || "madarsa-001");
      } else if (userRole === "inspector") {
        const assigned = userData.assignedMadarsas || [];
        assigned.forEach(m => allowedMadarsaIds.add(m));
      } else if (userRole === "mekhala_admin") {
        availableMadarsas.forEach(m => allowedMadarsaIds.add(m.madarsaId || m.id));
      } else {
        // central_admin, pariksha_board_convener
        fetchAll = true;
      }

      // Query by selectedDate globally to avoid requiring complex composite indexes
      const q = query(
        collection(db, "attendances"),
        where("attendanceDate", "==", filters.selectedDate)
      );

      const snap = await getDocs(q);
      let fetchedData = [];
      
      snap.forEach(doc => {
        const data = doc.data();
        if (fetchAll || allowedMadarsaIds.has(data.madarsaId)) {
          fetchedData.push({ id: doc.id, ...data });
        }
      });
      
      setRecords(fetchedData);
    } catch (error) {
      console.error("Error fetching attendances:", error);
      toast.error("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch when date changes
  useEffect(() => {
    if (((userRole === "mekhala_admin" || userRole === "central_admin") && availableMadarsas.length > 0) || (userRole !== "mekhala_admin" && userRole !== "central_admin")) {
      fetchAttendances();
    }
  }, [filters.selectedDate, userData, availableMadarsas.length]);

  const getFilteredDetails = () => {
    let details = [];
    records.forEach(record => {
      // Madarsa Filter
      if ((userRole === "mekhala_admin" || userRole === "central_admin") && filters.madarsaFilter !== "all" && record.madarsaId !== filters.madarsaFilter) {
        return;
      }

      // Filter by class
      if (filters.classLevel !== "all" && record.classId !== filters.classLevel) {
        return;
      }

      record.records.forEach(studentRecord => {
        // Filter by gender (If gender is not stored in old records, they will be hidden if not "all")
        if (filters.gender !== "all" && studentRecord.gender !== filters.gender) {
          return;
        }
        
        // Filter by search
        if (filters.search) {
          const lowerSearch = filters.search.toLowerCase();
          if (!studentRecord.studentName.toLowerCase().includes(lowerSearch) && 
              !(studentRecord.midNumber && studentRecord.midNumber.toLowerCase().includes(lowerSearch))) {
            return;
          }
        }
        
        const formatClassNameDisplay = (name) => {
          if (!name) return "";
          const cleaned = name.replace(/Class /i, "").trim();
          if (["LKG", "UKG"].includes(cleaned.toUpperCase())) {
            return cleaned.toUpperCase();
          }
          return name;
        };

        details.push({
          date: record.attendanceDate,
          className: formatClassNameDisplay(record.className),
          madarsaId: record.madarsaId,
          teacherName: record.teacherName,
          ...studentRecord
        });
      });
    });
    
    return details;
  };

  const filteredDetails = getFilteredDetails();

  const exportCSV = () => {
    if (filteredDetails.length === 0) {
      toast.info("No records to export");
      return;
    }
    
    const headers = ["Madarsa ID", "MID Number", "Student Name", "Class", "Gender", "Status"];
    const rows = filteredDetails.map(d => [
      d.madarsaId || "N/A",
      d.midNumber,
      d.studentName,
      d.className,
      d.gender || "N/A",
      d.status
    ]);
    
    const csvContent = [headers, ...rows]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      .join("\n");
      
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance_report_${filters.selectedDate}.csv`;
    link.click();
  };

  const exportPDF = () => {
    if (filteredDetails.length === 0) {
      toast.info("No records to export");
      return;
    }
    
    const doc = new jsPDF();
    const formatDisplayDate = (d) => {
      if (!d) return "";
      const parts = d.split("-");
      if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      return d;
    };
    const displayDate = formatDisplayDate(filters.selectedDate);

    let title = `Daily Attendance Report (${displayDate})`;
    if (filters.madarsaFilter !== "all") {
      const selectedMadarsa = availableMadarsas.find(m => m.madarsaId === filters.madarsaFilter || m.id === filters.madarsaFilter);
      if (selectedMadarsa) {
        const mName = selectedMadarsa.name || selectedMadarsa.madarsaName || "MADRASA";
        const mId = selectedMadarsa.madarsaId || selectedMadarsa.id || filters.madarsaFilter;
        title = `${mName.toUpperCase()} (${mId}) - Attendance (${displayDate})`;
      }
    }
    
    doc.text(title, 14, 15);
    
    const tableColumn = ["Madarsa ID", "MID", "Name", "Class", "Gender", "Status"];
    const tableRows = filteredDetails.map(d => [
      d.madarsaId || "N/A",
      d.midNumber,
      d.studentName,
      d.className,
      d.gender || "N/A",
      d.status
    ]);
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 22,
      theme: "striped",
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 118, 110] },
    });
    
    doc.save(`attendance_report_${filters.selectedDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center">
            <ClipboardList className="mr-3 h-8 w-8 text-teal-600" />
            {requiredRoleTitle}
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            Daily individual student attendance status. Read-only view.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="date"
                  value={filters.selectedDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, selectedDate: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>

            {(userRole === "mekhala_admin" || userRole === "central_admin") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Madarsa Filter</label>
                <SearchableSelect 
                  value={filters.madarsaFilter} 
                  onValueChange={(val) => setFilters(prev => ({ ...prev, madarsaFilter: val }))}
                  options={availableMadarsas.map(m => ({ label: `${m.name?.toUpperCase()} (${m.madarsaId})`, value: m.madarsaId || m.id, madarsaId: m.madarsaId?.toLowerCase() }))}
                  placeholder="All Madarsas"
                  searchPlaceholder="Search by MID or Name..."
                  allOptionText="All Madarsas"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Class</label>
              <Select 
                value={filters.classLevel} 
                onValueChange={(val) => setFilters(prev => ({ ...prev, classLevel: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent className="z-[100] bg-white">
                  <SelectItem value="all">All Classes</SelectItem>
                  {classLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {["LKG", "UKG"].includes(String(level).toUpperCase()) ? String(level).toUpperCase() : `Class ${level}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Gender</label>
              <Select 
                value={filters.gender} 
                onValueChange={(val) => setFilters(prev => ({ ...prev, gender: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Genders" />
                </SelectTrigger>
                <SelectContent className="z-[100] bg-white">
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 xl:col-span-1">
              <label className="text-sm font-medium text-gray-700">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Name / MID"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end items-center mt-6">
            <div className="flex space-x-2">
              <Button onClick={exportCSV} variant="outline" className="border-gray-200">
                <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                Export CSV
              </Button>
              <Button onClick={exportPDF} variant="outline" className="border-gray-200">
                <FileText className="mr-2 h-4 w-4 text-red-600" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily Status ({filteredDetails.length} students)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 uppercase">
                <tr>
                  <th className="px-4 py-3">Madarsa ID</th>
                  <th className="px-4 py-3">MID / Adm No</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Gender</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetails.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      {loading ? "Loading..." : "No records found matching your filters."}
                    </td>
                  </tr>
                ) : (
                  filteredDetails.slice(0, 100).map((record, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs">{record.madarsaId || "N/A"}</td>
                      <td className="px-4 py-3 font-medium">{record.midNumber}</td>
                      <td className="px-4 py-3 font-semibold">{record.studentName}</td>
                      <td className="px-4 py-3">{record.className}</td>
                      <td className="px-4 py-3">{record.gender || "N/A"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                          record.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {filteredDetails.length > 100 && (
              <div className="text-center p-4 text-sm text-gray-500 bg-gray-50">
                Showing top 100 results. Please export to CSV or PDF to see all {filteredDetails.length} records.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
