"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Save, Upload } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { toast } from "sonner";
import Image from "next/image";
import HijriDatePicker from "@/components/HijriDatePicker";
import { useRouter } from "next/navigation";
import useAuthStore from "@/lib/authStore";

const INITIAL_STATE = {
  marquee: [
    { text: "New Face of DKJU: Live Update Processing is underway. The updated portal will be live in 2 days. Thank you for your patience." },
    { text: "New Face of DKJU ലൈവ് അപ്ഡേഷൻ പ്രൊസസ്സിങ് നടന്നുകൊണ്ടിരിക്കുകയാണ്. പുതിയ മാറ്റങ്ങളോടെ വെബ്സൈറ്റ് 2 ദിവസത്തിനകം ലഭ്യമാകും." },
  ],
  carousel: [
    { image: "/buildings/three.jpg", title: "DKJU Building 1" },
    { image: "/buildings/five.jpg", title: "DKJU Building 2" },
    { image: "/buildings/seven.jpg", title: "DKJU Building 3" },
  ],
  gallery: [
    { image: "/buildings/three.jpg", title: "DKJU Building 1" },
    { image: "/buildings/five.jpg", title: "DKJU Building 2" },
    { image: "/buildings/seven.jpg", title: "DKJU Building 3" },
  ],
  news: [
    { month: "May", startDate: "2023-05-01", endDate: "2023-05-31", title: "Test content random text describing the latest news update 1.", createdAt: "2023-05-01" },
    { month: "May", startDate: "2023-05-01", endDate: "2023-05-31", title: "Test content random text describing the latest news update 2.", createdAt: "2023-05-01" },
    { month: "April", startDate: "2023-04-01", endDate: "2023-04-30", title: "Test content random text describing the latest news update 3.", createdAt: "2023-04-01" },
    { month: "April", startDate: "2023-04-01", endDate: "2023-04-30", title: "Test content random text describing the latest news update 4.", createdAt: "2023-04-01" },
  ],
  quotes: [
    { name: "Jasim", specialized:"He is mandan" ,quotes: "Test content random text describing the latest news update 1." },
    { name: "Jasim", specialized:"He is mandan" ,quotes: "Test content random text describing the latest news update 1." },
    { name: "Jasim", specialized:"He is mandan" ,quotes: "Test content random text describing the latest news update 1." },
    { name: "Jasim", specialized:"He is mandan" ,quotes: "Test content random text describing the latest news update 1." },
  ],
  dkjunews: [
    { month: "May", startDate: "2023-05-01", endDate: "2023-05-31", title: "Test content random text describing the latest news update 1.", createdAt: "2023-05-01" },
    { month: "May", startDate: "2023-05-01", endDate: "2023-05-31", title: "Test content random text describing the latest news update 2.", createdAt: "2023-05-01" },
    { month: "April", startDate: "2023-04-01", endDate: "2023-04-30", title: "Test content random text describing the latest news update 3.", createdAt: "2023-04-01" },
    { month: "April", startDate: "2023-04-01", endDate: "2023-04-30", title: "Test content random text describing the latest news update 4.", createdAt: "2023-04-01" },
  ],
  events: [
    {
      title: "Annual Madrasa Conference",
      date: "15 June 2026",
      location: "Jonakappuram",
      description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
      image: "/buildings/eight.jpg",
    },
  ],
  aboutUs: {
    image: "/images/about.png",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    vision: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    mission: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
  },
  featuredNews: {
    image: "/buildings/five.jpg",
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    link: "#"
  },
};

