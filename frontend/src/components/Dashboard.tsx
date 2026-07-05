import React, { useState, useEffect, useRef } from 'react';
import { ReportEditor } from './ReportEditor';
import { ReportPreview } from './ReportPreview';
import { AdminPanel } from './AdminPanel';
import { exportToPdf } from '../utils/pdfExporter';
import { 
  Plus, Folder, LayoutTemplate, 
  LogOut, Search, Trash2, Copy, 
  Sun, Moon, ShieldAlert, Award, Grid, Menu, X, Download
} from 'lucide-react';

interface Logo {
  id: string;
  src: string;
  visible: boolean;
  label: string;
}

interface Field {
  id: string;
  heading: string;
  description: string;
  type: string;
  order: number;
  required?: boolean;
}

interface Photo {
  id: string;
  src: string;
  caption: string;
  order: number;
}

interface Signature {
  id: string;
  designation: string;
  name: string;
  image: string;
  type: string;
  order: number;
}

interface ReportData {
  _id?: string;
  id?: string;
  title: string;
  titleStyles: {
    fontFamily: string;
    fontSize: number;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    align: 'left' | 'center' | 'right' | 'justify';
    backgroundColor: string;
    letterSpacing?: number;
    lineSpacing?: number;
    textCase?: string;
    padding?: number;
    border?: string;
    borderRadius?: number;
  };
  logos: Logo[];
  infoTable?: {
    rows: Array<{
      id: string;
      name: string;
      value: string;
      visible: boolean;
      required: boolean;
      order: number;
    }>;
    styles: {
      showBorder: boolean;
      headerBg: string;
      headerColor: string;
      alternateRowBg: string;
      alternateRowColor: string;
      cellPadding: number;
      fontSize: number;
      fontFamily: string;
      borderThickness: number;
      borderRadius: number;
      rowHeight: number;
      colWidth: number;
      align: string;
    };
  };
  fields: Field[];
  photos: Photo[];
  signatures: Signature[];
  footer: {
    visible?: boolean;
    text: string;
    website: string;
    email: string;
    qrCode: string;
    socials: Record<string, string>;
  };
  version?: number;
  history?: Array<any>;
}

// Vector SVGs of logos to render beautiful, non-blurry default images instantly
const DEFAULT_LOGOS: Logo[] = [
  {
    id: 'gouthami',
    label: 'Gouthami',
    visible: true,
    src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23800080"/><path d="M30 40 L50 20 L70 40 L50 60 Z" fill="none" stroke="white" stroke-width="4"/><text x="50" y="80" font-family="Arial" font-size="16" font-weight="bold" fill="white" text-anchor="middle">GITAMW</text></svg>'
  },
  {
    id: 'moe',
    label: 'MoE',
    visible: true,
    src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="10" fill="%23e11d48"/><circle cx="50" cy="50" r="25" fill="none" stroke="white" stroke-width="4"/><text x="50" y="56" font-family="Arial" font-size="18" font-weight="bold" fill="white" text-anchor="middle">MoE</text></svg>'
  },
  {
    id: 'iic',
    label: 'IIC',
    visible: true,
    src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%232563eb"/><path d="M30 65 C30 40 70 40 70 65" fill="none" stroke="white" stroke-width="6"/><circle cx="50" cy="40" r="10" fill="white"/></svg>'
  },
  {
    id: 'aicte',
    label: 'AICTE',
    visible: true,
    src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="40" fill="%23ea580c"/><text x="50" y="57" font-family="Arial" font-size="20" font-weight="bold" fill="white" text-anchor="middle">AICTE</text></svg>'
  },
  {
    id: 'naac',
    label: 'NAAC',
    visible: true,
    src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="%231e3a8a"/><text x="50" y="55" font-family="Arial" font-size="20" font-weight="bold" fill="white" text-anchor="middle">NAAC</text></svg>'
  }
];

