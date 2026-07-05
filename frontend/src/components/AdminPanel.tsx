import React, { useState, useEffect } from 'react';
import { 
  Users, FileText, Database, ShieldAlert, 
  Trash2, Download, Upload, ShieldCheck, UserCheck 
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt?: string;
}

interface Template {
  id?: string;
  _id?: string;
  name: string;
  description: string;
  createdAt?: string;
}

interface AdminPanelProps {
  token: string;
  currentUser: { id: string; role: string; name: string };
  onBack: () => void;
  apiBaseUrl: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  token,
  currentUser,
  onBack,
  apiBaseUrl
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'templates' | 'backup'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      if (activeTab === 'users') {
        const res = await fetch(`${apiBaseUrl}/api/admin/users`, { headers });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        } else {
          throw new Error('Failed to load users');
        }
      } else if (activeTab === 'templates') {
        const res = await fetch(`${apiBaseUrl}/api/admin/templates`, { headers });
        if (res.ok) {
          const data = await res.json();
          setTemplates(data);
        } else {
          throw new Error('Failed to load templates');
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Error fetching admin data' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (userId: string, currentRole: 'admin' | 'user') => {
    if (userId === currentUser.id) {
      setMessage({ type: 'error', text: 'You cannot change your own role.' });
      return;
    }

    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      const res = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'User role updated successfully.' });
        fetchData();
      } else {
        const err = await res.json();
        throw new Error(err.msg || 'Failed to update user role');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;

    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/templates/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Template deleted successfully.' });
        fetchData();
      } else {
        throw new Error('Failed to delete template');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/backup`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Backup creation failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity_report_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setMessage({ type: 'success', text: 'Backup downloaded successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('WARNING: Restoring will overwrite existing data. Are you sure you want to proceed?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        const res = await fetch(`${apiBaseUrl}/api/admin/restore`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(backupData)
        });

        if (res.ok) {
          setMessage({ type: 'success', text: 'System database restored successfully.' });
          fetchData();
        } else {
          const err = await res.json();
          throw new Error(err.msg || 'Restore failed');
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: 'Failed to restore: ' + err.message });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 dark:border-slate-800 pb-4 mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldAlert className="text-red-500" />
            System Administration
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure system tables, manage portal access, templates, and backups.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-semibold border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 rounded-lg transition"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition ${
            activeTab === 'users' 
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Users size={16} />
          User Management
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition ${
            activeTab === 'templates' 
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <FileText size={16} />
          System Templates
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 transition ${
            activeTab === 'backup' 
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Database size={16} />
          Database Backup & Restore
        </button>
      </div>

      {/* Alerts */}
      {message && (
        <div className={`p-4 rounded-lg mb-6 text-sm font-semibold flex items-center ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800' 
            : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div>
          {/* Tab content: Users */}
          {activeTab === 'users' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="p-4">Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-4 font-semibold text-slate-850 dark:text-white">{user.name}</td>
                      <td className="p-4 text-slate-500 dark:text-slate-400">{user.email}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          user.role === 'admin' 
                            ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800' 
                            : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800'
                        }`}>
                          {user.role === 'admin' ? <ShieldCheck size={12} /> : <UserCheck size={12} />}
                          {user.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleRole(user.id, user.role)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition"
                          disabled={user.id === currentUser.id}
                        >
                          Make {user.role === 'admin' ? 'User' : 'Admin'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab content: Templates */}
          {activeTab === 'templates' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="p-4">Template Name</th>
                    <th className="p-4">Description</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {templates.map((tpl) => (
                    <tr key={tpl.id || tpl._id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="p-4 font-semibold text-slate-850 dark:text-white">{tpl.name}</td>
                      <td className="p-4 text-slate-500 dark:text-slate-400 max-w-md truncate">{tpl.description || 'No description'}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteTemplate(tpl.id || tpl._id || '')}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition"
                          title="Delete Template"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {templates.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-400">No system templates found. You can promote any report to a template from the report editor.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab content: Backup */}
          {activeTab === 'backup' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Export Backup Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                    <Download className="text-blue-500" />
                    Export Database Backup
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Download a comprehensive snapshot of all data including user profiles, activity report documents, custom layouts, template designs, and signature details in a single JSON file.
                  </p>
                </div>
                <button
                  onClick={handleDownloadBackup}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  <Download size={16} />
                  Download Backup File
                </button>
              </div>

              {/* Import Restore Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                    <Upload className="text-red-500" />
                    Restore System Database
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Restore the application to a previous state by uploading a JSON backup file. This will overwrite current data. Back up your existing setup first if you want to save it!
                  </p>
                </div>
                <label className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-red-300 hover:border-red-400 hover:bg-red-50/50 dark:border-red-800 dark:hover:bg-red-950/10 rounded-lg font-semibold cursor-pointer text-red-700 dark:text-red-400 transition">
                  <Upload size={16} />
                  <span>Upload & Restore</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