function HomeControlContent() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "carousel";

  const [config, setConfig] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { user, userData, loading: authLoading } = useAuthStore();

  // Friday Quthba state
  const [quthbaEntries, setQuthbaEntries] = useState([]);
  const [quthbaSaving, setQuthbaSaving] = useState(false);

  // Madrasa Holidays state
  const [holidayEntries, setHolidayEntries] = useState([]);
  const [holidaySaving, setHolidaySaving] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, "homepageConfig", "main");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Merge existing data with INITIAL_STATE fallback for missing fields
          setConfig({ ...INITIAL_STATE, ...data });
        }
      } catch (error) {
        console.error("Error fetching config:", error);
        toast.error("Failed to load homepage configuration");
      } finally {
        setLoading(false);
      }
    };

    const fetchQuthba = async () => {
      try {
        const snap = await getDoc(doc(db, "homepageConfig", "friday_quthba"));
        if (snap.exists()) {
          const data = snap.data();
          if (data.entries && Array.isArray(data.entries)) {
            setQuthbaEntries(data.entries);
          } else if (data.message || data.fileUrl) {
            setQuthbaEntries([{
              id: Date.now().toString(),
              date: new Date().toISOString().split("T")[0],
              message: data.message || "",
              fileUrl: data.fileUrl || "",
              fileType: data.fileType || ""
            }]);
          }
        }
      } catch (error) {
        console.error("Error fetching friday quthba:", error);
      }
    };

    const fetchHolidays = async () => {
      try {
        const snap = await getDoc(doc(db, "homepageConfig", "madrasa_holidays"));
        if (snap.exists() && snap.data().holidays) {
          setHolidayEntries(snap.data().holidays);
        }
      } catch (error) {
        console.error("Error fetching madrasa holidays:", error);
      }
    };

    fetchConfig();
    fetchQuthba();
    fetchHolidays();
  }, []);

  const handleQuthbaSave = async () => {
    setQuthbaSaving(true);
    try {
      const payload = {
        entries: quthbaEntries,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "homepageConfig", "friday_quthba"), payload, { merge: true });
      toast.success("Friday Quthba history saved successfully");
    } catch (error) {
      console.error("Error saving friday quthba:", error);
      toast.error("Failed to save Friday Quthba");
    } finally {
      setQuthbaSaving(false);
    }
  };

  const handleHolidaysSave = async () => {
    // Validate inputs
    const isValid = holidayEntries.every(h => h.title.trim() && h.date);
    if (!isValid) {
      toast.error("Please fill all titles and dates before saving.");
      return;
    }
    setHolidaySaving(true);
    try {
      await setDoc(doc(db, "homepageConfig", "madrasa_holidays"), {
        holidays: holidayEntries,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast.success("Madrasa Holidays saved successfully");
    } catch (error) {
      console.error("Error saving madrasa holidays:", error);
      toast.error("Failed to save Madrasa Holidays");
    } finally {
      setHolidaySaving(false);
    }
  };

  const handleQuthbaUpload = async (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info("Uploading document...");
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      const fileType = ext === "pdf" ? "pdf" : ext === "pptx" || ext === "ppt" ? "ppt" : "doc";
      const fileRef = ref(storage, `friday_quthba/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      const newEntries = [...quthbaEntries];
      newEntries[index] = { ...newEntries[index], fileUrl: url, fileType };
      setQuthbaEntries(newEntries);
      toast.success("Document uploaded successfully");
    } catch (error) {
      console.error("Error uploading document:", error);
      toast.error("Failed to upload document");
    }
  };

  const addQuthbaEntry = () => {
    setQuthbaEntries([{ id: Date.now().toString(), date: new Date().toISOString().split("T")[0], message: "", fileUrl: "", fileType: "" }, ...quthbaEntries]);
  };

  const removeQuthbaEntry = (index) => {
    if (!confirm("Are you sure you want to remove this entry?")) return;
    const newEntries = [...quthbaEntries];
    newEntries.splice(index, 1);
    setQuthbaEntries(newEntries);
  };

  const updateQuthbaEntry = (index, field, value) => {
    const newEntries = [...quthbaEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setQuthbaEntries(newEntries);
  };

  const addHolidayEntry = () => {
    setHolidayEntries([{ id: Date.now().toString(), title: "", date: "" }, ...holidayEntries]);
  };

  const removeHolidayEntry = async (index) => {
    if (!confirm("Are you sure you want to remove this holiday?")) return;
    const newEntries = [...holidayEntries];
    newEntries.splice(index, 1);
    setHolidayEntries(newEntries);
    
    // Automatically save upon deletion
    try {
      setHolidaySaving(true);
      await setDoc(doc(db, "homepageConfig", "madrasa_holidays"), {
        holidays: newEntries,
      }, { merge: true });
      toast.success("Holiday removed successfully");
    } catch (error) {
      console.error("Error removing holiday:", error);
      toast.error("Failed to remove holiday");
    } finally {
      setHolidaySaving(false);
    }
  };

  const updateHolidayEntry = async (index, field, value) => {
    const newEntries = [...holidayEntries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    
    // Auto-fetch Hijri date when Gregorian date changes
    if (field === "date" && value) {
       const [year, month, day] = value.split("-");
       try {
         const res = await fetch(`https://api.aladhan.com/v1/gToH?date=${day}-${month}-${year}`);
         const data = await res.json();
         if (data && data.data && data.data.hijri) {
           newEntries[index].hijriDate = `${data.data.hijri.day} ${data.data.hijri.month.en} ${data.data.hijri.year}`;
         }
       } catch (err) {
         console.error("Hijri conversion failed", err);
       }
    }
    
    setHolidayEntries(newEntries);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "homepageConfig", "main"), config);
      toast.success("Homepage configuration saved successfully");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Failed to save homepage configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e, section, index = null, isMobile = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check dimensions
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      let expectedW = 0, expectedH = 0;
      if (section === "carousel") {
        if (isMobile) { expectedW = 720; expectedH = 1080; }
        else { expectedW = 1920; expectedH = 1080; }
      } else if (section === "aboutUs") {
        expectedW = 800; expectedH = 1000;
      } else if (section === "events" || section === "featuredNews") {
        expectedW = 800; expectedH = 600;
      }

      if (expectedW && (img.width !== expectedW || img.height !== expectedH)) {
        toast.warning(`Note: Uploaded image resolution (${img.width}x${img.height}) does not match the recommended size (${expectedW}x${expectedH}). The system will proceed.`, { duration: 5000 });
      }
    };

    toast.info("Uploading image...");
    try {
      const fileRef = ref(storage, `homepage/${section}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      if (index !== null) {
        const newItems = [...config[section]];
        if (isMobile) {
          newItems[index] = { ...newItems[index], mobileImage: url };
        } else {
          newItems[index] = { ...newItems[index], image: url };
        }
        setConfig({ ...config, [section]: newItems });
      } else {
        setConfig({ ...config, [section]: { ...config[section], image: url } });
      }
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    }
  };

  const addItem = (section, defaultItem) => {
    const newItem = {
    ...defaultItem,

    // Automatically generate created date only for news
    ...(section === "news" && {
      createdAt: new Date().toISOString().split("T")[0],
    }),
  };
    setConfig({ ...config, [section]: [...config[section], newItem] });
  };

  const removeItem = (section, index) => {
    const newItems = [...config[section]];
    newItems.splice(index, 1);
    setConfig({ ...config, [section]: newItems });
  };

  const updateItem = (section, index, field, value) => {
    const newItems = [...config[section]];
    newItems[index] = { ...newItems[index], [field]: value };
    setConfig({ ...config, [section]: newItems });
  };

  return (
    <ProtectedRoute allowedRoles={["home_admin", "central_admin"]} redirectTo="/home-control/login">
      <Layout>
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading configuration...</div>
        ) : (
          <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Homepage Control</h1>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <Tabs value={currentTab} className="w-full">
          <div className="flex-1 w-full min-w-0">
            <TabsContent value="carousel" className="mt-0 space-y-4">
              {config.carousel.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-4 flex gap-4 items-start">
                  <div className="w-32 h-24 relative bg-gray-100 rounded border flex items-center justify-center overflow-hidden">
                    {item.image ? (
                      <Image src={item.image} alt={item.title || "Image"} fill className="object-cover" />
                    ) : (
                      <span className="text-xs text-gray-400">No Image</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Title/Alt Text</Label>
                    <Input 
                      value={item.title || ""} 
                      onChange={(e) => updateItem("carousel", index, "title", e.target.value)} 
                      placeholder="e.g. DKJU Headquarters"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Label htmlFor={`carousel-upload-${index}`} className="cursor-pointer">
                        <div className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200">
                          <Upload className="h-4 w-4" /> Change Desktop Image
                        </div>
                      </Label>
                      <input 
                        id={`carousel-upload-${index}`} 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, "carousel", index, false)}
                      />
                      <Label htmlFor={`carousel-mobile-upload-${index}`} className="cursor-pointer">
                        <div className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200">
                          <Upload className="h-4 w-4" /> Change Mobile Image
                        </div>
                      </Label>
                      <input 
                        id={`carousel-mobile-upload-${index}`} 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, "carousel", index, true)}
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeItem("carousel", index)} className="text-red-500 ml-auto">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Recommended: 1920x1080 (Desktop), 720x1080 (Mobile)</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={() => addItem("carousel", { image: "", title: "" })} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Carousel Item
            </Button>
            </TabsContent>

            <TabsContent value="marquee" className="mt-0 space-y-4">
              {config.marquee.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input 
                  value={item.text} 
                  onChange={(e) => updateItem("marquee", index, "text", e.target.value)}
                  placeholder="Announcement text..."
                />
                <Button variant="outline" onClick={() => removeItem("marquee", index)} className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={() => addItem("marquee", { text: "" })} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Announcement
            </Button>
            </TabsContent>

            <TabsContent value="news" className="mt-0 space-y-4">
              <Card className="mb-6 border-blue-200 shadow-sm">
                <CardHeader className="bg-blue-50/50 pb-4">
                  <CardTitle className="text-lg text-blue-900">Image & Text</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="w-full md:w-64 space-y-2">
                      <Label>Events Image</Label>
                      <div className="h-40 relative bg-gray-100 rounded border border-gray-200 overflow-hidden flex items-center justify-center">
                        {config.featuredNews?.image ? (
                          <img src={config.featuredNews.image} alt="Featured News" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm text-gray-400">No Image</span>
                        )}
                      </div>
                      <div className="pt-2">
                        <Label htmlFor="featured-image-upload" className="cursor-pointer inline-flex w-full justify-center items-center gap-2 text-sm bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors">
                          <Upload className="h-4 w-4" /> Upload Image
                        </Label>
                        <input 
                          id="featured-image-upload" 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, "featuredNews")}
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-4 w-full">
                      <div className="space-y-2">
                        <Label>Featured Text</Label>
                        <Textarea 
                          value={config.featuredNews?.text || ""} 
                          onChange={(e) => setConfig({ ...config, featuredNews: { ...config.featuredNews, text: e.target.value } })}
                          placeholder="Main featured news text..."
                          rows={4}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Read More Link</Label>
                        <Input 
                          value={config.featuredNews?.link || ""} 
                          onChange={(e) => setConfig({ ...config, featuredNews: { ...config.featuredNews, link: e.target.value } })}
                          placeholder="e.g. /news/123 or https://..."
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <h3 className="font-semibold text-lg mt-8 mb-4">Latest Government Updates</h3>
              {config.news.map((item, index) => (
  <Card key={index}>
    <CardContent className="p-4 flex gap-4 items-end">

      {/* News Month / Label */}
      <div className="w-32 space-y-2">
        <Label>News Title</Label>
        <Input
          value={item.month || ""}
          onChange={(e) =>
            updateItem(
              "news",
              index,
              "month",
              e.target.value
            )
          }
          placeholder="e.g. May"
        />
      </div>

      {/* Starting Date */}
      <div className="w-40 space-y-2">
        <Label>Starting Date</Label>
        <Input
          type="date"
          value={item.startDate || ""}
          onChange={(e) =>
            updateItem(
              "news",
              index,
              "startDate",
              e.target.value
            )
          }
        />
      </div>

      {/* Closing Date */}
      <div className="w-40 space-y-2">
        <Label>Closing Date</Label>
        <Input
          type="date"
          value={item.endDate || ""}
          onChange={(e) =>
            updateItem(
              "news",
              index,
              "endDate",
              e.target.value
            )
          }
        />
      </div>

      {/* News Description */}
      <div className="flex-1 space-y-2">
        <Label>News Description</Label>
        <Textarea
          value={item.title || ""}
          onChange={(e) =>
            updateItem(
              "news",
              index,
              "title",
              e.target.value
            )
          }
          placeholder="News description..."
          rows={2}
        />
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        onClick={() => removeItem("news", index)}
        className="text-red-500 self-center"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

    </CardContent>
  </Card>
))}
            <Button variant="outline" onClick={() => addItem("news", { month: "", startDate: "", endDate: "",title: "" })} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add News Item
            </Button>
              
              
              <h3 className="font-semibold text-lg mt-8 mb-4">Latest DKJU Updates</h3>
              {config.dkjunews.map((item, index) => (
  <Card key={index}>
    <CardContent className="p-4 flex gap-4 items-end">

      {/* News Month / Label */}
      <div className="w-32 space-y-2">
        <Label>News Title</Label>
        <Input
          value={item.month || ""}
          onChange={(e) =>
            updateItem(
              "dkjunews",
              index,
              "month",
              e.target.value
            )
          }
          placeholder="e.g. May"
        />
      </div>

      {/* Starting Date */}
      <div className="w-40 space-y-2">
        <Label>Starting Date</Label>
        <Input
          type="date"
          value={item.startDate || ""}
          onChange={(e) =>
            updateItem(
              "dkjunews",
              index,
              "startDate",
              e.target.value
            )
          }
        />
      </div>

      {/* Closing Date */}
      <div className="w-40 space-y-2">
        <Label>Closing Date</Label>
        <Input
          type="date"
          value={item.endDate || ""}
          onChange={(e) =>
            updateItem(
              "dkjunews",
              index,
              "endDate",
              e.target.value
            )
          }
        />
      </div>

      {/* News Description */}
      <div className="flex-1 space-y-2">
        <Label>News Description</Label>
        <Textarea
          value={item.title || ""}
          onChange={(e) =>
            updateItem(
              "dkjunews",
              index,
              "title",
              e.target.value
            )
          }
          placeholder="News description..."
          rows={2}
        />
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        onClick={() => removeItem("dkjunews", index)}
        className="text-red-500 self-center"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

    </CardContent>
  </Card>
))}
            <Button variant="outline" onClick={() => addItem("dkjunews", { month: "", startDate: "", endDate: "",title: "" })} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add News Item
            </Button>
              
              <h3 className="font-semibold text-lg mt-8 mb-4">Quotes List</h3>
              {config.quotes.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-4 flex gap-4">
                  <div className="w-32 space-y-2">
                    <Label>Quote's Name</Label>
                    <Input 
                      value={item.name} 
                      onChange={(e) => updateItem("quotes", index, "name", e.target.value)}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Specialized</Label>
                    <Textarea 
                      value={item.specialized} 
                      onChange={(e) => updateItem("quotes", index, "specialized", e.target.value)}
                      placeholder="Specialized description..."
                      rows={2}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Quotes</Label>
                    <Textarea 
                      value={item.quotes} 
                      onChange={(e) => updateItem("quotes", index, "quotes", e.target.value)}
                      placeholder="Quote..."
                      rows={2}
                    />
                  </div>
                  <Button variant="ghost" onClick={() => removeItem("quotes", index)} className="text-red-500 self-center">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={() => addItem("quotes", { name: "", specialized: "", quotes: "" })} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Quote Item
            </Button>
            </TabsContent>

            <TabsContent value="events" className="mt-0 space-y-4">
              {config.events.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4 md:col-span-2 flex gap-4 items-start border-b pb-4">
                    <div className="w-32 h-24 relative bg-gray-100 rounded border flex items-center justify-center overflow-hidden">
                      {item.image ? (
                        <Image src={item.image} alt={item.title || "Image"} fill className="object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400">No Image</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <Label>Event Image</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Label htmlFor={`event-upload-${index}`} className="cursor-pointer">
                          <div className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200">
                            <Upload className="h-4 w-4" /> Upload
                          </div>
                        </Label>
                        <input 
                          id={`event-upload-${index}`} 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, "events", index)}
                        />
                      </div>
                    </div>
                    <Button variant="ghost" onClick={() => removeItem("events", index)} className="text-red-500">
                      <Trash2 className="h-4 w-4" /> Remove Event
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Event Title</Label>
                    <Input 
                      value={item.title} 
                      onChange={(e) => updateItem("events", index, "title", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input 
                      value={item.date} 
                      onChange={(e) => updateItem("events", index, "date", e.target.value)}
                      placeholder="e.g. 15 June 2026"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input 
                      value={item.location} 
                      onChange={(e) => updateItem("events", index, "location", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Description</Label>
                    <Textarea 
                      value={item.description} 
                      onChange={(e) => updateItem("events", index, "description", e.target.value)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={() => addItem("events", { title: "", date: "", location: "", description: "", image: "" })} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Event
            </Button>
            <h3 className="font-semibold text-lg mt-8 mb-4">Past Event Highlights</h3>
            {config.gallery.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-4 flex gap-4 items-start">
                  <div className="w-32 h-24 relative bg-gray-100 rounded border flex items-center justify-center overflow-hidden">
                    {item.image ? (
                      <Image src={item.image} alt="Image" fill className="object-cover" />
                    ) : (
                      <span className="text-xs text-gray-400">No Image</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Title/Alt Text</Label>
                    <Input 
                      value={item.title || ""} 
                      onChange={(e) => updateItem("gallery", index, "title", e.target.value)} 
                      placeholder="e.g. DKJU Headquarters"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Label htmlFor={`gallery-upload-${index}`} className="cursor-pointer">
                        <div className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200">
                          <Upload className="h-4 w-4" /> Change Desktop Image
                        </div>
                      </Label>
                      <input 
                        id={`gallery-upload-${index}`} 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, "gallery", index, false)}
                      />
                      <Label htmlFor={`gallery-mobile-upload-${index}`} className="cursor-pointer">
                        <div className="flex items-center gap-2 text-sm bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200">
                          <Upload className="h-4 w-4" /> Change Mobile Image
                        </div>
                      </Label>
                      <input 
                        id={`gallery-mobile-upload-${index}`} 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleImageUpload(e, "gallery", index, true)}
                      />
                      <Button variant="ghost" size="sm" onClick={() => removeItem("gallery", index)} className="text-red-500 ml-auto">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">Recommended: 1920x1080 (Desktop), 720x1080 (Mobile)</p>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={() => addItem("gallery", { image: "", title: "" })} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Gallery Item
            </Button>
            </TabsContent>

            <TabsContent value="friday-quthba" className="mt-0 space-y-4">
              <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Friday Quthba History</h2>
              <Button onClick={handleQuthbaSave} disabled={quthbaSaving} className="bg-green-600 hover:bg-green-700">
                <Save className="h-4 w-4 mr-2" />
                {quthbaSaving ? "Saving..." : "Save History"}
              </Button>
            </div>
            {quthbaEntries.map((item, index) => (
              <Card key={item.id || index}>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                  <div className="w-full md:w-1/4 space-y-2">
                    <Label>Date</Label>
                    <Input 
                      type="date"
                      value={item.date || ""} 
                      onChange={(e) => updateQuthbaEntry(index, "date", e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Message / Notes</Label>
                    <Textarea 
                      value={item.message || ""} 
                      onChange={(e) => updateQuthbaEntry(index, "message", e.target.value)}
                      placeholder="Enter the Friday Quthba message..."
                      rows={3}
                    />
                    <div className="pt-2">
                      <Label>Attached Document</Label>
                      {item.fileUrl ? (
                        <div className="flex items-center gap-2 mt-1">
                          <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline">
                            View Document
                          </a>
                          <Button variant="ghost" size="sm" onClick={() => updateQuthbaEntry(index, "fileUrl", "")} className="text-red-500 h-6 px-2">
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-1">
                          <Label htmlFor={`quthba-upload-${index}`} className="cursor-pointer inline-flex items-center gap-2 text-sm bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200">
                            <Upload className="h-4 w-4" /> Upload Document
                          </Label>
                          <input 
                            id={`quthba-upload-${index}`} 
                            type="file" 
                            accept=".pdf,.doc,.docx,.ppt,.pptx" 
                            className="hidden" 
                            onChange={(e) => handleQuthbaUpload(e, index)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => removeQuthbaEntry(index)} className="text-red-500 self-start">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={addQuthbaEntry} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add New Friday Quthba
            </Button>
            </TabsContent>

            <TabsContent value="about" className="mt-0 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>About Us Section</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label>About Us Image</Label>
                    <div className="flex gap-6 items-start">
                      <div className="w-64 h-auto relative bg-gray-100 rounded border border-gray-200 shadow-sm overflow-hidden flex items-center justify-center">
                        {config.aboutUs?.image ? (
                          <img src={config.aboutUs.image} alt="About Us" className="w-full h-auto object-cover" />
                        ) : (
                          <div className="py-12 text-sm text-gray-400">No Image</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="about-image-upload" className="cursor-pointer inline-flex items-center gap-2 text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-100 font-medium transition-colors">
                          <Upload className="h-4 w-4" /> Change Image
                        </Label>
                        <input 
                          id="about-image-upload" 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, "aboutUs")}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Upload a high-quality vertical or portrait image. Recommended aspect ratio is approx 3:4. The image will be displayed on the main landing page.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>About Us Text</Label>
                      <Textarea 
                        value={config.aboutUs?.text || ""} 
                        onChange={(e) => setConfig({ ...config, aboutUs: { ...config.aboutUs, text: e.target.value } })}
                        placeholder="Main about us description..."
                        rows={5}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Our Vision</Label>
                      <Textarea 
                        value={config.aboutUs?.vision || ""} 
                        onChange={(e) => setConfig({ ...config, aboutUs: { ...config.aboutUs, vision: e.target.value } })}
                        placeholder="Vision text..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Our Mission</Label>
                      <Textarea 
                        value={config.aboutUs?.mission || ""} 
                        onChange={(e) => setConfig({ ...config, aboutUs: { ...config.aboutUs, mission: e.target.value } })}
                        placeholder="Mission text..."
                        rows={3}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="madrasa-holidays" className="mt-0 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-800">Madrasa Holidays Management</h2>
                <Button onClick={handleHolidaysSave} disabled={holidaySaving} className="bg-green-600 hover:bg-green-700">
                  <Save className="h-4 w-4 mr-2" />
                  {holidaySaving ? "Saving..." : "Save Holidays"}
                </Button>
              </div>
              {holidayEntries.map((item, index) => (
                <Card key={item.id || index}>
                  <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                    <div className="space-y-2">
                      <Label>Holiday Title <span className="text-red-500">*</span></Label>
                      <Input
                        value={item.title || ""}
                        onChange={(e) => updateHolidayEntry(index, "title", e.target.value)}
                        placeholder="e.g. Ramadan Begins"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date <span className="text-red-500">*</span></Label>
                      <HijriDatePicker
                        value={item.date || ""}
                        minDate={new Date().toISOString().split("T")[0]}
                        onSelect={(dateStr, hijriStr) => {
                          updateHolidayEntry(index, "date", dateStr);
                        }}
                      />
                      {item.date && (
                        <p className="text-sm text-gray-500 font-medium">Gregorian Date: {new Date(item.date).toLocaleDateString("en-IN", { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Message</Label>
                      <Textarea
                        value={item.message || ""}
                        onChange={(e) => updateHolidayEntry(index, "message", e.target.value)}
                        placeholder="Additional details about the holiday..."
                        rows={2}
                      />
                    </div>
                    <Button variant="ghost" onClick={() => removeHolidayEntry(index)} className="text-red-500 justify-self-start">
                      <Trash2 className="h-4 w-4 mr-2" /> Remove
                    </Button>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addHolidayEntry} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Add New Holiday
              </Button>
            </TabsContent>
           
          </div>
        </Tabs>
      </div>
      )}
      </Layout>
</ProtectedRoute>
  );
}

export default function HomeControlPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-gray-500">Loading...</div>}>
      <HomeControlContent />
    </Suspense>
  );
}
