import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Download, Upload, ShieldCheck, History, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { adminApi } from '../../api/admin.api';
import { useAuthStore } from '../../store/authStore';

export const SystemBackup: React.FC = () => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // Fetch histories and logs
  const fetchLogs = async () => {
    try {
      setIsLoadingLogs(true);
      
      const [historyRes, auditRes] = await Promise.all([
        adminApi.getUploadHistory(),
        adminApi.getAuditLogs()
      ]);

      setUploadHistory(historyRes.data || []);
      setAuditLogs(auditRes.data || []);
    } catch (error) {
      console.error('Failed to load system logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleDownloadBackup = async () => {
    try {
      setIsBackingUp(true);
      const token = useAuthStore.getState().token || localStorage.getItem('campus360_token');
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      
      const response = await axios({
        url: `${baseURL}/admin/backup`,
        method: 'GET',
        responseType: 'blob', // Important for file download
        headers: { Authorization: `Bearer ${token}` }
      });

      // Find file name from header or use default
      const contentDisposition = response.headers['content-disposition'];
      let fileName = 'campus360_database_backup.db';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match && match[1]) {
          fileName = match[1];
        }
      }

      // Create a temporary link to trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('SQLite Database backup file downloaded successfully!');
      fetchLogs(); // refresh audit logs
    } catch (error) {
      toast.error('Failed to generate database backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file extension
    if (!file.name.endsWith('.db')) {
      toast.error('Invalid file type! Please upload a valid SQLite backup database (.db file).');
      return;
    }

    const confirmRestore = window.confirm(
      '⚠️ WARNING: Restoring the database will overwrite all current student rosters, marks sheets, and attendance logs. Are you sure you want to proceed?'
    );
    if (!confirmRestore) return;

    try {
      setIsRestoring(true);
      await adminApi.restoreDb(file);

      toast.success('Database restored successfully! Re-indexed all collections.');
      fetchLogs();
    } catch (error: any) {
      toast.error(error.message || 'Restore failed. The backup file might be corrupted.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-primary-400" />
            System Administration
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Download local database snapshots, restore backups, and audit user activity logs
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actions panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Backup card */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary-500/10 text-primary-400 rounded-xl">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Download Backup</h3>
                <p className="text-[10px] text-slate-500">Generate a snapshot of SQLite database</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Downloads the complete <strong>campus360.db</strong> file containing all CSE department registers, grades, and logs. Keep this copy safe.
            </p>
            <Button
              onClick={handleDownloadBackup}
              isLoading={isBackingUp}
              variant="primary"
              className="w-full justify-center text-xs py-2.5 font-semibold"
            >
              <Download className="w-4 h-4 mr-1.5" /> Download Snapshot
            </Button>
          </div>

          {/* Restore Card */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-warning-500/10 text-warning-400 rounded-xl">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Restore Snapshot</h3>
                <p className="text-[10px] text-slate-500">Overwrite local database file</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Upload a previously downloaded <strong>.db</strong> snapshot. Doing so immediately rewrites all existing academic profiles.
            </p>
            <div className="relative">
              <input
                type="file"
                accept=".db"
                onChange={handleRestoreBackup}
                disabled={isRestoring}
                className="hidden"
                id="restore-upload-input"
              />
              <label htmlFor="restore-upload-input" className="w-full">
                <Button
                  as="span"
                  isLoading={isRestoring}
                  variant="secondary"
                  className="w-full justify-center text-xs py-2.5 font-semibold cursor-pointer border-slate-700/60 hover:bg-slate-800"
                >
                  <Upload className="w-4 h-4 mr-1.5" /> Choose Backup File (.db)
                </Button>
              </label>
            </div>
            <div className="flex items-start gap-2 p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-danger-500 shrink-0 mt-0.5" />
              <span className="text-[10px] text-danger-300 leading-relaxed">
                Caution: Ensure the database server is idle before uploading. The restore action restarts connection pools.
              </span>
            </div>
          </div>
        </div>

        {/* Audit Logs & Upload history */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload History */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-primary-400" />
                Excel Import Logs
              </h3>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                {uploadHistory.length} uploads
              </span>
            </div>

            <div className="overflow-x-auto">
              {isLoadingLogs ? (
                <div className="space-y-2 py-4">
                  <div className="h-6 bg-slate-800/50 rounded-lg animate-pulse" />
                  <div className="h-6 bg-slate-800/50 rounded-lg animate-pulse" />
                </div>
              ) : uploadHistory.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-500">No Excel spreadsheets have been uploaded yet.</p>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                      <th className="py-2.5">File Name</th>
                      <th className="py-2.5">Target Sem</th>
                      <th className="py-2.5">Imported By</th>
                      <th className="py-2.5 text-center">Records</th>
                      <th className="py-2.5">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-xs text-slate-300">
                    {uploadHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-800/20">
                        <td className="py-3 font-semibold text-slate-200">{h.fileName}</td>
                        <td className="py-3 text-slate-400">{h.semester || 'N/A'}</td>
                        <td className="py-3 text-slate-400">{h.uploadedByName || 'HOD Admin'}</td>
                        <td className="py-3 text-center">
                          <span className="px-2 py-0.5 bg-primary-500/10 text-primary-400 rounded-md font-mono text-[10px]">
                            {h.recordsImported} rows
                          </span>
                        </td>
                        <td className="py-3 text-slate-500">
                          {new Date(h.uploadedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Audit Logs */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-warning-400" />
                Audit Logs Feed
              </h3>
              <button 
                onClick={fetchLogs}
                className="text-[10px] text-primary-400 hover:text-primary-300 font-semibold"
              >
                Refresh Log Feed
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {isLoadingLogs ? (
                <div className="space-y-2 py-4">
                  <div className="h-10 bg-slate-800/50 rounded-lg animate-pulse" />
                  <div className="h-10 bg-slate-800/50 rounded-lg animate-pulse" />
                  <div className="h-10 bg-slate-800/50 rounded-lg animate-pulse" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-500">No activity logs recorded yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 bg-slate-950/40 border border-slate-800/60 rounded-xl flex items-start gap-3 hover:border-slate-700 transition-colors">
                    <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
                      log.role === 'admin' ? 'bg-primary-500/10 text-primary-400' :
                      log.role === 'faculty' ? 'bg-warning-500/10 text-warning-400' :
                      'bg-slate-500/10 text-slate-400'
                    }`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          {log.username}
                          <span className="text-[10px] text-slate-500 font-normal uppercase tracking-wider ml-1.5 px-1.5 py-0.5 bg-slate-850 rounded">
                            {log.role}
                          </span>
                        </span>
                        <span className="text-[9px] text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{log.action}</p>
                      {log.ipAddress && (
                        <p className="text-[9px] text-slate-500 font-mono mt-1">IP: {log.ipAddress}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
