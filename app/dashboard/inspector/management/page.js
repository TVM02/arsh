'use client';

import { useState, useEffect, useMemo } from 'react';
import InspectorLayout from '@/components/InspectorLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  FileText, Building, Download, RefreshCw, Search,
  Eye, Calendar, User, MessageSquare, Paperclip, FileCheck
} from 'lucide-react';
import useAuthStore from '@/lib/authStore';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

const fmtDate = (v) => {
  if (!v) return '—';
  const d = v?.toDate ? v.toDate() : new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function InspectorManagementPage() {
  const { user } = useAuthStore();

  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected]   = useState(null); // detail modal
  const [previewFile, setPreviewFile] = useState(null); // file preview modal

  useEffect(() => {
    if (!user) return;
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(
        query(collection(db, 'manager_documents'), orderBy('submittedAt', 'desc'))
      );
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load management reports');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm) return docs;
    const s = searchTerm.toLowerCase();
    return docs.filter(d =>
      (d.madarsaName || '').toLowerCase().includes(s) ||
      String(d.madarsaId || '').includes(s) ||
      (d.managerName || '').toLowerCase().includes(s) ||
      (d.message || '').toLowerCase().includes(s)
    );
  }, [docs, searchTerm]);

  if (loading) {
    return (
      <InspectorLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" />
        </div>
      </InspectorLayout>
    );
  }

  return (
    <InspectorLayout>
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Management Reports</h1>
            <p className="text-sm text-gray-500 mt-1">Documents uploaded by managers across all madarsas</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDocs}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Reports',     value: docs.length,                                            cls: 'text-blue-600',  icon: FileText },
            { label: 'Total Files',       value: docs.reduce((n, d) => n + (d.files?.length || 0), 0), cls: 'text-teal-600',  icon: Paperclip },
            { label: 'Madarsas Reported', value: new Set(docs.map(d => d.madarsaId).filter(Boolean)).size, cls: 'text-indigo-600', icon: Building },
          ].map(({ label, value, cls, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`w-8 h-8 ${cls} flex-shrink-0`} />
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-2xl font-bold ${cls}`}>{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by madarsa, manager name, message…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-teal-600" />
              Submitted Documents ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-500">
                  {searchTerm ? 'No results match your search' : 'No documents submitted yet'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Madarsa</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead className="text-center">Files</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Submitted</div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((doc, i) => (
                    <TableRow key={doc.id}>
                      <TableCell className="text-xs text-gray-400">{i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building className="w-3 h-3 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium">{doc.madarsaName || '—'}</p>
                            {doc.madarsaId && <p className="text-xs text-gray-400">{doc.madarsaId}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-400" />
                          <div>
                            <p className="text-sm">{doc.managerName || '—'}</p>
                            {doc.managerEmail && <p className="text-xs text-gray-400">{doc.managerEmail}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-teal-100 text-teal-700">{doc.files?.length || 0} file{(doc.files?.length || 0) !== 1 ? 's' : ''}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                        {doc.message || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{fmtDate(doc.submittedAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setSelected(doc)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                Document Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Madarsa</p>
                  <p className="font-medium">{selected.madarsaName || '—'}</p>
                  {selected.madarsaId && <p className="text-xs text-gray-400">{selected.madarsaId}</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Manager</p>
                  <p className="font-medium">{selected.managerName || '—'}</p>
                  {selected.managerEmail && <p className="text-xs text-gray-400">{selected.managerEmail}</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Submitted</p>
                  <p className="font-medium">{fmtDate(selected.submittedAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  <Badge className="bg-green-100 text-green-700">{selected.status || 'submitted'}</Badge>
                </div>
              </div>

              {/* Message */}
              {selected.message && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-gray-500" />
                    <p className="text-xs font-medium text-gray-600">Message / Notes</p>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selected.message}</p>
                </div>
              )}

              {/* Files */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Files ({selected.files?.length || 0})
                </p>
                <div className="space-y-2">
                  {(selected.files || []).map((file, i) => {
                    const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name || '') ||
                      (file.contentType || file.type || '').startsWith('image/');
                    return (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded p-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-teal-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm truncate">{file.name || `File ${i + 1}`}</p>
                            {file.size && <p className="text-xs text-gray-400">{formatSize(file.size)}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isImg && (
                            <Button size="sm" variant="outline" onClick={() => setPreviewFile(file)}>
                              <Eye className="w-3 h-3" />
                            </Button>
                          )}
                          {file.url && (
                            <a href={file.url} target="_blank" rel="noopener noreferrer" download={file.name}>
                              <Button size="sm" variant="outline">
                                <Download className="w-3 h-3" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Image Preview Modal */}
      {previewFile && (
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent className="max-w-3xl bg-white">
            <DialogHeader>
              <DialogTitle>{previewFile.name}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3">
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="max-w-full rounded-lg border shadow"
                style={{ maxHeight: '65vh', objectFit: 'contain' }}
              />
              {previewFile.url && (
                <a href={previewFile.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline">
                  Open full size
                </a>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </InspectorLayout>
  );
}
