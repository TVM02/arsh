"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Upload,
  Download,
  Trash2,
  Image as ImageIcon,
  FileText,
  File,
  Plus,
  Eye,
  Check,
  Copy,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Layout from "@/components/Layout";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authUtils";

export default function StyleGuidePage() {
  const router = useRouter();
  const { user, role } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [assetType, setAssetType] = useState("logo");
  const [selectedFile, setSelectedFile] = useState(null);
  const [assetName, setAssetName] = useState("");

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "brand_assets"),
        orderBy("createdAt", "desc"),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAssets(data);
    } catch (error) {
      console.error("Error fetching assets:", error);
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (role === "admin" || role === "central_admin")) {
      fetchAssets();
    }
  }, [user, role]);

  const handleUpload = async () => {
    if (!selectedFile || !assetName) {
      toast.error("Please provide both name and file");
      return;
    }

    try {
      setUploading(true);
      // Upload to Storage
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const storageRef = ref(storage, `brand/${fileName}`);
      await uploadBytes(storageRef, selectedFile, {
        contentDisposition: "attachment",
      });
      const downloadURL = await getDownloadURL(storageRef);

      // Save to Firestore
      await addDoc(collection(db, "brand_assets"), {
        name: assetName,
        type: assetType,
        url: downloadURL,
        storagePath: `brand/${fileName}`,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        contentType: selectedFile.type,
        createdAt: serverTimestamp(),
      });

      toast.success("Asset uploaded successfully");
      setAssetName("");
      setSelectedFile(null);
      fetchAssets();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload asset");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (asset) => {
    if (!confirm(`Are you sure you want to delete "${asset.name}"?`)) return;

    try {
      // Delete from Storage
      const storageRef = ref(storage, asset.storagePath);
      await deleteObject(storageRef).catch((err) => {
        console.warn("Storage item might already be gone:", err);
      });

      // Delete from Firestore
      await deleteDoc(doc(db, "brand_assets", asset.id));

      toast.success("Asset deleted successfully");
      fetchAssets();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete asset");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!user || (role !== "admin" && role !== "central_admin")) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-500">
            You do not have permission to view the brand guide.
          </p>
          <Button onClick={() => router.push("/")} className="mt-4">
            Go Home
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="rounded-full"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                Brand Style Guide
              </h1>
              <p className="text-gray-500 text-sm md:text-base">
                Visual identity, assets, and design system resources.
              </p>
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-100 transition-all active:scale-95">
                <Plus className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Upload Brand Asset</DialogTitle>
                <CardDescription>
                  Upload logos, icons, or documents to the brand folder.
                </CardDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Asset Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Primary Logo Light"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                  >
                    <option value="logo">Logo</option>
                    <option value="icon">Icon</option>
                    <option value="document">Document</option>
                    <option value="color">Color Swatch</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="file">File</Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile || !assetName}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  {uploading ? "Uploading..." : "Click to Upload Asset"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        <Tabs defaultValue="assets" className="w-full">
          <TabsList className="flex w-full overflow-x-auto bg-gray-100/50 p-1 mb-8 rounded-xl h-auto">
            <TabsTrigger
              value="assets"
              className="flex-1 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Logos & Assets
            </TabsTrigger>
            <TabsTrigger
              value="colors"
              className="flex-1 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Color Palette
            </TabsTrigger>
            <TabsTrigger
              value="typography"
              className="flex-1 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Typography
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="mt-0 outline-none">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <Card
                      key={i}
                      className="animate-pulse bg-gray-50/50 border-gray-100 rounded-2xl"
                    >
                      <div className="h-48 bg-gray-200/50" />
                      <CardContent className="p-4 space-y-3">
                        <div className="h-4 bg-gray-200/50 rounded w-3/4" />
                        <div className="h-3 bg-gray-200/50 rounded w-1/2" />
                      </CardContent>
                    </Card>
                  ))
              ) : assets.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-3xl">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="h-10 w-10 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">
                    No assets found
                  </h3>
                  <p className="text-gray-500 max-w-sm mx-auto mt-1">
                    Start by uploading brand logos, icons, or documentation
                    PDFs.
                  </p>
                </div>
              ) : (
                assets.map((asset) => (
                  <Card
                    key={asset.id}
                    className="overflow-hidden group border-gray-100 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-gray-100 transition-all duration-300"
                  >
                    <div className="h-48 bg-gray-50 flex items-center justify-center p-8 relative overflow-hidden">
                      {asset.contentType?.startsWith("image/") ? (
                        <div className="relative z-10 w-full h-full flex items-center justify-center">
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="max-h-full max-w-full object-contain drop-shadow-md"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <FileText className="h-16 w-16 text-teal-600" />
                          <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-1 rounded lowercase">
                            .{asset.fileName.split(".").pop()}
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gray-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-20 backdrop-blur-sm">
                        <Button
                          size="icon"
                          className="bg-white text-gray-900 hover:bg-teal-50 hover:text-teal-600 rounded-full h-10 w-10 transition-transform active:scale-90"
                          onClick={() => window.open(asset.url, "_blank")}
                        >
                          <Eye className="h-5 w-5" />
                        </Button>
                        <a
                          href={asset.url}
                          download={asset.fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            size="icon"
                            className="bg-white text-gray-900 hover:bg-teal-50 hover:text-teal-600 rounded-full h-10 w-10 transition-transform active:scale-90"
                          >
                            <Download className="h-5 w-5" />
                          </Button>
                        </a>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="bg-red-500 hover:bg-red-600 rounded-full h-10 w-10 transition-transform active:scale-90"
                          onClick={() => handleDelete(asset)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-gray-900 truncate pr-2">
                          {asset.name}
                        </h3>
                        <Badge className="bg-white text-gray-600 border-gray-200 font-medium text-[10px] h-5 px-2">
                          {asset.type}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-400 font-medium truncate mb-4">
                        {asset.fileName} • {formatSize(asset.fileSize)}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full bg-gray-50 hover:bg-teal-50 hover:text-teal-600 transition-colors text-xs font-semibold h-9"
                        onClick={() => copyToClipboard(asset.url)}
                      >
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        Copy Public URL
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="colors" className="mt-0 outline-none space-y-12">
            <section>
              <div className="flex items-end gap-3 mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Core Brand Colors
                </h2>
                <div className="h-px flex-1 bg-gray-100 mb-2" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <ColorCard
                  name="Teal Primary"
                  hex="#0D9488"
                  classes="bg-teal-600"
                  description="Main action color and brand identity foundation."
                />
                <ColorCard
                  name="Teal Darker"
                  hex="#0F766E"
                  classes="bg-teal-700"
                  description="Used for deep contrast and active hover states."
                />
                <ColorCard
                  name="Teal Muted"
                  hex="#99F6E4"
                  classes="bg-teal-200"
                  description="Soft backgrounds and subtle interaction markers."
                />
                <ColorCard
                  name="Alert Yellow"
                  hex="#FACC15"
                  classes="bg-yellow-400"
                  description="Used sparingly for warnings and important calls."
                />
              </div>
            </section>

            <section>
              <div className="flex items-end gap-3 mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Semantic Neutrals
                </h2>
                <div className="h-px flex-1 bg-gray-100 mb-2" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <ColorCard
                  name="Content Ink"
                  hex="#111827"
                  classes="bg-gray-900"
                  description="Highest emphasis text, titles, and body content."
                />
                <ColorCard
                  name="Body Slate"
                  hex="#4B5563"
                  classes="bg-gray-600"
                  description="Standard paragraphs and secondary information."
                />
                <ColorCard
                  name="Border Line"
                  hex="#E5E7EB"
                  classes="bg-gray-200"
                  description="Dividers, component borders, and outlines."
                />
                <ColorCard
                  name="Canvas Gray"
                  hex="#F9FAFB"
                  classes="bg-gray-50"
                  description="Application background and section separation."
                />
              </div>
            </section>
          </TabsContent>

          <TabsContent value="typography" className="mt-0 outline-none">
            <Card className="border-gray-100 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-8 pt-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-teal-600 font-black text-2xl shadow-sm">
                    Aa
                  </div>
                  <div>
                    <CardTitle className="text-2xl tracking-tight">
                      Typography Standards
                    </CardTitle>
                    <CardDescription className="text-gray-500 font-medium mt-0.5">
                      Primary Font: <span className="text-teal-600">Inter</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-0 divide-y divide-gray-100">
                <TypeSample
                  label="Display Super"
                  specs="36px / 120% / Bold"
                  classes="text-4xl font-black tracking-tighter"
                />
                <TypeSample
                  label="Headline Large"
                  specs="24px / 130% / Bold"
                  classes="text-2xl font-bold tracking-tight"
                />
                <TypeSample
                  label="Section Title"
                  specs="18px / 140% / Semibold"
                  classes="text-lg font-semibold"
                />
                <TypeSample
                  label="Body Regular"
                  specs="16px / 160% / Regular"
                  classes="text-base text-gray-600 leading-relaxed"
                />
                <TypeSample
                  label="Utility / Caption"
                  specs="13px / 150% / Medium"
                  classes="text-[13px] text-gray-500 font-medium uppercase tracking-wide"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function ColorCard({ name, hex, classes, description }) {
  return (
    <div className="group">
      <div
        className={`h-32 w-full rounded-2xl ${classes} shadow-inner border border-black/5 mb-3 transition-transform group-hover:-translate-y-1`}
      />
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-sm text-gray-900">{name}</span>
          <code className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase">
            {hex}
          </code>
        </div>
        <p className="text-[11px] leading-relaxed text-gray-500 font-medium">
          {description}
        </p>
      </div>
    </div>
  );
}

function TypeSample({ label, specs, classes }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 py-10 px-6 sm:px-10 items-baseline">
      <div className="col-span-1">
        <p className="text-xs font-black text-teal-600 uppercase tracking-widest mb-1">
          {label}
        </p>
        <p className="text-[11px] font-mono text-gray-400">{specs}</p>
      </div>
      <div className="md:col-span-3">
        <p className={`${classes} text-gray-900`}>
          Design brings content to life via visual hierarchy.
        </p>
      </div>
    </div>
  );
}
