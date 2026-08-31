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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Loader2,
} from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { getAuthorizedDistricts } from "@/lib/convenerData";
import {
  fetchMadarsasByDistricts,
  madrasaMatchesDistrict,
  splitDistrictsAndMekhalas,
} from "@/lib/madrasaHierarchy";

export default function MekhalaDistricts() {
  const { userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [mekhalas, setMekhalas] = useState([]);
  const [trueDistricts, setTrueDistricts] = useState([]);
  const [madarsasCounts, setMadarsasCounts] = useState({});
  const [totalMadarsasCount, setTotalMadarsasCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (userData && userData.role === "convener_admin") {
      const fetchDistricts = async () => {
        try {
          setLoading(true);

          // Determine assigned districts using unified logic
          let districtsData = await getAuthorizedDistricts(userData, db);

          districtsData.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

          const allDistrictsSnapshot = await getDocs(collection(db, "districts"));
          const allDistrictsCount = allDistrictsSnapshot.size;
          const isStateLevel = districtsData.length >= allDistrictsCount && allDistrictsCount > 0;

          // Fetch madarsas count for each district using the same alias-aware
          // matching as the Madrasas page, so counts stay consistent across the portal.
          const districtNames = districtsData.map((d) => d.name).filter(Boolean);
          const candidateMadarsas = await fetchMadarsasByDistricts(
            db,
            query,
            collection,
            where,
            getDocs,
            districtNames
          );

          const counts = {};
          const uniqueMadarsaIds = new Set();
          districtsData.forEach((district) => {
            const districtMadarsas = candidateMadarsas.filter((madarsa) => {
              try {
                return madrasaMatchesDistrict(madarsa, district.name);
              } catch {
                return false;
              }
            });
            counts[district.name] = districtMadarsas.length;
            districtMadarsas.forEach((m) => uniqueMadarsaIds.add(m.id));
          });
          setMadarsasCounts(counts);
          setTotalMadarsasCount(isStateLevel ? candidateMadarsas.length : uniqueMadarsaIds.size);

          // The `districts` collection actually stores Mekhala-level sub-units
          // (e.g. "POTHENCODE", "mekala_01"), but a handful of legacy/duplicate
          // docs are named after the true parent District (e.g. "ALAPPUZHA").
          // Split those apart so the counts and lists shown here are accurate
          // instead of lumping everything together as "Districts".
          const { mekhalas: mekhalaRows, districts: districtRows } =
            splitDistrictsAndMekhalas(districtsData, counts);
          setMekhalas(mekhalaRows);
          setTrueDistricts(districtRows);
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

  // Filter mekhalas based on search term and status
  const filteredMekhalas = mekhalas.filter((mekhala) => {
    const matchesSearch =
      mekhala.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mekhala.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mekhala.state?.toLowerCase().includes(searchTerm.toLowerCase());

    const status = mekhala.status || "active";
    const matchesStatus = filterStatus === "all" || status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex h-[80vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      </Layout>
    );
  }

  if (!userData || userData.role !== "convener_admin") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600">
              You need to be logged in as a Convener Admin to access this page.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const activeMekhalaCount = mekhalas.filter((m) => (m.status || "active") === "active").length;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-lg p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Mekhala Management</h1>
          <p className="text-teal-100">
            Manage and monitor mekhalas assigned to your administration
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Mekhala</p>
                  <p className="text-2xl font-bold">{mekhalas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <Building className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Madrasas</p>
                  <p className="text-2xl font-bold">{totalMadarsasCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <Users className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Mekhala</p>
                  <p className="text-2xl font-bold">{activeMekhalaCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="mekhala">
          <TabsList>
            <TabsTrigger value="mekhala">Mekhala</TabsTrigger>
            <TabsTrigger value="districts">Districts</TabsTrigger>
          </TabsList>

          {/* Mekhala Tab */}
          <TabsContent value="mekhala">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Mekhala ({filteredMekhalas.length})
                </CardTitle>
                <CardDescription>
                  Mekhalas assigned to your administration
                </CardDescription>

                {/* Search and Filters */}
                <div className="flex gap-4 mt-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search mekhala by name, code, or state..."
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
                {filteredMekhalas.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-gray-900 mb-2">
                      {searchTerm || filterStatus !== "all"
                        ? "No mekhala found"
                        : "No mekhala assigned"}
                    </h3>
                    <p className="text-gray-500 mb-6">
                      {searchTerm || filterStatus !== "all"
                        ? "Try adjusting your search criteria or filters"
                        : "Mekhalas will appear here when they are assigned to your administration"}
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
                          <TableHead>Mekhala Details</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Madrasas</TableHead>
                          <TableHead>Established</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMekhalas.map((mekhala) => (
                          <TableRow key={mekhala.id} className="hover:bg-gray-50">
                            <TableCell>
                              <div>
                                <div className="font-semibold text-gray-900">
                                  {mekhala.name || "N/A"}
                                </div>
                                <Badge
                                  variant="outline"
                                  className="mt-1 bg-teal-50 text-teal-700"
                                >
                                  {mekhala.code || "N/A"}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium text-gray-900">
                                  {mekhala.state || "N/A"}
                                </div>
                                <div className="text-gray-500">
                                  {mekhala.region || "N/A"}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                                  <Building className="h-4 w-4 text-teal-600" />
                                </div>
                                <span className="font-semibold">
                                  {madarsasCounts[mekhala.name] || 0}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-gray-600">
                                {mekhala.established || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  (mekhala.status || "active") === "active"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  (mekhala.status || "active") === "active"
                                    ? "bg-teal-100 text-teal-800"
                                    : ""
                                }
                              >
                                {mekhala.status || "active"}
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
          </TabsContent>

          {/* Districts Tab */}
          <TabsContent value="districts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Districts ({trueDistricts.length})
                </CardTitle>
                <CardDescription>
                  True districts, aggregated from their assigned mekhalas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trueDistricts.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-gray-900 mb-2">
                      No districts in scope
                    </h3>
                    <p className="text-gray-500">
                      Districts appear here once mekhalas belonging to them are assigned
                      to your administration.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>District</TableHead>
                          <TableHead>Mekhala Count</TableHead>
                          <TableHead>Madrasas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trueDistricts.map((district) => (
                          <TableRow key={district.name} className="hover:bg-gray-50">
                            <TableCell>
                              <div className="font-semibold text-gray-900">
                                {district.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                                  <MapPin className="h-4 w-4 text-teal-600" />
                                </div>
                                <span className="font-semibold">{district.mekhalaCount}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                                  <Building className="h-4 w-4 text-teal-600" />
                                </div>
                                <span className="font-semibold">{district.madarsaCount}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
