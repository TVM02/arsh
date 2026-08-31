"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { authFetch } from "@/lib/authFetch";
import { Award, Download } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import configDropdowns from "@/data/configDropdowns.json";

const ALL = "all";

const getValue = (student, keys) =>
  keys.map((key) => student[key]).find((value) => value != null && value !== "") || "";

const getCertificatesHTML = (items, origin) => {
  const bgUrl = `${origin}/bg_certificate.png`;
  const logoUrl = `${origin}/logo.png`;

  const certificateDivs = items.map((student) => {
    const studentName = student.fullName || student.name || "Student Name";
    const classVal = getValue(student, ["class", "classLevel", "std"]) || "N/A";
    const certId = student.certificateNumber || student.regNo || `DKJU-2026-${student.id ? student.id.slice(-6).toUpperCase() : "000000"}`;

    return `
    <div class="certificate-container">
      <div class="cert-id-overlay">Certificate ID: <span>${certId}</span></div>
      <div class="seal-class-overlay">CLASS ${classVal}</div>
      <div class="student-name-overlay">${studentName}</div>
      <div class="completion-class-overlay">has successfully completed Class ${classVal} of Madrasa Education.</div>
    </div>
    `;
  }).join("\n");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Certificates</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Montserrat:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      @page {
        size: A4 landscape;
        margin: 0;
      }
      html, body {
        margin: 0;
        padding: 0;
        width: 297mm;
        height: 210mm;
        background-color: #ffffff;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      @media screen {
        body {
          background-color: #e0e0e0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding: 20px;
          box-sizing: border-box;
        }
      }
      @media print {
        .certificate-container {
          page-break-after: always;
        }
        .certificate-container:last-child {
          page-break-after: avoid;
        }
      }
      .certificate-container {
        width: 297mm;
        height: 210mm;
        position: relative;
        background-image: url('${bgUrl}');
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: center;
        box-sizing: border-box;
        overflow: hidden;
      }

      .cert-id-overlay {
        position: absolute;
        top: 7.2%;
        right: 12%;
        transform: translateX(50%);
        font-family: 'Montserrat', sans-serif;
        font-size: 11px;
        color: #333333;
        font-weight: 500;
        letter-spacing: 0.5px;
        text-align: center;
      }
      .cert-id-overlay span {
        color: #0b4c42;
        font-weight: 700;
      }

      .seal-class-overlay {
        position: absolute;
        top: 41.6%;
        left: 14.5%;
        transform: translate(-50%, -50%);
        font-family: 'Montserrat', sans-serif;
        font-size: 13.5px;
        font-weight: 800;
        color: #0b4c42;
        background: #ffffff;
        padding: 2px 14px;
        border-radius: 20px;
        line-height: 1;
        letter-spacing: 0.3px;
        white-space: nowrap;
        text-transform: uppercase;
      }

      .student-name-overlay {
        position: absolute;
        top: 44.5%;
        left: 51.5%;
        transform: translate(-50%, -50%);
        font-family: 'Montserrat', sans-serif;
        font-size: 30px;
        font-weight: 800;
        color: #0b4c42;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        width: 100%;
        text-align: center;
        white-space: nowrap;
      }

      .completion-class-overlay {
        position: absolute;
        top: 54.2%;
        left: 51.5%;
        transform: translate(-50%, -50%);
        font-family: 'Montserrat', sans-serif;
        font-size: 14px;
        font-weight: 700;
        color: #333333;
        background: #ffffff;
        padding: 4px 30px;
        letter-spacing: 0.2px;
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    ${certificateDivs}
  </body>
</html>`;
};

export default function AdminCertificatesPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [limited, setLimited] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    districts: [],
    mekhalas: [],
    madrasas: [],
    classes: [],
  });
  const [filters, setFilters] = useState({
    district: ALL,
    mekhala: ALL,
    madrasa: ALL,
    classLevel: ALL,
  });

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const params = new URLSearchParams({ limit: "500" });
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== ALL) params.set(key, value);
      });

      const response = await authFetch(
        `/api/admin/certificates-data?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to load certificate data");
      }

      setStudents(data.students || []);
      setLimited(Boolean(data.limited));
      setFilterOptions((prev) => ({
        districts: data.options?.districts?.length
          ? data.options.districts
          : prev.districts,
        mekhalas: data.options?.mekhalas?.length
          ? data.options.mekhalas
          : prev.mekhalas,
        madrasas: data.options?.madrasas?.length
          ? data.options.madrasas
          : prev.madrasas,
        classes: data.options?.classes?.length
          ? data.options.classes
          : prev.classes,
      }));
      setSelectedIds([]);
    } catch (error) {
      console.error("Failed to load students:", error);
      setLoadError(error.message || "Failed to load students");
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "district" ? { mekhala: ALL, madrasa: ALL } : {}),
      ...(key === "mekhala" ? { madrasa: ALL } : {}),
    }));
  };

  const options = useMemo(() => {
    const makeOptions = (getter) =>
      Array.from(new Set(students.map(getter).filter(Boolean))).sort();
    return {
      districts: filterOptions.districts.length
        ? filterOptions.districts
        : makeOptions((s) => getValue(s, ["district", "districtName"])),
      mekhalas: filterOptions.mekhalas.length
        ? filterOptions.mekhalas
        : makeOptions((s) => getValue(s, ["mekhala", "mekhalaName"])),
      madrasas: filterOptions.madrasas.length
        ? filterOptions.madrasas
        : Array.from(
            new Map(
              students
                .filter((s) => getValue(s, ["madarsaName", "madarsa", "madrasa"]))
                .map((s) => {
                  const name = getValue(s, ["madarsaName", "madarsa", "madrasa"]);
                  return [
                    name,
                    {
                      label: name,
                      value: name,
                      madarsaId: s.mid || "",
                    },
                  ];
                }),
            ).values(),
          ).sort((a, b) => a.label.localeCompare(b.label)),
      classes: Array.from(
        new Set([
          ...filterOptions.classes,
          ...makeOptions((s) => getValue(s, ["class", "classLevel", "std"])),
          ...configDropdowns.classes.map((item) => item.value),
        ]),
      )
        .filter(Boolean)
        .sort((a, b) => {
          const numA = parseInt(a, 10);
          const numB = parseInt(b, 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          if (!isNaN(numA)) return -1;
          if (!isNaN(numB)) return 1;
          return String(a).localeCompare(String(b));
        }),
    };
  }, [filterOptions, students]);

  const filteredStudents = students;

  const generatePdf = (items) => {
    if (!items || items.length === 0) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const html = getCertificatesHTML(items, origin);
    const printWindow = window.open("", "_blank");
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 1000);
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-7 w-7 text-teal-600" />
            Certificates
          </h1>
          <p className="text-gray-600">Filter students and generate certificate PDFs.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              ["district", "District", options.districts],
              ["mekhala", "Mekhala", options.mekhalas],
              ["madrasa", "Madrasa", options.madrasas],
              ["classLevel", "Class", options.classes],
            ].map(([key, label, values]) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <SearchableSelect
                  value={filters[key]}
                  onValueChange={(value) => handleFilterChange(key, value)}
                  options={
                    key === "madrasa" && values.length > 0 && typeof values[0] === "object"
                      ? values
                      : values.map((v) => ({ label: v, value: v }))
                  }
                  placeholder={`Select ${label}...`}
                  searchPlaceholder={`Search ${label}...`}
                  showAllOption={true}
                  allOptionText="All"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle>Students ({filteredStudents.length})</CardTitle>
              <Button
                onClick={() =>
                  generatePdf(
                    filteredStudents.filter((student) =>
                      selectedIds.includes(student.id),
                    ),
                  )
                }
                disabled={selectedIds.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Generate Selected ({selectedIds.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading students...</p>
            ) : loadError ? (
              <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {loadError}
              </div>
            ) : (
              <div className="space-y-3">
                {limited && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Showing the first 500 matching students. Apply more filters
                    before bulk generating a very large report.
                  </div>
                )}
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">
                        <Checkbox
                          checked={
                            filteredStudents.length > 0 &&
                            filteredStudents.every((student) =>
                              selectedIds.includes(student.id),
                            )
                          }
                          onCheckedChange={(checked) =>
                            setSelectedIds(
                              checked
                                ? filteredStudents.map((student) => student.id)
                                : [],
                            )
                          }
                        />
                      </th>
                      <th className="p-2">Name</th>
                      <th className="p-2">Class</th>
                      <th className="p-2">Madrasa</th>
                      <th className="p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="border-b">
                        <td className="p-2">
                          <Checkbox
                            checked={selectedIds.includes(student.id)}
                            onCheckedChange={(checked) =>
                              setSelectedIds((prev) =>
                                checked
                                  ? [...prev, student.id]
                                  : prev.filter((id) => id !== student.id),
                              )
                            }
                          />
                        </td>
                        <td className="p-2 font-medium">
                          {student.fullName || student.name || "N/A"}
                        </td>
                        <td className="p-2">
                          {getValue(student, ["class", "classLevel", "std"]) || "N/A"}
                        </td>
                        <td className="p-2">
                          {getValue(student, ["madarsaName", "madarsa", "madrasa"]) || "N/A"}
                          {student.mid ? <div className="text-xs text-gray-500 mt-1 font-mono">MID-{student.mid}</div> : null}
                        </td>
                        <td className="p-2">
                          <Button size="sm" onClick={() => generatePdf([student])}>
                            Generate
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