const DEFAULT_FIELDS = [
  'Date of Activity', 'Title of Activity', 'Type of Activity', 'Organized By', 
  'Theme', 'Collaborating Departments', 'Mode', 'Venue', 'Resource Person', 
  'Target Audience', 'Number of Students', 'Objectives', 'Brief Report', 
  'Key Highlights', 'Outcome', 'Conclusion'
];

const API_BASE_URL = 'http://localhost:5000';

export const Dashboard: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const [activeMenu, setActiveMenu] = useState<'home' | 'reports' | 'templates' | 'admin'>('home');
  const [reports, setReports] = useState<ReportData[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  // Editor View States
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [isSaving, setIsSaving] = useState(false);
  const [autosaveTimerActive, setAutosaveTimerActive] = useState(false);
  
  const reportRef = useRef<ReportData | null>(null);
  const originalReportRef = useRef<string>('');

  // Mobile menu
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // PDF export progress message
  const [pdfProgress, setPdfProgress] = useState<string | null>(null);

  // Fetch Current User
  useEffect(() => {
    if (token) {
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Unauthorized');
        })
        .then(user => setCurrentUser(user))
        .catch(() => handleLogout());
    }
  }, [token]);

  // Fetch Saved Reports & Templates
  useEffect(() => {
    if (token && !currentReport) {
      fetchReports();
      fetchTemplates();
    }
  }, [token, currentReport, activeMenu]);

  // Dark Mode Side-effects
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  const fetchReports = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/templates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('jwt_token', data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        // Clear forms
        setEmail('');
        setPassword('');
        setName('');
      } else {
        alert(data.msg || 'Authentication failed');
      }
    } catch (err) {
      alert('Connection error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    setToken(null);
    setCurrentUser(null);
    setCurrentReport(null);
  };

  // --- REPORT CREATION ---
  const handleCreateReport = async (templateObj?: any) => {
    // Generate default structure
    const initialFields: Field[] = (templateObj?.fields || DEFAULT_FIELDS).map((heading: any, index: number) => ({
      id: 'field_' + Math.random().toString(36).substr(2, 9),
      heading: typeof heading === 'string' ? heading : heading.heading,
      description: typeof heading === 'string' ? '' : heading.description,
      type: typeof heading === 'string' ? 'text' : heading.type,
      order: index
    }));

    const initialSignatures: Signature[] = (templateObj?.signatures || [
      { designation: 'Faculty Coordinator', name: '' },
      { designation: 'HOD', name: '' },
      { designation: 'Principal', name: '' }
    ]).map((sig: any, index: number) => ({
      id: 'sig_' + Math.random().toString(36).substr(2, 9),
      designation: sig.designation,
      name: sig.name || '',
      image: sig.image || '',
      type: sig.type || 'upload',
      order: index
    }));

    const defaultInfoRows = [
      { id: 'info_ay', name: 'Academic Year', value: '2026–27', visible: true, required: true, order: 0 },
      { id: 'info_sem', name: 'Semester', value: 'II-I', visible: true, required: true, order: 1 },
      { id: 'info_quarter', name: 'Quarter', value: 'Quarter 1', visible: true, required: false, order: 2 },
      { id: 'info_date', name: 'Date of Activity', value: '2026-07-05', visible: true, required: true, order: 3 },
      { id: 'info_venue', name: 'Venue', value: 'Seminar Hall 1', visible: true, required: true, order: 4 },
      { id: 'info_org', name: 'Organized By', value: 'Department of Computer Science', visible: true, required: true, order: 5 },
      { id: 'info_collab', name: 'Collaborating Departments / Cell', value: 'IQAC Cell', visible: true, required: false, order: 6 },
      { id: 'info_res', name: 'Resource Person', value: 'Dr. John Doe', visible: true, required: true, order: 7 },
      { id: 'info_parts', name: 'Number of Participants', value: '120', visible: true, required: false, order: 8 },
      { id: 'info_audience', name: 'Target Audience', value: 'B.Tech Students', visible: true, required: false, order: 9 }
    ];

    const defaultInfoStyles = {
      showBorder: true,
      headerBg: '#800080',
      headerColor: '#ffffff',
      alternateRowBg: '#ffffff',
      alternateRowColor: '#f9f5ff',
      cellPadding: 8,
      fontSize: 11,
      fontFamily: 'Times New Roman',
      borderThickness: 1,
      borderRadius: 0,
      rowHeight: 40,
      colWidth: 35,
      align: 'left'
    };

    const newReport: ReportData = {
      title: templateObj?.title || 'Activity Report',
      titleStyles: templateObj?.titleStyles || {
        fontFamily: 'Times New Roman',
        fontSize: 24,
        color: '#800080',
        bold: true,
        italic: false,
        underline: false,
        align: 'center',
        backgroundColor: 'transparent',
        letterSpacing: 0,
        lineSpacing: 1.2,
        textCase: 'none',
        padding: 10,
        border: 'none',
        borderRadius: 0
      },
      logos: templateObj?.logos || DEFAULT_LOGOS,
      infoTable: templateObj?.infoTable || {
        rows: defaultInfoRows,
        styles: defaultInfoStyles
      },
      fields: initialFields,
      photos: [],
      signatures: initialSignatures,
      footer: templateObj?.footer || {
        text: 'GITAMW/IQAC/AR-01',
        website: 'www.gitamw.ac.in',
        email: 'gitamw@gmail.com',
        qrCode: '',
        socials: {}
      }
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newReport)
      });

      if (res.ok) {
        const saved = await res.json();
        openEditor(saved);
      } else {
        alert('Failed to initialize report draft');
      }
    } catch (err) {
      alert('Network error initiating draft');
    }
  };

  const openEditor = (report: ReportData) => {
    setCurrentReport(report);
    reportRef.current = report;
    originalReportRef.current = JSON.stringify(report);
    setAutosaveTimerActive(true);
  };

  const closeEditor = () => {
    // Make one final manual save if changes exist
    if (JSON.stringify(reportRef.current) !== originalReportRef.current) {
      handleSaveReport(false);
    }
    setCurrentReport(null);
    reportRef.current = null;
    originalReportRef.current = '';
    setAutosaveTimerActive(false);
  };

  // --- MANUAL & AUTOSAVE CONTROLLER ---
  const handleSaveReport = async (makeSnapshot = false, snapshotMessage = '') => {
    if (!reportRef.current) return;
    setIsSaving(true);

    const reportId = reportRef.current._id || reportRef.current.id;
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...reportRef.current,
          makeSnapshot,
          snapshotMessage
        })
      });

      if (res.ok) {
        const updated = await res.json();
        reportRef.current = updated;
        originalReportRef.current = JSON.stringify(updated);
      }
    } catch (err) {
      console.error('Error saving report:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // AutoSave Engine (every 3 seconds of idle changes)
  useEffect(() => {
    if (!autosaveTimerActive) return;

    const checkAndAutosave = setInterval(() => {
      if (reportRef.current) {
        const currentStr = JSON.stringify(reportRef.current);
        if (currentStr !== originalReportRef.current) {
          handleSaveReport(false);
        }
      }
    }, 3000);

    return () => clearInterval(checkAndAutosave);
  }, [autosaveTimerActive]);

  const handleReportChange = (updatedData: ReportData) => {
    setCurrentReport(updatedData);
    reportRef.current = updatedData;
  };

  // --- DUPLICATE & DELETE REPORT ---
  const handleDuplicateReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchReports();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this report draft?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchReports();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromoteToTemplate = async () => {
    if (!reportRef.current) return;
    const name = window.prompt('Enter a unique name for this template:');
    if (!name) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          description: `Custom layout template created from report: ${reportRef.current.title}`,
          title: reportRef.current.title,
          logos: reportRef.current.logos,
          fields: reportRef.current.fields.map(({ description, ...rest }) => rest), // exclude inputs
          signatures: reportRef.current.signatures,
          footer: reportRef.current.footer
        })
      });

      if (res.ok) {
        alert('Report promoted to template successfully!');
      } else {
        alert('Failed to create template');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- DOCUMENT EXPORT HANDLERS ---
  const handleBrowserPrint = () => {
    window.print();
  };

  const handlePdfDownload = async () => {
    if (reportRef.current) {
      const emptyRequiredFields = reportRef.current.fields.filter(
        f => f.required && (!f.description || f.description.replace(/<[^>]*>/g, '').trim() === '')
      );
      if (emptyRequiredFields.length > 0) {
        alert(`Validation Error: The following required fields are empty:\n` + emptyRequiredFields.map(f => `• ${f.heading}`).join('\n') + `\n\nPlease fill them in before downloading.`);
        return;
      }
    }

    const reportTitle = reportRef.current?.title || 'Activity_Report';
    const safeFilename = reportTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/\s+/g, '_') + '.pdf';
    setPdfProgress('Starting PDF export...');
    try {
      await exportToPdf(safeFilename, (msg) => setPdfProgress(msg));
    } catch (err: any) {
      console.error('PDF export failed:', err);
      setPdfProgress('Export failed: ' + (err?.message || String(err)));
    } finally {
      setTimeout(() => setPdfProgress(null), 5000);
    }
  };


  const filteredReports = reports.filter(rep => 
    rep.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- AUTH VIEWS ---
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 px-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 transition-colors duration-150">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center justify-center gap-2">
              <Award className="text-blue-600" />
              Activity Portal
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-semibold uppercase">Institutional Report System</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow transition"
            >
              {isLogin ? 'LOG IN' : 'REGISTER'}
            </button>
          </form>

          <div className="text-center mt-6">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs font-semibold text-slate-500 hover:text-blue-600 dark:hover:text-blue-450 transition"
            >
              {isLogin ? "Don't have an account? Sign Up" : 'Already registered? Log In'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- REPORT EDITOR INTEGRATED PANEL ---
  if (currentReport) {
    return (
      <div className="h-screen w-screen flex flex-col bg-white dark:bg-slate-950 overflow-hidden font-sans print:h-auto print:w-auto print:overflow-visible">
        {/* Editor Fixed Sub-Header */}
        <header className="no-print h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 text-white">
          <div className="flex items-center gap-4">
            <button
              onClick={closeEditor}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold transition border border-slate-700"
            >
              Dashboard
            </button>
            <div className="hidden md:flex flex-col">
              <h2 className="text-sm font-bold truncate max-w-[200px]">{currentReport.title}</h2>
              <span className="text-[9px] text-slate-400 font-semibold uppercase">Draft Mode v{currentReport.version}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser?.role === 'admin' && (
              <button
                onClick={handlePromoteToTemplate}
                className="px-3 py-1.5 border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition"
                title="Saves this layout for system-wide reusable document creation"
              >
                Promote Template
              </button>
            )}
            

            <button
              onClick={handlePdfDownload}
              disabled={!!pdfProgress}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-70 rounded-lg text-xs font-semibold transition shadow-sm"
              title="Download complete report as a multi-page PDF"
            >
              <Download size={14} />
              <span>{pdfProgress ? 'Exporting…' : 'Download PDF'}</span>
            </button>
          </div>
        </header>

        {/* PDF Progress Toast */}
        {pdfProgress && (
          <div className="no-print fixed bottom-4 right-4 z-50 bg-slate-900 border border-blue-500 text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-pulse">
            <Download size={13} className="text-blue-400" />
            {pdfProgress}
          </div>
        )}

        {/* Editor Main Canvas Body */}
        <div className="flex-1 flex overflow-hidden print:block print:h-auto print:overflow-visible">
          <div className="w-[45%] h-full no-print">
            <ReportEditor
              reportData={currentReport}
              onChange={handleReportChange}
              onSave={handleSaveReport}
              isSaving={isSaving}
              isAutosaveActive={autosaveTimerActive}
            />
          </div>
          <div className="w-[55%] print:w-full h-full bg-slate-100 dark:bg-slate-900 print:bg-transparent print:h-auto print:overflow-visible">
            <ReportPreview
              reportData={currentReport}
              zoom={zoom}
              setZoom={setZoom}
              onPrint={handleBrowserPrint}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- PORTAL DASHBOARD HOMEPAGE ---
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-150">
      
      {/* Sidebar navigation */}
      <aside className={`no-print fixed md:sticky top-0 left-0 h-screen w-64 bg-slate-900 dark:bg-slate-950 text-white flex flex-col justify-between p-4 z-40 border-r border-slate-800 transition-transform duration-300 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-800">
            <h1 className="text-sm font-bold uppercase tracking-widest flex items-center gap-1.5 text-blue-400">
              <Award size={18} />
              Activity Portal
            </h1>
            <button className="md:hidden p-1 rounded hover:bg-slate-800" onClick={() => setSidebarOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => { setActiveMenu('home'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeMenu === 'home' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-850 hover:text-white'
              }`}
            >
              <Grid size={16} />
              Portal Home
            </button>
            <button
              onClick={() => { setActiveMenu('reports'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeMenu === 'reports' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-850 hover:text-white'
              }`}
            >
              <Folder size={16} />
              Saved Reports
            </button>
            <button
              onClick={() => { setActiveMenu('templates'); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                activeMenu === 'templates' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-850 hover:text-white'
              }`}
            >
              <LayoutTemplate size={16} />
              Document Templates
            </button>
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => { setActiveMenu('admin'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                  activeMenu === 'admin' ? 'bg-red-750 text-white' : 'text-red-400 hover:bg-red-950/20 hover:text-red-300'
                }`}
              >
                <ShieldAlert size={16} />
                Admin Panel
              </button>
            )}
          </div>
        </div>

        {/* User profile actions */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm uppercase">
              {currentUser?.name?.slice(0, 2)}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold truncate">{currentUser?.name}</span>
              <span className="text-[9px] text-slate-500 font-bold uppercase">{currentUser?.role}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex-1 flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
              title="Toggle Dark Mode"
            >
              {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg bg-red-950/50 border border-red-900/30 text-red-400 hover:bg-red-900/40 transition"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main portal viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <header className="no-print h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 transition-colors duration-150">
          <button className="md:hidden p-1.5 rounded hover:bg-slate-105" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          <div className="flex-1 flex justify-end items-center">
            <span className="text-xs text-slate-450 mr-4 font-bold hidden sm:inline">{new Date().toDateString()}</span>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {activeMenu === 'admin' && currentUser?.role === 'admin' ? (
            <AdminPanel
              token={token}
              currentUser={currentUser}
              onBack={() => setActiveMenu('home')}
              apiBaseUrl={API_BASE_URL}
            />
          ) : (
            <div>
              {/* Home View */}
              {activeMenu === 'home' && (
                <div className="space-y-6">
                  {/* Greeting banner */}
                  <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl shadow-md">
                    <h2 className="text-2xl font-bold">Welcome back, {currentUser?.name}!</h2>
                    <p className="text-sm text-blue-100 mt-1 max-w-lg">
                      Create autonomous institutional Activity Reports. Select a template below or click "New Report" to begin.
                    </p>
                    <button
                      onClick={() => handleCreateReport()}
                      className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-lg text-sm font-bold transition shadow-md"
                    >
                      <Plus size={16} />
                      Create Blank Report
                    </button>
                  </div>

                  {/* Standard Templates Selection */}
                  <div className="space-y-3">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Quick Start Templates</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Default Indian NAAC Table Template */}
                      <div 
                        onClick={() => handleCreateReport({ title: 'ACTIVITY REPORT ON' })}
                        className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 cursor-pointer hover:border-blue-550 dark:hover:border-blue-400 shadow-sm hover:shadow hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <h4 className="font-bold text-slate-800 dark:text-white">Default NAAC Report</h4>
                        <p className="text-xs text-slate-450 mt-1.5 leading-relaxed">
                          Times New Roman 12pt format containing standard 17 columns (Objectives, Outcome, Venue, etc.).
                        </p>
                      </div>

                      {/* Custom Templates list (from database) */}
                      {templates.map(tpl => (
                        <div 
                          key={tpl._id || tpl.id}
                          onClick={() => handleCreateReport(tpl)}
                          className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 cursor-pointer hover:border-blue-550 dark:hover:border-blue-400 shadow-sm hover:shadow hover:-translate-y-0.5 transition-all duration-200"
                        >
                          <h4 className="font-bold text-slate-800 dark:text-white">{tpl.name}</h4>
                          <p className="text-xs text-slate-450 mt-1.5 leading-relaxed truncate">
                            {tpl.description || 'Pre-configured header logos and table field layout.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Saved Reports / drafts list */}
              {(activeMenu === 'home' || activeMenu === 'reports') && (
                <div className="space-y-4 mt-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Your Saved Activity Reports</h3>
                    <div className="relative w-full sm:w-64">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search drafts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredReports.map(rep => (
                      <div 
                        key={rep._id || rep.id}
                        onClick={() => openEditor(rep)}
                        className="group p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl cursor-pointer hover:border-blue-550 hover:shadow-md transition flex flex-col justify-between h-44 shadow-sm"
                      >
                        <div>
                          <div className="flex items-center gap-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                            <Folder size={10} />
                            <span>Version {rep.version || 1}</span>
                          </div>
                          <h4 className="font-bold text-slate-800 dark:text-white mt-1.5 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-450 transition">{rep.title}</h4>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-850 mt-4 text-[10px]">
                          <span className="text-slate-400 font-semibold">Columns: {rep.fields.length}</span>
                          
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                            <button
                              onClick={(e) => handleDuplicateReport(rep._id || rep.id || '', e)}
                              className="p-1 text-slate-500 hover:text-blue-650 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded"
                              title="Duplicate Report"
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteReport(rep._id || rep.id || '', e)}
                              className="p-1 text-slate-505 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 rounded"
                              title="Delete Report"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredReports.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-400 text-sm">No saved activity reports found.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Templates View (Specific Template page list) */}
              {activeMenu === 'templates' && (
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">Document Structure Templates</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div 
                      onClick={() => handleCreateReport()}
                      className="p-5 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl hover:border-blue-500 flex flex-col items-center justify-center text-center cursor-pointer transition py-12"
                    >
                      <Plus className="text-slate-400" />
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-350 mt-2">Create Custom Structure</span>
                    </div>

                    <div 
                      onClick={() => handleCreateReport()}
                      className="p-5 border border-slate-205 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 cursor-pointer hover:border-blue-500 shadow-sm"
                    >
                      <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                        <Award size={14} className="text-yellow-600" />
                        Default NAAC Preset
                      </h4>
                      <p className="text-xs text-slate-450 mt-1.5 leading-relaxed">
                        Pre-populated with 17 mandatory reporting criteria.
                      </p>
                    </div>

                    {templates.map(tpl => (
                      <div 
                        key={tpl._id || tpl.id}
                        onClick={() => handleCreateReport(tpl)}
                        className="p-5 border border-slate-205 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 cursor-pointer hover:border-blue-500 shadow-sm"
                      >
                        <h4 className="font-bold text-slate-800 dark:text-white">{tpl.name}</h4>
                        <p className="text-xs text-slate-450 mt-1.5 leading-relaxed">
                          {tpl.description || 'Custom global organizational preset.'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
