"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Image as ImageIcon,
  FileText,
  Eye,
  ExternalLink,
  Lock,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  KeyRound,
  X,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

export default function PublicStyleGuidePage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFolders, setOpenFolders] = useState({});
  const [unlockedFolders, setUnlockedFolders] = useState({});
  const [unlockedFiles, setUnlockedFiles] = useState({});

  // Auth modal state
  const [authModal, setAuthModal] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "brand_assets"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const defaultLogo = {
        id: "default-logo",
        name: "Official DKJU Primary Logo",
        type: "logo",
        url: "/logo.png",
        contentType: "image/png",
        fileSize: 15420,
        fileName: "logo.png",
        isDefault: true,
        requiresAuth: false,
        folderName: "",
      };

      setAssets([defaultLogo, ...data]);
    } catch (error) {
      console.error("Error fetching assets:", error);
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

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
        if (authModal.type === "folder") {
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

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Inline asset card render — avoid defining component inside component
  const renderAssetCard = (asset) => {
    const unlocked = isFileUnlocked(asset);
    return (
      <Card
        key={asset.id}
        className={`overflow-hidden group border-gray-200 rounded-none transition-all duration-300 bg-white hover:border-teal-200 ${
          asset.isDefault ? "ring-2 ring-teal-500 ring-offset-2" : ""
        } ${asset.requiresAuth && !unlocked ? "border-amber-200 hover:border-amber-300" : ""}`}
      >
        <div className="h-44 bg-gray-50/50 flex items-center justify-center p-8 relative overflow-hidden">
          {asset.isDefault && (
            <div className="absolute top-3 left-3 z-20">
              <Badge className="bg-teal-600 text-white border-0 text-[10px] uppercase font-bold tracking-wider">
                Primary
              </Badge>
            </div>
          )}
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
              <Lock className="h-14 w-14 text-amber-300" />
              <span className="text-xs text-amber-600 font-medium">Authentication Required</span>
            </div>
          ) : asset.contentType?.startsWith("image/") ? (
            <img
              src={asset.url}
              alt={asset.name}
              className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <FileText className="h-12 w-12 text-teal-600/60" />
              <span className="text-[12px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
                {asset.fileName?.split(".").pop() || "FILE"}
              </span>
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-teal-900/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 z-10 backdrop-blur-[4px]">
            {unlocked ? (
              <>
                <a href={asset.url} target="_blank" rel="noopener noreferrer">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-10 w-10 border-0 bg-teal-600 text-white hover:bg-teal-700 hover:scale-110 transition-transform"
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                </a>
                <a href={asset.url} target="_blank" rel="noopener noreferrer">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-10 w-10 border-0 bg-white/20 text-white hover:bg-white/30 hover:scale-110 transition-transform"
                  >
                    <Eye className="h-5 w-5" />
                  </Button>
                </a>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => handleFileAction(asset)}
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2 px-4"
              >
                <KeyRound className="h-4 w-4" /> Unlock
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-5 border-t border-gray-50">
          <div className="flex justify-between items-start gap-2 mb-2">
            <h3 className="font-bold text-gray-900 text-sm truncate flex-1 leading-tight">
              {asset.name}
            </h3>
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-2 bg-gray-50 text-gray-500 font-bold border-gray-200 capitalize"
            >
              {asset.type}
            </Badge>
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px] text-gray-400 font-medium font-mono uppercase tracking-tight">
            <span>Size: {formatSize(asset.fileSize)}</span>
            <span className="text-teal-600/70">
              {asset.contentType?.split("/")[1] || "asset"}
            </span>
          </div>
          {asset.requiresAuth && !unlocked && (
            <Button
              onClick={() => handleFileAction(asset)}
              size="sm"
              className="w-full mt-3 h-8 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold gap-1.5"
            >
              <Lock className="h-3 w-3" /> Enter Credentials to Access
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-grow">
        <div className="container mx-auto px-4 py-8 md:py-12 space-y-8 max-w-7xl">
          {/* Hero */}
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-12">
            <Badge className="bg-teal-50 text-teal-700 hover:bg-teal-50 border-teal-100 px-3 py-1 font-semibold text-xs tracking-wide uppercase">
              Brand Resources
            </Badge>
            <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
              Dakshina Kerala Jem-Iyyathul Ulama{" "}
              <br className="hidden md:block" />
              <span className="text-teal-600">(DKJU)</span>
            </h1>
            <p className="text-gray-500 text-lg leading-relaxed">
              Official branding assets, color palettes, and typography for the
              DKJU Smart Islamic Education Platform.
            </p>
          </div>

          <Tabs defaultValue="assets" className="w-full">
            <div className="flex justify-center mb-10">
              <TabsList className="bg-gray-100/80 p-1 rounded-none h-auto flex flex-wrap justify-center border border-gray-200/50">
                <TabsTrigger
                  value="assets"
                  className="px-6 md:px-10 py-2.5 rounded-none text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-teal-600 hover:text-teal-500"
                >
                  Assets
                </TabsTrigger>
                <TabsTrigger
                  value="colors"
                  className="px-6 md:px-10 py-2.5 rounded-none text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-teal-600 hover:text-teal-500"
                >
                  Colors
                </TabsTrigger>
                <TabsTrigger
                  value="typography"
                  className="px-6 md:px-10 py-2.5 rounded-none text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-teal-600 hover:text-teal-500"
                >
                  Typography
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Assets Tab ── */}
            <TabsContent value="assets" className="mt-0 outline-none focus:ring-0">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array(4).fill(0).map((_, i) => (
                    <div
                      key={i}
                      className="bg-white border border-gray-200 rounded-none flex flex-col h-72 animate-pulse"
                    >
                      <div className="flex-1 bg-gray-50" />
                      <div className="p-5 space-y-3">
                        <div className="h-5 bg-gray-100 rounded w-3/4" />
                        <div className="h-4 bg-gray-100 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : assets.length === 0 ? (
                <div className="py-24 text-center bg-white border border-dashed border-gray-200 rounded-none">
                  <ImageIcon className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-gray-900">No assets available</h3>
                  <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
                    Brand assets are currently being updated. Please check back later.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Folders section */}
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
                            {/* Folder header row */}
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

                            {/* Folder contents */}
                            {isOpen && (
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

                  {/* Individual files */}
                  {individualAssets.length > 0 && (
                    <div>
                      {Object.keys(folders).length > 0 && (
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                          Individual Files
                        </h3>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {individualAssets.map((asset) => renderAssetCard(asset))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Colors Tab ── */}
            <TabsContent value="colors" className="mt-0 outline-none space-y-12">
              <section className="bg-white p-6 md:p-10 rounded-none border border-gray-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-full -z-0 opacity-50" />
                <div className="flex items-center gap-4 mb-10 relative z-10">
                  <div className="w-10 h-10 bg-teal-600 rounded-none flex items-center justify-center text-white">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Primary Identity</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                  <ColorCard name="Deep Teal" hex="#0D9488" classes="bg-[#0D9488]" description="Core identity color representing growth and stability." />
                  <ColorCard name="Dark Teal" hex="#0F766E" classes="bg-[#0F766E]" description="Professional dark tone used for interactive states." />
                  <ColorCard name="Soft Teal" hex="#99F6E4" classes="bg-[#99F6E4]" description="Secondary teal for backgrounds and highlights." />
                  <ColorCard name="Brand Gold" hex="#FACC15" classes="bg-[#FACC15]" description="Vibrant accent for CTA and call-outs." />
                </div>
              </section>

              <section className="bg-white p-6 md:p-10 rounded-none border border-gray-200 relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-48 h-48 bg-gray-50 rounded-tl-full -z-0 opacity-50" />
                <div className="flex items-center gap-4 mb-10 relative z-10">
                  <div className="w-10 h-10 bg-gray-900 rounded-none flex items-center justify-center text-white">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Backgrounds & Text</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
                  <ColorCard name="High Emphasis" hex="#111827" classes="bg-[#111827]" description="Primary text and titles for maximum readability." />
                  <ColorCard name="Secondary Text" hex="#4B5563" classes="bg-[#4B5563]" description="Medium emphasis for body copy and descriptions." />
                  <ColorCard name="Surface Borders" hex="#E5E7EB" classes="bg-[#E5E7EB]" description="Subtle borders to define interactive containers." />
                  <ColorCard name="Glass White" hex="#F9FAFB" classes="bg-[#F9FAFB]" description="Base background for sections and larger surfaces." />
                </div>
              </section>
            </TabsContent>

            {/* ── Typography Tab ── */}
            <TabsContent value="typography" className="mt-0 outline-none">
              <Card className="border-gray-200 rounded-none overflow-hidden bg-white border-0 ring-1 ring-gray-200">
                <div className="bg-gray-50/80 border-b border-gray-100 p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-white rounded-none border border-teal-100 flex items-center justify-center text-teal-600 font-extrabold text-3xl transition-transform hover:scale-110">
                      Aa
                    </div>
                    <div>
                      <p className="text-2xl font-bold tracking-tight text-gray-900">Typography System</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Primary Interface Font:{" "}
                        <span className="font-bold text-teal-600 font-mono">Inter</span>
                      </p>
                    </div>
                  </div>
                  <Link href="https://fonts.google.com/specimen/Inter" target="_blank">
                    <Button variant="outline" className="text-xs font-bold border-gray-200 hover:bg-gray-50">
                      DOWNLOAD FONT <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
                <div className="divide-y divide-gray-100">
                  <TypeSample label="Display" specs="32px / Bold / Tracking -0.05" classes="text-3xl md:text-5xl font-bold tracking-tight" />
                  <TypeSample label="Headline" specs="Semibold / 20px" classes="text-xl md:text-2xl font-semibold tracking-tight" />
                  <TypeSample label="Subheading" specs="Medium / 16px" classes="text-base md:text-lg font-medium text-gray-700" />
                  <TypeSample label="Body Copy" specs="Regular / 14px" classes="text-sm md:text-base text-gray-500 leading-relaxed max-w-2xl" />
                  <TypeSample label="Labels" specs="Bold / 12px / Uppercase" classes="text-[11px] md:text-xs text-teal-600 font-bold uppercase tracking-[0.2em]" />
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />

      {/* Authentication Modal */}
      {authModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Lock className="h-4 w-4 text-amber-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Authentication Required</h2>
              </div>
              <button
                onClick={() => setAuthModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              {authModal.type === "folder"
                ? `The folder "${authModal.folderName}" contains protected files. Enter any valid DKJU password to access.`
                : `"${authModal.asset?.name}" is protected. Enter any valid DKJU password to access.`}
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                />
              </div>

              {authError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {authError}
                </div>
              )}

              <Button
                onClick={handleAuth}
                disabled={authLoading}
                className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Verify & Access
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-400 text-center">
                Use your DKJU portal password to authenticate.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ColorCard({ name, hex, classes, description }) {
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(`${text} copied!`);
  };

  return (
    <div className="group space-y-4">
      <div
        className={`h-28 w-full rounded-none ${classes} border border-black/5 transition-transform group-hover:scale-105 duration-300 relative overflow-hidden flex items-end p-3`}
      >
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto h-7 px-2 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => copyToClipboard(hex)}
        >
          COPY
        </Button>
      </div>
      <div className="px-1">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-sm text-gray-900 group-hover:text-teal-600 transition-colors">
            {name}
          </span>
          <code className="text-[10px] font-mono font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-100">
            {hex}
          </code>
        </div>
        <p className="text-[11px] text-gray-500 leading-normal">{description}</p>
      </div>
    </div>
  );
}

function TypeSample({ label, specs, classes }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-10 py-8 md:py-12 px-8 md:px-12 items-baseline hover:bg-gray-50/50 transition-colors">
      <div className="col-span-1">
        <p className="text-[11px] font-black text-teal-600 uppercase tracking-[0.2em] mb-2 font-mono">
          {label}
        </p>
        <p className="text-[10px] text-gray-400 font-mono tracking-tighter uppercase">{specs}</p>
      </div>
      <div className="md:col-span-3">
        <p className={`${classes} text-gray-900 leading-tight md:leading-snug`}>
          A cohesive visual language for excellence in Islamic Education.
        </p>
      </div>
    </div>
  );
}
