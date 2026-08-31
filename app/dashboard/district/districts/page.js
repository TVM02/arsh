"use client";

import { useState, useEffect } from "react";
import useAuthStore from "@/lib/authStore";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Building,
  Users,
  Search,
  Eye,
  Edit,
  Filter,
  Plus,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { madrasaMatchesMekhala } from "@/lib/madrasaHierarchy";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function MekhalaDistricts() {
  const { user, userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [districts, setDistricts] = useState([]);
  const [madarsasCounts, setMadarsasCounts] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (userData && userData.role === "mekhala_admin") {
      const fetchDistricts = async () => {
        try {
          setLoading(true);

          const mekhalaId = userData.uid || userData.id;
          const isSubMekhala = userData.mekhalaDocType === "sub_mekhala";

          if (isSubMekhala) {
            // Sub-mekhala login: show only this mekhala as a single entry
            const specificName = userData.mekhalaName || userData.name || "";
            const madarsasSnapshot = await getDocs(collection(db, "madarsas"));
            const allMadarsas = madarsasSnapshot.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            const matched = allMadarsas.filter((m) =>
              madrasaMatchesMekhala(m, specificName),
            );
            setDistricts([
              {
                id: mekhalaId,
                name: specificName,
                status: userData.status || "active",
                state: userData.state || "",
                code:
                  userData.code || userData.mekhalaId || userData.loginId || "",
                region:
                  userData.region ||
                  userData.district ||
                  userData.parentDistrict ||
                  "",
                phone: userData.phone || "",
                email: userData.email || "",
                established: userData.established || "",
              },
            ]);
            setMadarsasCounts({ [specificName]: matched.length });
            return;
          }

          // ── District-level login: original logic ──────────────────────────────

          // Re-fetch mekhala doc from Firestore to get fresh districts array
          const freshMekhalaDoc = await getDoc(doc(db, "mekhala", mekhalaId));
          const freshDistricts = freshMekhalaDoc.exists()
            ? freshMekhalaDoc.data().districts || []
            : userData.districts || userData.assignedDistricts || [];

          // Fetch districts assigned to this mekhala from collection
          const districtsQuery = query(
            collection(db, "districts"),
            where("mekhalaId", "==", mekhalaId),
            orderBy("name", "asc"),
          );
          const districtsSnapshot = await getDocs(districtsQuery);
          const collectionDistricts = districtsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Add synthetic entries for districts in the array that have no collection doc
          const collectionNames = collectionDistricts.map((d) =>
            d.name.toLowerCase(),
          );
          const syntheticDistricts = freshDistricts
            .filter((name) => !collectionNames.includes(name.toLowerCase()))
            .map((name) => ({
              id: `synthetic-${name}`,
              name,
              status: "active",
              synthetic: true,
            }));

          const districtsData = [
            ...collectionDistricts,
            ...syntheticDistricts,
          ].sort((a, b) => a.name.localeCompare(b.name));
          setDistricts(districtsData);

          // Fetch madarsas count for each district
          const madarsasQuery = query(collection(db, "madarsas"));
          const madarsasSnapshot = await getDocs(madarsasQuery);
          const allMadarsas = madarsasSnapshot.docs.map((doc) => doc.data());

          const counts = {};
          districtsData.forEach((district) => {
            const districtMadarsas = allMadarsas.filter(
              (madarsa) =>
                madarsa.district?.toLowerCase() ===
                district.name?.toLowerCase(),
            );
            counts[district.name] = districtMadarsas.length;
          });
          setMadarsasCounts(counts);
        } catch (error) {
          console.error("Error fetching districts:", error);
          toast.error("Failed to fetch districts data");
        } finally {
          setLoading(false);
        }
      };

      fetchDistricts();
    } else {
      setLoading(false);
    }
  }, [userData]);

  // Filter districts based on search term and status
  const filteredDistricts = districts.filter((district) => {
    const matchesSearch =
      district.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      district.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      district.state?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || district.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text("Mekhala/Districts List", 14, 16);

      const headers = ["District Details", "Code", "State", "Region", "Madrasas Count", "Status"];
      const rows = filteredDistricts.map((d) => [
        d.name || "N/A",
        d.code || "N/A",
        d.state || "N/A",
        d.region || "N/A",
        String(madarsasCounts[d.name] || 0),
        d.status || "active",
      ]);

      autoTable(doc, {
        startY: 22,
        head: [headers],
        body: rows,
        styles: { fontSize: 8 },
      });
      doc.save("districts.pdf");
      toast.success("PDF exported successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export PDF");
    }
  };

  const handleExportCSV = () => {
    const headers = ["District Details", "Code", "State", "Region", "Madrasas Count", "Status"];
    const rows = filteredDistricts.map((d) => [
      d.name || "N/A",
      d.code || "N/A",
      d.state || "N/A",
      d.region || "N/A",
      madarsasCounts[d.name] || 0,
      d.status || "active",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "districts.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading districts...</div>
        </div>
      </Layout>
    );
  }

  if (!userData || userData.role !== "mekhala_admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600">
              You need to be logged in as a Mekhala Admin to access this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Madrasa Management</h1>
          <p className="text-blue-100">
            Manage and monitor madrasas assigned to your mekhala
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Districts</p>
                  <p className="text-2xl font-bold">{districts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Building className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Madrasas</p>
                  <p className="text-2xl font-bold">
                    {Object.values(madarsasCounts).reduce(
                      (sum, count) => sum + count,
                      0,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Districts</p>
                  <p className="text-2xl font-bold">
                    {districts.filter((d) => d.status === "active").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Districts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Districts ({filteredDistricts.length})
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleExportCSV}>
                  Export CSV
                </Button>
                <Button size="sm" variant="outline" onClick={handleExportPDF}>
                  Export PDF
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Madrasas assigned to your mekhala administration
            </CardDescription>

            {/* Search and Filters */}
            <div className="flex gap-4 mt-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search madrasas by name, code, or state..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterStatus === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("all")}
                >
                  All
                </Button>
                <Button
                  variant={filterStatus === "active" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("active")}
                >
                  Active
                </Button>
                <Button
                  variant={filterStatus === "inactive" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterStatus("inactive")}
                >
                  Inactive
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredDistricts.length === 0 ? (
              <div className="text-center py-12">
                <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  {searchTerm || filterStatus !== "all"
                    ? "No madrasas found"
                    : "No madrasas assigned"}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm || filterStatus !== "all"
                    ? "Try adjusting your search criteria or filters"
                    : "Madrasas will appear here when they are assigned to your mekhala"}
                </p>
                {(searchTerm || filterStatus !== "all") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setFilterStatus("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>District Details</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Madrasas</TableHead>
                      <TableHead>Established</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDistricts.map((district) => (
                      <TableRow key={district.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <div className="font-semibold text-gray-900">
                              {district.name || "N/A"}
                            </div>
                            <Badge
                              variant="outline"
                              className="mt-1 bg-blue-50 text-blue-700"
                            >
                              {district.code || "N/A"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {district.state || "N/A"}
                            </div>
                            <div className="text-gray-500">
                              {district.region || "N/A"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <Building className="h-4 w-4 text-green-600" />
                            </div>
                            <span className="font-semibold">
                              {madarsasCounts[district.name] || 0}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-600">
                            {district.established || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              district.status === "active"
                                ? "default"
                                : "secondary"
                            }
                            className={
                              district.status === "active"
                                ? "bg-green-100 text-green-800"
                                : ""
                            }
                          >
                            {district.status || "active"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
