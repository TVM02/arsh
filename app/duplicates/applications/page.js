"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  runTransaction
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import useAuthStore from '@/lib/authStore';

// Public page to find duplicate application IDs grouped by madarsaId
export default function DuplicateApplicationsPage() {
  const { user, userData } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [duplicatesByMadarsa, setDuplicatesByMadarsa] = useState({});
  const [filterMadarsa, setFilterMadarsa] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('single'); // 'single' | 'bulk'
  const [modalTarget, setModalTarget] = useState(null); // for single: { id, name, currentMadarsa }
  const [modalPreview, setModalPreview] = useState([]); // array of { id, previewMid, isUnique }
  const [modalLoading, setModalLoading] = useState(false);

  // Debugging: log auth state so we can see who is hitting this page
  useEffect(() => {
    console.log('DuplicateApplicationsPage auth state:', { user, userData });
  }, [user, userData]);

  useEffect(() => {
    // Only fetch when signed in as central admin
    console.log(userData)
    if (userData && userData.role === 'central_admin') {
      fetchDuplicates();
    }
  }, [userData]);

  const fetchDuplicates = useCallback(async () => {
    // Guard: ensure central admin
    if (!userData || userData.role !== 'central_admin') {
      toast.error('You must be a central admin to load duplicates');
      return;
    }

    setLoading(true);
    try {
  // Load all admissions (if collection is huge you may want to page)
  const appsQuery = query(collection(db, 'admissions'));
  const snap = await getDocs(appsQuery);

      // Map of composite key -> array of docs
      // We'll consider duplicate based on `applicationId` field. If your field name differs, change it here.
      const byMadarsa = {};

      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
  const madarsaId = data.madarsa || data.madarsaId || 'UNASSIGNED';
  const applicationId = data.admissionNumber || data.applicationId || null;

        console.log(madarsaId, applicationId)

        if (!applicationId) return; // skip if no id

        byMadarsa[madarsaId] = byMadarsa[madarsaId] || {};
        byMadarsa[madarsaId][applicationId] = byMadarsa[madarsaId][applicationId] || [];
        byMadarsa[madarsaId][applicationId].push({ id: docSnap.id, ...data });
      });

      // Filter to only duplicates (applicationId groups with length > 1)
      const dupFiltered = {};
      Object.entries(byMadarsa).forEach(([madarsaId, appsMap]) => {
        const dupGroups = [];
        Object.entries(appsMap).forEach(([applicationId, items]) => {
          if (items.length > 1) {
            dupGroups.push({ applicationId, items });
          }
        });

        if (dupGroups.length > 0) {
          dupFiltered[madarsaId] = dupGroups;
        }
      });

      setDuplicatesByMadarsa(dupFiltered);
    } catch (error) {
      console.error('Error fetching applications:', error);
      // Surface the firestore error message to help debug permissions
      toast.error('Failed to load applications: ' + (error?.message || error));
    } finally {
      setLoading(false);
    }
  }, [userData]);

  // Generate a new madarsa counter-based id (mid-<n>) via transaction and return it
  const generateNextMid = async () => {
    const counterRef = doc(db, 'counters', 'madarsaIds');
    try {
      const newMid = await runTransaction(db, async (t) => {
        const counterDoc = await t.get(counterRef);
        let next = 1001;
        if (counterDoc.exists()) {
          const current = counterDoc.data().current || 1000;
          next = current + 1;
        }
        t.set(counterRef, { current: next }, { merge: true });
        return `mid-${next}`;
      });
      return newMid;
    } catch (error) {
      console.error('Error generating next MID:', error);
      toast.error('Failed to generate MID: ' + (error?.message || error));
      throw error;
    }
  };

  // Preview next N mids without committing (reads counter doc). This is only a preview and does not reserve them.
  const previewNextMids = async (count = 1) => {
    const counterRef = doc(db, 'counters', 'madarsaIds');
    try {
      const counterSnap = await getDoc(counterRef);
      const current = counterSnap.exists() ? (counterSnap.data().current || 1000) : 1000;
      const previews = [];
      for (let i = 1; i <= count; i++) {
        const next = current + i;
        const previewMid = `mid-${next}`;
        // check uniqueness: any admission with madarsaId or madarsa equal to previewMid?
        const q = query(collection(db, 'admissions'), where('madarsaId', '==', previewMid));
        const snap = await getDocs(q);
        let found = snap.size > 0;
        if (!found) {
          // also check 'madarsa' field
          const q2 = query(collection(db, 'admissions'), where('madarsa', '==', previewMid));
          const snap2 = await getDocs(q2);
          found = snap2.size > 0;
        }
        previews.push({ previewMid, isUnique: !found });
      }
      return previews;
    } catch (error) {
      console.error('Error previewing mids:', error);
      toast.error('Failed to preview mids: ' + (error?.message || error));
      return [];
    }
  };

  // Reassign a single application to a new madarsaId (generated)
  // Open modal to preview and confirm reassigning a single application
  const reassignApplication = async (applicationDocId, item = null) => {
    if (!userData || userData.role !== 'central_admin') {
      toast.error('You are not authorized to reassign applications');
      return;
    }
    setModalMode('single');
    setModalTarget({ id: applicationDocId, name: item?.name || '', currentMadarsa: item?.madarsaId || item?.madarsa || '' });
    setModalLoading(true);
    setModalOpen(true);
    try {
      const previews = await previewNextMids(1);
      setModalPreview(previews.map((p, idx) => ({ id: applicationDocId, ...p })));
    } finally {
      setModalLoading(false);
    }
  };

  // Reassign all in a duplicate group except keep the first one
  // Open modal to preview and confirm reassigning all duplicates (except first)
  const reassignAllExceptFirst = async (madarsaId, applicationId, items) => {
    if (!userData || userData.role !== 'central_admin') {
      toast.error('You are not authorized to reassign duplicates');
      return;
    }
    const targets = items.slice(1).map(i => ({ id: i.id, name: i.name || '', currentMadarsa: i.madarsaId || i.madarsa || '' }));
    setModalMode('bulk');
    setModalTarget({ madarsaId, applicationId, count: targets.length });
    setModalLoading(true);
    setModalOpen(true);
    try {
      const previews = await previewNextMids(targets.length);
      // associate each preview with a doc id
      const combined = previews.map((p, idx) => ({ id: targets[idx].id, previewMid: p.previewMid, isUnique: p.isUnique, name: targets[idx].name }));
      setModalPreview(combined);
    } finally {
      setModalLoading(false);
    }
  };

  // Called when user confirms in modal for single reassignment
  const performConfirmSingle = async () => {
    if (!modalTarget) return;
    setModalLoading(true);
    try {
      const newMid = await generateNextMid();
      await updateDoc(doc(db, 'admissions', modalTarget.id), { madarsaId: newMid, madarsa: newMid });
      toast.success(`Application reassigned to ${newMid}`);
      setModalOpen(false);
      setModalPreview([]);
      setModalTarget(null);
      await fetchDuplicates();
    } catch (error) {
      console.error('Error performing reassignment:', error);
      toast.error('Failed to reassign: ' + (error?.message || error));
    } finally {
      setModalLoading(false);
    }
  };

  // Called when user confirms in modal for bulk reassignment
  const performConfirmBulk = async () => {
    if (!modalPreview || modalPreview.length === 0) return;
    setModalLoading(true);
    try {
      for (let i = 0; i < modalPreview.length; i++) {
        const item = modalPreview[i];
        const newMid = await generateNextMid();
        await updateDoc(doc(db, 'admissions', item.id), { madarsaId: newMid, madarsa: newMid });
      }
      toast.success(`Reassigned ${modalPreview.length} duplicates`);
      setModalOpen(false);
      setModalPreview([]);
      setModalTarget(null);
      await fetchDuplicates();
    } catch (error) {
      console.error('Bulk reassignment error:', error);
      toast.error('Failed to reassign duplicates: ' + (error?.message || error));
    } finally {
      setModalLoading(false);
    }
  };

  // Access control: only central_admin can access this page
  if (!userData || userData.role !== 'central_admin') {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-600">You must be logged in as a Central Admin to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Duplicate Applications Finder</h2>

      <p className="text-sm text-muted-foreground mb-4">This public page shows applicationId duplicates grouped by madarsa. Use the actions to reassign duplicates to a new generated madarsaId. Do not integrate into navigation; hide or secure it later.</p>

      <div className="mb-4 flex gap-2">
        <Input placeholder="Filter by madarsaId (leave empty to show all)" value={filterMadarsa} onChange={(e) => setFilterMadarsa(e.target.value)} />
        <Button onClick={fetchDuplicates}>Refresh</Button>
      </div>

      {loading && <p>Loading...</p>}

      {Object.keys(duplicatesByMadarsa).length === 0 && !loading && (
        <Card className="p-4">No duplicate application IDs found.</Card>
      )}

      {Object.entries(duplicatesByMadarsa).map(([madarsaId, groups]) => {
        if (filterMadarsa && !madarsaId.includes(filterMadarsa)) return null;
        return (
          <Card key={madarsaId} className="p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Madarsa: {madarsaId}</h3>
              <Button onClick={() => { /* placeholder if want to bulk actions per madarsa */ }}>No-op</Button>
            </div>

            {groups.map(group => (
              <div key={group.applicationId} className="border rounded p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">Application ID: {group.applicationId}</div>
                    <div className="text-sm text-muted-foreground">Duplicates: {group.items.length}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => reassignAllExceptFirst(madarsaId, group.applicationId, group.items)} variant="destructive">Reassign duplicates</Button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  {group.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div>
                        <div className="text-sm">Doc: {item.id}</div>
                        <div className="text-xs text-muted-foreground">Name: {item.name || '—'} | Current Madarsa: {item.madarsaId}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => reassignApplication(item.id, item)}>Reassign this</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        );
      })}

      {/* Confirmation / preview modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); setModalPreview([]); setModalTarget(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalMode === 'single' ? 'Confirm Reassign Application' : 'Confirm Reassign Duplicates'}</DialogTitle>
          </DialogHeader>

          <div className="mt-2">
            {modalLoading && <p>Preparing preview...</p>}
            {!modalLoading && modalMode === 'single' && modalTarget && (
              <div>
                <p>Document: <strong>{modalTarget.id}</strong></p>
                <p>Current Madarsa: <strong>{modalTarget.currentMadarsa || '—'}</strong></p>
                <p className="mt-2">Proposed new MID:</p>
                {modalPreview.map(p => (
                  <div key={p.previewMid} className="p-2 border rounded mt-1">
                    <div className="font-mono">{p.previewMid}</div>
                    <div className="text-sm">{p.isUnique ? 'Unique — safe to use' : 'Already exists — will still be generated by counter but collision detected'}</div>
                  </div>
                ))}
              </div>
            )}

            {!modalLoading && modalMode === 'bulk' && (
              <div>
                <p>Will reassign <strong>{modalTarget?.count || modalPreview.length}</strong> documents.</p>
                <div className="mt-2 grid gap-2">
                  {modalPreview.map(p => (
                    <div key={p.id} className="p-2 border rounded">
                      <div className="font-mono">{p.previewMid}</div>
                      <div className="text-sm">Doc: {p.id} — {p.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{p.isUnique ? 'Unique' : 'Exists'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setModalOpen(false); setModalPreview([]); setModalTarget(null); }}>Cancel</Button>
              {modalMode === 'single' ? (
                <Button onClick={performConfirmSingle} disabled={modalLoading}>Confirm Reassign</Button>
              ) : (
                <Button onClick={performConfirmBulk} disabled={modalLoading}>Confirm Reassign All</Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
