"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, AlertCircle, CheckCircle2, Wrench, RefreshCw } from "lucide-react";
import { collection, getDocs, doc, updateDoc, query, where, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import useAuthStore from "@/lib/authStore";

export default function FixEmailsPage() {
  const { user, userData } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [invalidStudents, setInvalidStudents] = useState([]);
  const [fixedCount, setFixedCount] = useState(0);
  const [selectedStudents, setSelectedStudents] = useState([]);

  // Email generation logic from applications page
  const generateStudentEmail = (fullName, phone) => {
    const namePart = fullName
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(" ")
      .slice(0, 2)
      .join(".");
    const phonePart = phone
      ? phone.slice(-4)
      : Math.floor(1000 + Math.random() * 9000);
    return `${namePart}.${phonePart}@dkju.in`;
  };

  // Helper to clean Madarsa ID
  const getCleanMadarsaId = (id) => {
    if (!id) return "";
    return String(id).replace(/^mid-/, '');
  };

  // Check if email is invalid
  const isInvalidEmail = (email) => {
    if (!email) return true;
    // Check if email is exactly "@dkju.in" or doesn't contain "@dkju.in"
    if (email === "@dkju.in") return true;
    if (!email.includes("@dkju.in")) return true;
    // Check if there's content before @dkju.in
    const beforeAt = email.split("@")[0];
    if (!beforeAt || beforeAt.trim() === "") return true;
    return false;
  };

  // Fetch students with invalid emails
  const fetchInvalidStudents = async () => {
    setLoading(true);
    try {
      const studentsRef = collection(db, "students");
      const snapshot = await getDocs(studentsRef);
      
      // Fetch admission counters
      const countersRef = doc(db, "counters", "admissionNumbers");
      const countersSnap = await getDoc(countersRef);
      const admissionCounters = countersSnap.exists() ? countersSnap.data() : {};

      const invalid = [];
      const madarsaSequences = {}; // madarsaId -> maxSequence

      // Initialize sequences from admission counters
      Object.keys(admissionCounters).forEach(key => {
        if (key.startsWith('mid-')) {
          const madarsaId = key.replace('mid-', '');
          madarsaSequences[madarsaId] = admissionCounters[key];
        }
      });

      // First pass: Find max sequences for each madarsa from existing emails (in case they are higher than counter)
      snapshot.forEach((doc) => {
        const data = doc.data();
        const madarsaId = getCleanMadarsaId(data.madarsaId);
        const email = data.email;

        if (madarsaId && email) {
           // Check if email matches pattern: madarsaId-sequence@dkju.in
           // Allow optional mid- prefix in existing emails just in case
           const match = email.match(/^(?:mid-)?(\d+)-(\d+)@dkju\.in$/);
           if (match) {
             const emailMadarsaId = match[1];
             const sequence = parseInt(match[2], 10);
             
             // Ensure we are tracking sequence for the correct madarsa
             if (String(emailMadarsaId) === String(madarsaId)) {
                const currentMax = madarsaSequences[madarsaId] || 0;
                if (sequence > currentMax) {
                  madarsaSequences[madarsaId] = sequence;
                }
             }
           }
        }
      });

      // Second pass: Identify invalid students and assign new emails
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.deleted && isInvalidEmail(data.email)) {
          let suggestedEmail = "";
          
          if (data.madarsaId) {
             const cleanMid = getCleanMadarsaId(data.madarsaId);
             const currentSeq = madarsaSequences[cleanMid] || 0;
             const nextSeq = currentSeq + 1;
             madarsaSequences[cleanMid] = nextSeq; // Increment for next one
             
             const paddedSeq = String(nextSeq).padStart(6, '0');
             suggestedEmail = `${cleanMid}-${paddedSeq}@dkju.in`;
          } else {
             // Fallback to old method if no madarsaId
             suggestedEmail = generateStudentEmail(data.fullName || "", data.phone || "");
          }

          invalid.push({
            id: doc.id,
            ...data,
            suggestedEmail,
          });
        }
      });

      setInvalidStudents(invalid);
      toast.info(`Found ${invalid.length} students with invalid emails`);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to fetch students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvalidStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fix single student email
  const fixStudentEmail = async (student, overrideEmail = null) => {
    try {
      let emailToUse = overrideEmail || student.suggestedEmail;
      let retryCount = 0;
      const maxRetries = 10; // Prevent infinite loop

      // Check if email is taken and retry if needed
      while (retryCount < maxRetries) {
        const q = query(collection(db, "students"), where("email", "==", emailToUse));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          break; // Email is free
        }
        
        // Email is taken, generate next one
        const match = emailToUse.match(/^(?:mid-)?(\d+)-(\d+)@dkju\.in$/);
        if (match) {
           const madarsaId = match[1];
           const currentSeq = parseInt(match[2], 10);
           const nextSeq = currentSeq + 1;
           const paddedSeq = String(nextSeq).padStart(6, '0');
           emailToUse = `${madarsaId}-${paddedSeq}@dkju.in`;
           retryCount++;
           // toast.info(`Email ${match[0]} taken, trying ${emailToUse}`);
        } else {
           // If it doesn't match pattern (e.g. fallback email), maybe append random?
           // Or just fail.
           toast.error(`Email ${emailToUse} is taken and cannot auto-increment.`);
           return { success: false };
        }
      }

      if (retryCount >= maxRetries) {
        toast.error(`Failed to find unique email for ${student.fullName} after ${maxRetries} attempts`);
        return { success: false };
      }

      const studentRef = doc(db, "students", student.id);
      await updateDoc(studentRef, {
        email: emailToUse,
        emailFixedAt: new Date().toISOString(),
        emailFixedBy: user?.uid || "admin",
      });

      // Update the counter in Firestore if it was a madarsa email
      const match = emailToUse.match(/^(?:mid-)?(\d+)-(\d+)@dkju\.in$/);
      if (match) {
        const madarsaId = match[1];
        const sequence = parseInt(match[2], 10);
        const countersRef = doc(db, "counters", "admissionNumbers");
        
        // We only update if the new sequence is higher than what's stored
        // But since we are fixing emails, we should probably just ensure the counter reflects this new high
        try {
          const countersSnap = await getDoc(countersRef);
          if (countersSnap.exists()) {
            const currentCount = countersSnap.data()[`mid-${madarsaId}`] || 0;
            if (sequence > currentCount) {
               await updateDoc(countersRef, {
                 [`mid-${madarsaId}`]: sequence
               });
            }
          } else {
             await setDoc(countersRef, {
               [`mid-${madarsaId}`]: sequence
             }, { merge: true });
          }
        } catch (err) {
          console.error("Failed to update counter:", err);
          // Don't fail the whole operation if counter update fails, but log it
        }
      }
      
      toast.success(`Fixed email for ${student.fullName} (${emailToUse})`);
      return { success: true, email: emailToUse };
    } catch (error) {
      console.error("Error fixing email:", error);
      toast.error(`Failed to fix email for ${student.fullName}`);
      return { success: false };
    }
  };

  // Fix all invalid emails
  const fixAllEmails = async () => {
    setFixing(true);
    setFixedCount(0);
    
    try {
      let successCount = 0;
      const studentsToFix = selectedStudents.length > 0 
        ? invalidStudents.filter(s => selectedStudents.includes(s.id))
        : invalidStudents;

      const madarsaNextSequence = {}; // mid -> nextSeq

      for (const student of studentsToFix) {
        let emailToFix = student.suggestedEmail;
        
        // Optimization: If we already bumped the sequence for this madarsa, use the next one
        if (student.madarsaId) {
            const cleanMid = getCleanMadarsaId(student.madarsaId);
            if (madarsaNextSequence[cleanMid]) {
                const nextSeq = madarsaNextSequence[cleanMid];
                const paddedSeq = String(nextSeq).padStart(6, '0');
                emailToFix = `${cleanMid}-${paddedSeq}@dkju.in`;
            }
        }

        const result = await fixStudentEmail(student, emailToFix);
        if (result.success) {
          successCount++;
          setFixedCount(successCount);

          // Update sequence tracker
          if (result.email) {
            const match = result.email.match(/^(?:mid-)?(\d+)-(\d+)@dkju\.in$/);
            if (match) {
                const mid = match[1];
                const seq = parseInt(match[2], 10);
                madarsaNextSequence[mid] = seq + 1;
            }
          }
        }
        // Small delay to avoid overwhelming Firestore
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast.success(`Successfully fixed ${successCount} student emails!`);
      
      // Refresh the list
      await fetchInvalidStudents();
      setSelectedStudents([]);
    } catch (error) {
      console.error("Error fixing emails:", error);
      toast.error("Failed to fix all emails");
    } finally {
      setFixing(false);
    }
  };

  // Toggle student selection
  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Select all students
  const selectAll = () => {
    if (selectedStudents.length === invalidStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(invalidStudents.map(s => s.id));
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Fix Student Emails
            </h1>
            <p className="text-gray-600 mt-1">
              Find and fix students with invalid or incomplete email addresses
            </p>
          </div>
          <Button
            onClick={fetchInvalidStudents}
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Invalid Emails Found
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">
                {loading ? <Skeleton className="h-9 w-16" /> : invalidStudents.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Selected to Fix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {selectedStudents.length || invalidStudents.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Fixed This Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {fixedCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This tool finds students with invalid emails and generates correct emails based on their Madarsa ID and a sequential number: 
            <code className="mx-1 px-2 py-1 bg-gray-100 rounded text-sm">MadarsaID-Sequence@dkju.in</code>
          </AlertDescription>
        </Alert>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>Students with Invalid Emails</CardTitle>
                <CardDescription>
                  {invalidStudents.length === 0 && !loading
                    ? "All student emails are valid!"
                    : "Review and fix invalid email addresses"}
                </CardDescription>
              </div>
              {invalidStudents.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={selectAll}
                    variant="outline"
                    size="sm"
                  >
                    {selectedStudents.length === invalidStudents.length ? "Deselect All" : "Select All"}
                  </Button>
                  <Button
                    onClick={fixAllEmails}
                    disabled={fixing || invalidStudents.length === 0}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {fixing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Fixing {fixedCount}/{selectedStudents.length || invalidStudents.length}...
                      </>
                    ) : (
                      <>
                        <Wrench className="h-4 w-4 mr-2" />
                        Fix {selectedStudents.length > 0 ? `Selected (${selectedStudents.length})` : 'All'}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                ))}
              </div>
            ) : invalidStudents.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  All Emails Are Valid!
                </h3>
                <p className="text-gray-600">
                  No students found with invalid email addresses.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedStudents.length === invalidStudents.length}
                          onChange={selectAll}
                          className="rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Current Email</TableHead>
                      <TableHead>Suggested Email</TableHead>
                      <TableHead>Madrasa ID</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invalidStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {student.fullName || "N/A"}
                        </TableCell>
                        <TableCell>{student.phone || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="font-mono text-xs">
                            {student.email || "No Email"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs bg-green-50 text-green-700 border-green-300">
                            {student.suggestedEmail}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {student.madarsaId || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fixStudentEmail(student).then(result => {
                              if (result.success) {
                                setInvalidStudents(prev => prev.filter(s => s.id !== student.id));
                                setFixedCount(prev => prev + 1);
                              }
                            })}
                            disabled={fixing}
                          >
                            <Wrench className="h-3 w-3 mr-1" />
                            Fix
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900 flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Generation Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-800">
            <p>• <strong>Format:</strong> MadarsaID-Sequence@dkju.in</p>
            <p>• <strong>Madarsa ID:</strong> The unique ID of the student&apos;s madarsa</p>
            <p>• <strong>Sequence:</strong> A 6-digit sequential number (e.g., 000026) that increments based on the last existing email for that madarsa.</p>
            <p>• <strong>Example:</strong> Madarsa 1333, last email 1333-000025@dkju.in → New email: 1333-000026@dkju.in</p>
            <p>• <strong>Collision Handling:</strong> If a generated email already exists, the system will automatically try the next sequence number.</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
