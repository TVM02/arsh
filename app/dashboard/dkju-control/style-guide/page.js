"use client";

import { useState, useEffect, useMemo } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  Loader2,
  ChevronLeft,
  Palette,
  Folder,
  Lock,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  KeyRound,
  X,
  ShieldCheck,
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
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState(null);
  const [includeInFolder, setIncludeInFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [requiresAuth, setRequiresAuth] = useState(false);

  const [openFolders, setOpenFolders] = useState({});
  const [unlockedFolders, setUnlockedFolders] = useState({});
  const [unlockedFiles, setUnlockedFiles] = useState({});
  const [authModal, setAuthModal] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const { folders, individualAssets } = useMemo(() => {
    const foldersMap = {};
    const individual = [];
    for (const asset of assets) {
      const fn = asset.folderName?.trim();
      if (fn) {
        if (!foldersMap[fn]) foldersMap[fn] = [];
        foldersMap[fn].push(asset);
      } else {
        individual.push(asset);
      }
    }
    return { folders: foldersMap, individualAssets: individual };
  }, [assets]);

  const isFileUnlocked = (asset) => {
    if (!asset.requiresAuth) return true;
    if (unlockedFiles[asset.id]) return true;
    const fn = asset.folderName?.trim();
    if (fn && unlockedFolders[fn]) return true;
    return false;
  };

  const isFolderProtected = (folderName) =>
    (folders[folderName] || []).some((a) => a.requiresAuth);

  const openAuthModal = (type, data) => {
    setAuthModal({ type, ...data });
    setAuthEmail("");
    setAuthPassword("");
    setAuthError("");
  };

  const handleFileAction = (asset) => {
    if (isFileUnlocked(asset)) {
      window.open(asset.url, "_blank");
    } else {
      openAuthModal("file", { asset });
    }
  };

  const handleFolderToggle = (folderName) => {
    if (isFolderProtected(folderName) && !unlockedFolders[folderName]) {
      openAuthModal("folder", { folderName });
    } else {
      setOpenFolders((prev) => ({ ...prev, [folderName]: !prev[folderName] }));
    }
  };

  const handleAuth = async () => {
    if (!authPassword.trim()) {
      setAuthError("Please enter your password.");
      return;
    }
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/validate-brand-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: authPassword }),
      });
      const data = await res.json();
      if (data.valid) {
        if (authModal?.type === "folder") {
          setUnlockedFolders((prev) => ({ ...prev, [authModal.folderName]: true }));
          setOpenFolders((prev) => ({ ...prev, [authModal.folderName]: true }));
          toast.success(`"${authModal.folderName}" folder unlocked`);
        } else {
          setUnlockedFiles((prev) => ({ ...prev, [authModal.asset.id]: true }));
          window.open(authModal.asset.url, "_blank");
          toast.success("File access granted");
        }
        setAuthModal(null);
      } else {
        setAuthError("Invalid password. Please try again.");
      }
    } catch {
      setAuthError("Connection error. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

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
        folderName: includeInFolder && folderName.trim() ? folderName.trim() : "",
        requiresAuth: requiresAuth,
        createdAt: serverTimestamp(),
      });

      toast.success("Asset uploaded successfully");
      setAssetName("");
      setSelectedFile(null);
      setIncludeInFolder(false);
      setFolderName("");
      setRequiresAuth(false);
      setIsUploadDialogOpen(false);
      fetchAssets();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload asset");
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!assetToDelete) return;

    try {
      // Delete from Storage
      const storageRef = ref(storage, assetToDelete.storagePath);
      await deleteObject(storageRef).catch((err) => {
        console.warn("Storage item might already be gone:", err);
      });

      // Delete from Firestore
      await deleteDoc(doc(db, "brand_assets", assetToDelete.id));

      toast.success("Asset deleted successfully");
      setIsDeleteDialogOpen(false);
      setAssetToDelete(null);
      fetchAssets();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete asset");
    }
  };

  const handleDeleteClick = (asset) => {
    setAssetToDelete(asset);
    setIsDeleteDialogOpen(true);
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

  const renderAssetCard = (asset) => {
    const unlocked = isFileUnlocked(asset);
    return (
      <Card
        key={asset.id}
        className={`overflow-hidden group border-gray-200 rounded-xl shadow-none hover:border-teal-200 transition-all bg-white ${asset.requiresAuth && !unlocked ? "border-amber-200 hover:border-amber-300" : ""}`}
      >
        <div className="h-40 bg-gray-50 flex items-center justify-center p-6 relative">
          {asset.requiresAuth && !unlocked && (
            <div className="absolute top-3 right-3 z-20">
              <Badge className="bg-amber-500 text-white border-0 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" /> Protected
              </Badge>
            </div>
          )}
          {asset.requiresAuth && unlocked && (
            <div className="absolute top-3 right-3 z-20">
              <Badge className="bg-green-500 text-white border-0 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5" /> Unlocked
              </Badge>
            </div>
          )}

          {asset.requiresAuth && !unlocked ? (
            <div className="flex flex-col items-center gap-3">
              <Lock className="h-10 w-10 text-amber-300" />
              <span className="text-[10px] text-amber-600 font-medium">Auth Required</span>
            </div>
          ) : asset.contentType?.startsWith("image/") ? (
            <img
              src={asset.url}
              alt={asset.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-10 w-10 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-500 uppercase">
                {asset.fileName.split(".").pop()}
              </span>
            </div>
          )}

          {/* Hover Actions */}
          <div className="absolute inset-0 bg-white/60 md:bg-white/80 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10 backdrop-blur-[2px] md:backdrop-blur-none">
            {unlocked ? (
              <>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 border-gray-200 bg-white"
                  onClick={() => window.open(asset.url, "_blank")}
                >
                  <Eye className="h-4 w-4 text-gray-600" />
                </Button>
                <a href={asset.url} download={asset.fileName}>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 border-gray-200 bg-white"
                  >
                    <Download className="h-4 w-4 text-gray-600" />
                  </Button>
                </a>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => handleFileAction(asset)}
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2 px-3 h-9"
              >
                <KeyRound className="h-4 w-4" /> Unlock
              </Button>
            )}
            <Button
              size="icon"
              variant="destructive"
              className="h-9 w-9 bg-red-600 hover:bg-red-700"
              onClick={() => handleDeleteClick(asset)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardContent className="p-4 border-t border-gray-50">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-bold text-gray-900 text-xs truncate flex-1">
              {asset.name}
            </h3>
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 bg-gray-50 text-gray-500 font-bold border-gray-200 capitalize flex-shrink-0"
            >
              {asset.type}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {asset.folderName && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-blue-50 text-blue-600 border-blue-200 font-bold flex-shrink-0 gap-0.5">
                <Folder className="h-2 w-2" /> {asset.folderName}
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1 truncate">
            {formatSize(asset.fileSize)}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3 text-[10px] font-bold h-8 text-teal-600 hover:bg-teal-50"
            onClick={() => {
              if(!unlocked) {
                handleFileAction(asset);
              } else {
                copyToClipboard(asset.url);
              }
            }}
          >
            {unlocked ? <><Copy className="h-3 w-3 mr-1.5" /> COPY ASSET URL</> : <><Lock className="h-3 w-3 mr-1.5" /> UNLOCK TO COPY</>}
          </Button>
        </CardContent>
      </Card>
    );
  };

  if (loading || !role) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Verifying permissions...</p>
        </div>
      </Layout>
    );
  }

  if (role !== "central_admin" && role !== "admin") {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white rounded-xl p-8 border border-gray-200 shadow-none mx-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <ChevronLeft className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-500 text-center max-w-sm mt-2">
            You do not have permission to view the brand guide. This area is
            reserved for central administrators.
          </p>
          <Button
            onClick={() => router.push("/dashboard/dkju-control")}
            className="mt-6 bg-teal-600 hover:bg-teal-700 text-white"
          >
            Back to Dashboard
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
        {/* Header Section */}
        <div className="bg-white rounded-xl p-4 md:p-6 shadow-none border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                Brand Style Guide
              </h1>
              <p className="text-sm text-gray-500 leading-relaxed">
                Central repository for logos, brand assets, and design standards
              </p>
            </div>
          </div>
          <Dialog
            open={isUploadDialogOpen}
            onOpenChange={setIsUploadDialogOpen}
          >
            <DialogTrigger asChild>
              <Button className="w-full md:w-auto bg-teal-600 hover:bg-teal-700 text-white shadow-none transition-all h-10 px-6 font-medium">
                <Plus className="h-4 w-4 mr-2" />
                Add Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[425px] bg-white rounded-xl p-6 border-gray-200">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Upload Asset
                </DialogTitle>
                <CardDescription className="text-gray-500">
                  Add logos or documentation to the brand folder.
                </CardDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-1.5">
                  <Label
                    htmlFor="name"
                    className="text-sm font-medium text-gray-700"
                  >
                    Asset Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. Primary Logo Light"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    className="rounded-lg border-gray-300"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label
                    htmlFor="category"
                    className="text-sm font-medium text-gray-700"
                  >
                    Category
                  </Label>
                  <select
                    id="category"
                    className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                  >
                    <option value="logo">Brand Logo</option>
                    <option value="icon">System Icon</option>
                    <option value="document">Document</option>
                    <option value="color">Social Asset</option>
                    <option value="other">Other Asset</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label
                    htmlFor="file"
                    className="text-sm font-medium text-gray-700"
                  >
                    File
                  </Label>
                  <Input
                    id="file"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="rounded-lg border-gray-300 cursor-pointer"
                  />
                </div>

                {/* Include in Folder */}
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="checkbox"
                    id="includeInFolder"
                    checked={includeInFolder}
                    onChange={(e) => setIncludeInFolder(e.target.checked)}
                    className="w-4 h-4 rounded accent-teal-600 cursor-pointer"
                  />
                  <Label htmlFor="includeInFolder" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Include in Folder
                  </Label>
                </div>

                {/* Folder Name (shown when checkbox is checked) */}
                {includeInFolder && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="folderName" className="text-sm font-medium text-gray-700">
                      Folder Name
                    </Label>
                    <Input
                      id="folderName"
                      placeholder="e.g. Logos, Documents, Icons"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      list="folder-suggestions"
                      className="rounded-lg border-gray-300"
                    />
                    <datalist id="folder-suggestions">
                      {[...new Set(assets.filter((a) => a.folderName).map((a) => a.folderName))].map((fn) => (
                        <option key={fn} value={fn} />
                      ))}
                    </datalist>
                    <p className="text-xs text-gray-400">
                      Type an existing folder name to add to it, or enter a new name to create one.
                    </p>
                  </div>
                )}

                {/* Require Authentication toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Require Authentication</p>
                    <p className="text-xs text-gray-500 mt-0.5">Users must enter valid credentials to access</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={requiresAuth}
                    onClick={() => setRequiresAuth(!requiresAuth)}
                    className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                      requiresAuth ? "bg-amber-500" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block w-5 h-5 mt-0.5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                        requiresAuth ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile || !assetName}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11 font-semibold"
                >
                  {uploading ? "Uploading..." : "Upload Asset"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="assets" className="w-full">
          <TabsList className="bg-gray-200/50 p-1 mb-6 rounded-lg flex items-center justify-start flex-nowrap gap-1 h-auto w-full md:w-fit overflow-x-auto no-scrollbar scrollbar-hide">
            <TabsTrigger
              value="assets"
              className="px-4 md:px-6 py-2 rounded-md text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-none whitespace-nowrap"
            >
              Assets
            </TabsTrigger>
            <TabsTrigger
              value="colors"
              className="px-4 md:px-6 py-2 rounded-md text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-none whitespace-nowrap"
            >
              Colors
            </TabsTrigger>
            <TabsTrigger
              value="typography"
              className="px-4 md:px-6 py-2 rounded-md text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-teal-600 data-[state=active]:shadow-none whitespace-nowrap"
            >
              Typography
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="mt-0 outline-none">
            <div className="space-y-6">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array(4)
                    .fill(0)
                    .map((_, i) => (
                      <div
                        key={i}
                        className="bg-white border border-gray-200 rounded-xl flex flex-col h-64 animate-pulse"
                      >
                        <div className="flex-1 bg-gray-50 rounded-t-xl" />
                        <div className="p-4 space-y-2">
                          <div className="h-4 bg-gray-100 rounded w-3/4" />
                          <div className="h-3 bg-gray-100 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                </div>
              ) : assets.length === 0 ? (
                <div className="py-16 text-center bg-white border border-gray-200 rounded-xl shadow-none">
                  <ImageIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-gray-900">
                    No assets found
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Upload brand logos or docs to get started.
                  </p>
                </div>
              ) : (
                <>
                  {Object.keys(folders).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                        Folders
                      </h3>
                      {Object.entries(folders).map(([folderName, folderAssets]) => {
                        const protected_ = isFolderProtected(folderName);
                        const isUnlocked = !protected_ || !!unlockedFolders[folderName];
                        const isOpen = !!openFolders[folderName];
                        return (
                          <div
                            key={folderName}
                            className={`bg-white border rounded-lg overflow-hidden transition-all ${
                              protected_ && !isUnlocked
                                ? "border-amber-200"
                                : "border-gray-200"
                            }`}
                          >
                            <button
                              onClick={() => handleFolderToggle(folderName)}
                              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                            >
                              {isOpen && isUnlocked ? (
                                <FolderOpen className="h-5 w-5 text-teal-600 flex-shrink-0" />
                              ) : (
                                <Folder
                                  className={`h-5 w-5 flex-shrink-0 ${
                                    protected_ && !isUnlocked
                                      ? "text-amber-500"
                                      : "text-teal-600"
                                  }`}
                                />
                              )}
                              <span className="font-bold text-gray-900 flex-1 text-base">
                                {folderName}
                              </span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge
                                  variant="outline"
                                  className="text-xs text-gray-500 border-gray-200"
                                >
                                  {folderAssets.length}{" "}
                                  {folderAssets.length === 1 ? "file" : "files"}
                                </Badge>
                                {protected_ && !isUnlocked && (
                                  <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs flex items-center gap-1">
                                    <Lock className="h-3 w-3" /> Protected
                                  </Badge>
                                )}
                                {protected_ && isUnlocked && (
                                  <Badge className="bg-green-100 text-green-700 border border-green-200 text-xs flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" /> Unlocked
                                  </Badge>
                                )}
                                {isOpen && isUnlocked ? (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                )}
                              </div>
                            </button>
                            {isOpen && isUnlocked && (
                              <div className="border-t border-gray-100 p-4 bg-gray-50/40">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                  {folderAssets.map((asset) => renderAssetCard(asset))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {individualAssets.length > 0 && (
                    <div className="space-y-3">
                      {Object.keys(folders).length > 0 && (
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-6 mb-3">
                          Individual Assets
                        </h3>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {individualAssets.map((asset) => renderAssetCard(asset))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="colors" className="mt-0 outline-none space-y-8">
            <section className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-none">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  Core Brand Colors
                </h2>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <ColorCard
                  name="Teal Primary"
                  hex="#0D9488"
                  classes="bg-teal-600"
                  description="Main identity color."
                />
                <ColorCard
                  name="Teal Dark"
                  hex="#0F766E"
                  classes="bg-teal-700"
                  description="Hover & active states."
                />
                <ColorCard
                  name="Teal Light"
                  hex="#99F6E4"
                  classes="bg-teal-200"
                  description="Subtle backgrounds."
                />
                <ColorCard
                  name="Alert"
                  hex="#FACC15"
                  classes="bg-yellow-400"
                  description="Warnings & highlights."
                />
              </div>
            </section>

            <section className="bg-white p-4 md:p-6 rounded-xl border border-gray-200 shadow-none">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-lg font-bold text-gray-900">
                  Semantic Neutrals
                </h2>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <ColorCard
                  name="High Emphasis"
                  hex="#111827"
                  classes="bg-gray-900"
                  description="Primary text & titles."
                />
                <ColorCard
                  name="Medium Emphasis"
                  hex="#4B5563"
                  classes="bg-gray-600"
                  description="Body & secondary text."
                />
                <ColorCard
                  name="Borders"
                  hex="#E5E7EB"
                  classes="bg-gray-200"
                  description="Dividers & outlines."
                />
                <ColorCard
                  name="Background"
                  hex="#F9FAFB"
                  classes="bg-gray-50"
                  description="App & section backgrounds."
                />
              </div>
            </section>
          </TabsContent>

          <TabsContent value="typography" className="mt-0 outline-none">
            <Card className="border-gray-200 rounded-xl overflow-hidden shadow-none bg-white">
              <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-6 pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center text-teal-600 font-bold text-xl">
                    Aa
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold">
                      Typography System
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Primary Typeface:{" "}
                      <span className="font-bold text-teal-600">Inter</span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-gray-100">
                <TypeSample
                  label="Display"
                  specs="32px / Bold"
                  classes="text-2xl md:text-3xl font-bold tracking-tight"
                />
                <TypeSample
                  label="Headline"
                  specs="20px / Bold"
                  classes="text-lg md:text-xl font-bold"
                />
                <TypeSample
                  label="Subheading"
                  specs="16px / Semibold"
                  classes="text-sm md:text-base font-semibold"
                />
                <TypeSample
                  label="Body Text"
                  specs="14px / Regular"
                  classes="text-xs md:text-sm text-gray-600 leading-relaxed"
                />
                <TypeSample
                  label="Utility"
                  specs="12px / Medium"
                  classes="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-wider"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>


      <AlertDialog
        open={!!authModal}
        onOpenChange={(open) => !open && setAuthModal(null)}
      >
        <AlertDialogContent className="w-[95vw] md:w-full max-w-[425px] bg-white rounded-xl p-6 border-gray-200 shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl">
              <Lock className="h-5 w-5 text-amber-500" />
              Authentication Required
            </AlertDialogTitle>
            <AlertDialogDescription>
              {authModal?.type === "folder" 
                ? `The folder "${authModal.folderName}" contains protected assets.`
                : "This asset is protected."}
              <br/>Please enter your credentials to access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              />
            </div>
            {authError && (
              <p className="text-sm text-red-500 font-medium">{authError}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={authLoading}>Cancel</AlertDialogCancel>
            <Button
              className="bg-teal-600 hover:bg-teal-700 text-white border-0"
              onClick={handleAuth}
              disabled={authLoading}
            >
              {authLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              {authLoading ? "Verifying..." : "Unlock Access"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="w-[95vw] md:w-full max-w-[425px] bg-white rounded-xl p-6 border-gray-200 shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the asset &quot;{assetToDelete?.name}
              &quot; from brand storage and Firestore. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={confirmDelete}
            >
              Delete Asset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function ColorCard({ name, hex, classes, description }) {
  return (
    <div className="space-y-2">
      <div
        className={`h-20 w-full rounded-lg ${classes} border border-black/5 shadow-none`}
      />
      <div>
        <div className="flex items-center justify-between gap-1">
          <span className="font-bold text-xs text-gray-900 truncate flex-1">
            {name}
          </span>
          <code className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded flex-shrink-0">
            {hex}
          </code>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">
          {description}
        </p>
      </div>
    </div>
  );
}

function TypeSample({ label, specs, classes }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 py-4 md:py-6 px-4 md:px-6 items-center">
      <div className="col-span-1">
        <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-0.5 md:mb-0">
          {label}
        </p>
        <p className="text-[10px] text-gray-400 font-mono">{specs}</p>
      </div>
      <div className="md:col-span-3">
        <p
          className={`${classes} text-gray-900 leading-tight md:leading-normal`}
        >
          Visual consistency builds user trust.
        </p>
      </div>
    </div>
  );
}
