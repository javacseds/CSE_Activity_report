import React, { useState, useRef, useEffect } from 'react';
import { RichTextEditor } from './RichTextEditor';
import { 
  Upload, Trash2, ArrowUp, ArrowDown, Plus, 
  Settings, Image, PenTool, Layout, Check, 
  RotateCcw, Info, CloudLightning, RefreshCw
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
}

interface ReportEditorProps {
  reportData: ReportData;
  onChange: (data: ReportData) => void;
  onSave: (makeSnapshot?: boolean, message?: string) => Promise<void>;
  isSaving: boolean;
  isAutosaveActive: boolean;
}

export const ReportEditor: React.FC<ReportEditorProps> = ({
  reportData,
  onChange,
  onSave,
  isSaving,
  isAutosaveActive
}) => {
  const [activeTab, setActiveTab] = useState<'branding' | 'infoTable' | 'fields' | 'photos' | 'signatures' | 'footer'>('branding');
  const [drawingSigId, setDrawingSigId] = useState<string | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [newSignatureRole, setNewSignatureRole] = useState('');
  const [snapshotMsg, setSnapshotMsg] = useState('');
  const [showSnapshotBox, setShowSnapshotBox] = useState(false);
  const [newInfoName, setNewInfoName] = useState('');
  const [newInfoValue, setNewInfoValue] = useState('');
  const [showInfoStyles, setShowInfoStyles] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Helper: Compress Image using Canvas
  const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 600): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          resolve(base64Str);
        }
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  // Generic file input handler returning compressed base64
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onComplete: (base64: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const compressed = await compressImage(base64);
      onComplete(compressed);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset file input
  };

  // --- BRANDING ACTIONS ---
  const handleLogoToggle = (id: string) => {
    const updatedLogos = reportData.logos.map(l => 
      l.id === id ? { ...l, visible: !l.visible } : l
    );
    onChange({ ...reportData, logos: updatedLogos });
  };

  const handleLogoUpload = (id: string, base64: string) => {
    const updatedLogos = reportData.logos.map(l => 
      l.id === id ? { ...l, src: base64 } : l
    );
    onChange({ ...reportData, logos: updatedLogos });
  };

  const handleRemoveLogo = (id: string) => {
    const updatedLogos = reportData.logos.map(l => 
      l.id === id ? { ...l, src: '' } : l
    );
    onChange({ ...reportData, logos: updatedLogos });
  };

  const updateTitleStyle = (key: string, value: any) => {
    onChange({
      ...reportData,
      titleStyles: {
        ...reportData.titleStyles,
        [key]: value
      }
    });
  };

  // --- INFO TABLE ACTIONS ---
  const handleInfoRowChange = (id: string, key: 'name' | 'value', value: string) => {
    if (!reportData.infoTable) return;
    const updatedRows = reportData.infoTable.rows.map(r => 
      r.id === id ? { ...r, [key]: value } : r
    );
    onChange({
      ...reportData,
      infoTable: {
        ...reportData.infoTable,
        rows: updatedRows
      }
    });
  };

  const handleInfoRowToggleVisibility = (id: string) => {
    if (!reportData.infoTable) return;
    const updatedRows = reportData.infoTable.rows.map(r => 
      r.id === id ? { ...r, visible: !r.visible } : r
    );
    onChange({
      ...reportData,
      infoTable: {
        ...reportData.infoTable,
        rows: updatedRows
      }
    });
  };

  const handleInfoRowToggleRequired = (id: string) => {
    if (!reportData.infoTable) return;
    const updatedRows = reportData.infoTable.rows.map(r => 
      r.id === id ? { ...r, required: !r.required } : r
    );
    onChange({
      ...reportData,
      infoTable: {
        ...reportData.infoTable,
        rows: updatedRows
      }
    });
  };

  const handleAddInfoRow = () => {
    if (!newInfoName.trim() || !reportData.infoTable) return;
    const currentMaxOrder = reportData.infoTable.rows.reduce((max, r) => r.order > max ? r.order : max, 0);
    const newRow = {
      id: 'info_' + Math.random().toString(36).substr(2, 9),
      name: newInfoName.trim(),
      value: newInfoValue.trim(),
      visible: true,
      required: false,
      order: currentMaxOrder + 1
    };
    onChange({
      ...reportData,
      infoTable: {
        ...reportData.infoTable,
        rows: [...reportData.infoTable.rows, newRow]
      }
    });
    setNewInfoName('');
    setNewInfoValue('');
  };

  const handleDeleteInfoRow = (id: string) => {
    if (!reportData.infoTable) return;
    const filteredRows = reportData.infoTable.rows.filter(r => r.id !== id);
    onChange({
      ...reportData,
      infoTable: {
        ...reportData.infoTable,
        rows: filteredRows
      }
    });
  };

  const handleMoveInfoRow = (index: number, direction: 'up' | 'down') => {
    if (!reportData.infoTable) return;
    const sorted = [...reportData.infoTable.rows].sort((a, b) => a.order - b.order);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const tempOrder = sorted[index].order;
    sorted[index].order = sorted[swapIndex].order;
    sorted[swapIndex].order = tempOrder;

    onChange({
      ...reportData,
      infoTable: {
        ...reportData.infoTable,
        rows: sorted
      }
    });
  };

  const handleInfoTableStyleChange = (key: string, value: any) => {
    if (!reportData.infoTable) return;
    onChange({
      ...reportData,
      infoTable: {
        ...reportData.infoTable,
        styles: {
          ...reportData.infoTable.styles,
          [key]: value
        }
      }
    });
  };

  // --- FIELDS ACTIONS ---
  const handleFieldChange = (id: string, value: string) => {
    const updatedFields = reportData.fields.map(f => 
      f.id === id ? { ...f, description: value } : f
    );
    onChange({ ...reportData, fields: updatedFields });
  };

  const handleToggleFieldRequired = (id: string) => {
    const updatedFields = reportData.fields.map(f => 
      f.id === id ? { ...f, required: !f.required } : f
    );
    onChange({ ...reportData, fields: updatedFields });
  };

  const handleAddField = () => {
    if (!newFieldName.trim()) return;
    const currentMaxOrder = reportData.fields.reduce((max, f) => f.order > max ? f.order : max, 0);
    const newField: Field = {
      id: 'field_' + Math.random().toString(36).substr(2, 9),
      heading: newFieldName.trim(),
      description: '',
      type: 'custom',
      order: currentMaxOrder + 1
    };
    onChange({
      ...reportData,
      fields: [...reportData.fields, newField]
    });
    setNewFieldName('');
  };

  const handleRemoveField = (id: string) => {
    const filtered = reportData.fields.filter(f => f.id !== id);
    onChange({ ...reportData, fields: filtered });
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const sorted = [...reportData.fields].sort((a, b) => a.order - b.order);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const tempOrder = sorted[index].order;
    sorted[index].order = sorted[swapIndex].order;
    sorted[swapIndex].order = tempOrder;

    onChange({ ...reportData, fields: sorted });
  };

  // --- PHOTOS GALLERY ACTIONS ---
  const handlePhotoUpload = (base64: string) => {
    const currentMaxOrder = reportData.photos.reduce((max, p) => p.order > max ? p.order : max, 0);
    const newPhoto: Photo = {
      id: 'photo_' + Math.random().toString(36).substr(2, 9),
      src: base64,
      caption: 'Activity Photo Description',
      order: currentMaxOrder + 1
    };
    onChange({ ...reportData, photos: [...reportData.photos, newPhoto] });
  };

  const handleUpdateCaption = (id: string, val: string) => {
    const updated = reportData.photos.map(p => 
      p.id === id ? { ...p, caption: val } : p
    );
    onChange({ ...reportData, photos: updated });
  };

  const handleDeletePhoto = (id: string) => {
    const updated = reportData.photos.filter(p => p.id !== id);
    onChange({ ...reportData, photos: updated });
  };

  const handleMovePhoto = (index: number, direction: 'up' | 'down') => {
    const sorted = [...reportData.photos].sort((a, b) => a.order - b.order);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const tempOrder = sorted[index].order;
    sorted[index].order = sorted[swapIndex].order;
    sorted[swapIndex].order = tempOrder;

    onChange({ ...reportData, photos: sorted });
  };

  // --- SIGNATURE ACTIONS ---
  const handleAddSignatureRole = () => {
    if (!newSignatureRole.trim()) return;
    const currentMaxOrder = reportData.signatures.reduce((max, s) => s.order > max ? s.order : max, 0);
    const newSig: Signature = {
      id: 'sig_' + Math.random().toString(36).substr(2, 9),
      designation: newSignatureRole.trim(),
      name: '',
      image: '',
      type: 'upload',
      order: currentMaxOrder + 1
    };
    onChange({ ...reportData, signatures: [...reportData.signatures, newSig] });
    setNewSignatureRole('');
  };

  const handleSignatureDetailsChange = (id: string, key: 'name' | 'designation' | 'image' | 'type', val: string) => {
    const updated = reportData.signatures.map(s => 
      s.id === id ? { ...s, [key]: val } : s
    );
    onChange({ ...reportData, signatures: updated });
  };

  const handleRemoveSignature = (id: string) => {
    const updated = reportData.signatures.filter(s => s.id !== id);
    onChange({ ...reportData, signatures: updated });
  };

  const handleMoveSignature = (index: number, direction: 'up' | 'down') => {
    const sorted = [...reportData.signatures].sort((a, b) => a.order - b.order);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sorted.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const tempOrder = sorted[index].order;
    sorted[index].order = sorted[swapIndex].order;
    sorted[swapIndex].order = tempOrder;

    onChange({ ...reportData, signatures: sorted });
  };

  const handleUploadSignature = (id: string, base64: string) => {
    const updated = reportData.signatures.map(s => 
      s.id === id ? { ...s, image: base64, type: 'upload' } : s
    );
    onChange({ ...reportData, signatures: updated });
  };

  // Drawing Pad Logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const openDrawingPad = (id: string) => {
    setDrawingSigId(id);
  };

  const saveDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas || !drawingSigId) return;
    const dataUrl = canvas.toDataURL('image/png');

    const updated = reportData.signatures.map(s => 
      s.id === drawingSigId ? { ...s, image: dataUrl, type: 'digital' } : s
    );
    onChange({ ...reportData, signatures: updated });
    setDrawingSigId(null);
  };

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Initialize Canvas parameters on load
  useEffect(() => {
    if (drawingSigId && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [drawingSigId]);

  // --- FOOTER ACTIONS ---
  const handleFooterChange = (key: string, val: any) => {
    onChange({
      ...reportData,
      footer: {
        ...reportData.footer,
        [key]: val
      }
    });
  };

  const handleSnapshotSave = async () => {
    if (!snapshotMsg.trim()) return;
    await onSave(true, snapshotMsg.trim());
    setSnapshotMsg('');
    setShowSnapshotBox(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors duration-150 relative">
      
      {/* Save Status Banner */}
      <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 select-none">
        <div className="flex items-center gap-1.5 font-medium">
          <CloudLightning size={14} className="text-blue-500" />
          {isAutosaveActive ? (
            <span>Autosave is ON</span>
          ) : (
            <span>Autosave disabled</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSaving ? (
            <span className="flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Saving...</span>
          ) : (
            <span className="text-green-500 flex items-center gap-1"><Check size={12} /> All changes saved</span>
          )}
          <button 
            onClick={() => setShowSnapshotBox(!showSnapshotBox)}
            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 rounded font-semibold text-slate-700 dark:text-slate-300 transition"
          >
            Create Version
          </button>
        </div>
      </div>

      {/* Manual Version Snapshot box */}
      {showSnapshotBox && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-200 dark:border-blue-900/50 text-xs flex gap-2 items-center">
          <input
            type="text"
            value={snapshotMsg}
            onChange={(e) => setSnapshotMsg(e.target.value)}
            placeholder="Describe this version (e.g. Completed objective section)..."
            className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={handleSnapshotSave}
            disabled={!snapshotMsg.trim()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-bold transition"
          >
            Save
          </button>
          <button
            onClick={() => setShowSnapshotBox(false)}
            className="px-2 py-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Editor Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-450">
        <button
          onClick={() => setActiveTab('branding')}
          className={`flex-1 py-3 text-center border-b-2 transition ${
            activeTab === 'branding' 
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-slate-50/50 dark:bg-slate-900/50' 
              : 'border-transparent hover:text-slate-805 dark:hover:text-white'
          }`}
        >
          <Layout size={14} className="inline mr-1" />
          Branding
        </button>
        <button
          onClick={() => setActiveTab('infoTable')}
          className={`flex-1 py-3 text-center border-b-2 transition ${
            activeTab === 'infoTable' 
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-slate-50/50 dark:bg-slate-900/50' 
              : 'border-transparent hover:text-slate-805 dark:hover:text-white'
          }`}
        >
          <Info size={14} className="inline mr-1" />
          Info Table
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          className={`flex-1 py-3 text-center border-b-2 transition ${
            activeTab === 'fields' 
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-slate-50/50 dark:bg-slate-900/50' 
              : 'border-transparent hover:text-slate-805 dark:hover:text-white'
          }`}
        >
          <Settings size={14} className="inline mr-1" />
          Fields
        </button>
        <button
          onClick={() => setActiveTab('photos')}
          className={`flex-1 py-3 text-center border-b-2 transition ${
            activeTab === 'photos' 
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-slate-50/50 dark:bg-slate-900/50' 
              : 'border-transparent hover:text-slate-805 dark:hover:text-white'
          }`}
        >
          <Image size={14} className="inline mr-1" />
          Gallery
        </button>
        <button
          onClick={() => setActiveTab('signatures')}
          className={`flex-1 py-3 text-center border-b-2 transition ${
            activeTab === 'signatures' 
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-slate-50/50 dark:bg-slate-900/50' 
              : 'border-transparent hover:text-slate-805 dark:hover:text-white'
          }`}
        >
          <PenTool size={14} className="inline mr-1" />
          Signatures
        </button>
        <button
          onClick={() => setActiveTab('footer')}
          className={`flex-1 py-3 text-center border-b-2 transition ${
            activeTab === 'footer' 
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-slate-50/50 dark:bg-slate-900/50' 
              : 'border-transparent hover:text-slate-805 dark:hover:text-white'
          }`}
        >
          <Info size={14} className="inline mr-1" />
          Footer
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* TAB 1: BRANDING & TITLE */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-850 dark:text-white mb-3">Institutional Logo Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reportData.logos.map((logo) => (
                  <div key={logo.id} className="p-3 border border-slate-200 dark:border-slate-850 rounded-lg bg-white dark:bg-slate-950 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-350">{logo.label} Logo</span>
                      <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={logo.visible}
                          onChange={() => handleLogoToggle(logo.id)}
                          className="rounded text-blue-600"
                        />
                        <span>Visible</span>
                      </label>
                    </div>

                    {logo.src ? (
                      <div className="relative w-full h-24 border border-slate-200 rounded overflow-hidden flex items-center justify-center bg-slate-50">
                        <img src={logo.src} alt={logo.label} className="max-h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => handleRemoveLogo(logo.id)}
                          className="absolute bottom-1 right-1 p-1 bg-red-650 hover:bg-red-700 text-white rounded transition shadow"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded cursor-pointer text-slate-400 hover:text-blue-500 transition">
                        <Upload size={20} />
                        <span className="text-[10px] mt-1 font-semibold">Upload Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, (base64) => handleLogoUpload(logo.id, base64))}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <h3 className="text-sm font-bold text-slate-850 dark:text-white mb-3">Report Title & Styles</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Title Text</label>
                  <input
                    type="text"
                    value={reportData.title}
                    onChange={(e) => onChange({ ...reportData, title: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Font Family</label>
                    <select
                      value={reportData.titleStyles.fontFamily || 'Times New Roman'}
                      onChange={(e) => updateTitleStyle('fontFamily', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-white"
                    >
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Arial">Arial</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Outfit">Outfit</option>
                      <option value="Playfair Display">Playfair Display</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Text Case</label>
                    <select
                      value={reportData.titleStyles.textCase || 'none'}
                      onChange={(e) => updateTitleStyle('textCase', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-white"
                    >
                      <option value="none">Default Case</option>
                      <option value="uppercase">UPPERCASE</option>
                      <option value="lowercase">lowercase</option>
                      <option value="capitalize">Title Case</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Font Size (px)</label>
                    <input
                      type="number"
                      value={reportData.titleStyles.fontSize}
                      onChange={(e) => updateTitleStyle('fontSize', parseInt(e.target.value) || 12)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-sm text-slate-805 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Alignment</label>
                    <select
                      value={reportData.titleStyles.align}
                      onChange={(e) => updateTitleStyle('align', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-955 border border-slate-250 dark:border-slate-800 rounded-lg text-sm text-slate-800 dark:text-white"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                      <option value="justify">Justified</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Text Color</label>
                    <input
                      type="color"
                      value={reportData.titleStyles.color}
                      onChange={(e) => updateTitleStyle('color', e.target.value)}
                      className="w-full h-8 p-0 border border-slate-250 dark:border-slate-800 rounded cursor-pointer bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Background Color</label>
                    <input
                      type="color"
                      value={reportData.titleStyles.backgroundColor === 'transparent' ? '#ffffff' : reportData.titleStyles.backgroundColor}
                      onChange={(e) => updateTitleStyle('backgroundColor', e.target.value)}
                      className="w-full h-8 p-0 border border-slate-250 dark:border-slate-800 rounded cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                <div className="flex gap-4 items-center bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-850">
                  <span className="text-xs font-semibold text-slate-500 mr-2">Formatting:</span>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportData.titleStyles.bold}
                      onChange={(e) => updateTitleStyle('bold', e.target.checked)}
                      className="rounded"
                    />
                    <span>Bold</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportData.titleStyles.italic}
                      onChange={(e) => updateTitleStyle('italic', e.target.checked)}
                      className="rounded"
                    />
                    <span>Italics</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reportData.titleStyles.underline}
                      onChange={(e) => updateTitleStyle('underline', e.target.checked)}
                      className="rounded"
                    />
                    <span>Underline</span>
                  </label>
                </div>

                {/* Sizing & Borders Sliders */}
                <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-850 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-500">Letter Spacing (px)</span>
                    <span className="font-bold">{reportData.titleStyles.letterSpacing || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={reportData.titleStyles.letterSpacing || 0}
                    onChange={(e) => updateTitleStyle('letterSpacing', parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />

                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="font-semibold text-slate-500">Line Spacing</span>
                    <span className="font-bold">{reportData.titleStyles.lineSpacing || 1.2}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={reportData.titleStyles.lineSpacing || 1.2}
                    onChange={(e) => updateTitleStyle('lineSpacing', parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />

                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="font-semibold text-slate-500">Title Padding (px)</span>
                    <span className="font-bold">{reportData.titleStyles.padding !== undefined ? reportData.titleStyles.padding : 10}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    value={reportData.titleStyles.padding !== undefined ? reportData.titleStyles.padding : 10}
                    onChange={(e) => updateTitleStyle('padding', parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />

                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="font-semibold text-slate-500">Border Radius (px)</span>
                    <span className="font-bold">{reportData.titleStyles.borderRadius || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={reportData.titleStyles.borderRadius || 0}
                    onChange={(e) => updateTitleStyle('borderRadius', parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Title Border settings */}
                <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-850 space-y-3">
                  <span className="text-xs font-bold text-slate-500 block mb-1">Border Styling</span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-slate-450 mb-0.5">Border Style</label>
                      <select
                        value={(reportData.titleStyles.border || 'none').split(' ')[1] || 'none'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'none') {
                            updateTitleStyle('border', 'none');
                          } else {
                            const width = (reportData.titleStyles.border || 'none').split(' ')[0] || '1px';
                            const color = (reportData.titleStyles.border || 'none').split(' ')[2] || '#d1d5db';
                            updateTitleStyle('border', `${width} ${val} ${color}`);
                          }
                        }}
                        className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded"
                      >
                        <option value="none">None</option>
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="double">Double</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] text-slate-450 mb-0.5">Border Width</label>
                      <select
                        value={(reportData.titleStyles.border || 'none').split(' ')[0] || '1px'}
                        onChange={(e) => {
                          const val = e.target.value;
                          const style = (reportData.titleStyles.border || 'none').split(' ')[1] || 'solid';
                          const color = (reportData.titleStyles.border || 'none').split(' ')[2] || '#d1d5db';
                          updateTitleStyle('border', `${val} ${style} ${color}`);
                        }}
                        className="w-full px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded"
                        disabled={reportData.titleStyles.border === 'none'}
                      >
                        <option value="1px">1px</option>
                        <option value="2px">2px</option>
                        <option value="3px">3px</option>
                        <option value="5px">5px</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-450 mb-0.5">Border Color</label>
                      <input
                        type="color"
                        value={(reportData.titleStyles.border || 'none').split(' ')[2] || '#d1d5db'}
                        onChange={(e) => {
                          const val = e.target.value;
                          const style = (reportData.titleStyles.border || 'none').split(' ')[1] || 'solid';
                          const width = (reportData.titleStyles.border || 'none').split(' ')[0] || '1px';
                          updateTitleStyle('border', `${width} ${style} ${val}`);
                        }}
                        className="w-full h-7 p-0 bg-transparent border border-slate-200 dark:border-slate-800 rounded"
                        disabled={reportData.titleStyles.border === 'none'}
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* TAB 1.5: INFORMATION TABLE MANAGEMENT */}
        {activeTab === 'infoTable' && reportData.infoTable && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-850 dark:text-white">Report Information Table Rows</h3>
              <button
                type="button"
                onClick={() => setShowInfoStyles(!showInfoStyles)}
                className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-805 dark:hover:bg-slate-700 rounded font-semibold text-slate-705 dark:text-slate-350 transition flex items-center gap-1"
              >
                <Settings size={12} />
                <span>{showInfoStyles ? 'Hide Table Styles' : 'Table Styling'}</span>
              </button>
            </div>

            {/* Table Styling Panel */}
            {showInfoStyles && (
              <div className="p-4 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 rounded-xl space-y-4 shadow-inner">
                <span className="text-xs font-bold text-slate-500 block border-b pb-1">Table Visual Styles</span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-450 mb-0.5">Font Family</label>
                    <select
                      value={reportData.infoTable.styles.fontFamily || 'Times New Roman'}
                      onChange={(e) => handleInfoTableStyleChange('fontFamily', e.target.value)}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded text-slate-800 dark:text-white"
                    >
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Arial">Arial</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Outfit">Outfit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-450 mb-0.5">Font Size (pt)</label>
                    <input
                      type="number"
                      min="8"
                      max="16"
                      value={reportData.infoTable.styles.fontSize || 11}
                      onChange={(e) => handleInfoTableStyleChange('fontSize', parseInt(e.target.value) || 11)}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 mb-0.5">Header Shading</label>
                    <input
                      type="color"
                      value={reportData.infoTable.styles.headerBg || '#f3f4f6'}
                      onChange={(e) => handleInfoTableStyleChange('headerBg', e.target.value)}
                      className="w-full h-8 p-0 bg-transparent cursor-pointer rounded border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 mb-0.5">Header Text Color</label>
                    <input
                      type="color"
                      value={reportData.infoTable.styles.headerColor || '#000000'}
                      onChange={(e) => handleInfoTableStyleChange('headerColor', e.target.value)}
                      className="w-full h-8 p-0 bg-transparent cursor-pointer rounded border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 mb-0.5">Zebra Row Color</label>
                    <input
                      type="color"
                      value={reportData.infoTable.styles.alternateRowColor || '#f9fafb'}
                      onChange={(e) => handleInfoTableStyleChange('alternateRowColor', e.target.value)}
                      className="w-full h-8 p-0 bg-transparent cursor-pointer rounded border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 mb-0.5">Key Column Width (%)</label>
                    <input
                      type="number"
                      min="20"
                      max="60"
                      value={reportData.infoTable.styles.colWidth || 35}
                      onChange={(e) => handleInfoTableStyleChange('colWidth', parseInt(e.target.value) || 35)}
                      className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                  <label className="flex items-center gap-1.5 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={reportData.infoTable.styles.showBorder}
                      onChange={(e) => handleInfoTableStyleChange('showBorder', e.target.checked)}
                      className="rounded"
                    />
                    <span>Show Gridlines</span>
                  </label>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-550">Border Thickness (px)</span>
                    <span className="font-bold">{reportData.infoTable.styles.borderThickness || 1}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={reportData.infoTable.styles.borderThickness || 1}
                    onChange={(e) => handleInfoTableStyleChange('borderThickness', parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />

                  <div className="flex justify-between items-center pt-1">
                    <span className="font-semibold text-slate-550">Cell Padding (px)</span>
                    <span className="font-bold">{reportData.infoTable.styles.cellPadding || 8}px</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="20"
                    step="1"
                    value={reportData.infoTable.styles.cellPadding || 8}
                    onChange={(e) => handleInfoTableStyleChange('cellPadding', parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />

                  <div className="flex justify-between items-center pt-1">
                    <span className="font-semibold text-slate-555">Row Height (px)</span>
                    <span className="font-bold">{reportData.infoTable.styles.rowHeight || 40}px</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="60"
                    step="2"
                    value={reportData.infoTable.styles.rowHeight || 40}
                    onChange={(e) => handleInfoTableStyleChange('rowHeight', parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Custom Field / Row Adder */}
            <div className="p-4 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 rounded-xl space-y-3 shadow-sm">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350 block">Append Custom Table Row</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newInfoName}
                  onChange={(e) => setNewInfoName(e.target.value)}
                  placeholder="Field Name (e.g. Chief Guest)"
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded text-xs text-slate-800 dark:text-white"
                />
                <input
                  type="text"
                  value={newInfoValue}
                  onChange={(e) => setNewInfoValue(e.target.value)}
                  placeholder="Field Value (e.g. Dr. Ramesh)"
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded text-xs text-slate-800 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={handleAddInfoRow}
                disabled={!newInfoName.trim()}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-bold text-xs transition"
              >
                + Add Table Row
              </button>
            </div>

            {/* List of Rows */}
            <div className="space-y-3">
              {[...reportData.infoTable.rows].sort((a, b) => a.order - b.order).map((row, idx, arr) => {
                const lowerName = row.name.toLowerCase();
                const isSemester = lowerName.includes('semester');
                const isQuarter = lowerName.includes('quarter');
                const isAcademicYear = lowerName.includes('academic year');

                // Standard predefined option lists
                const semOptions = ['I-I', 'I-II', 'II-I', 'II-II', 'III-I', 'III-II', 'IV-I', 'IV-II'];
                const quarterOptions = ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'];
                const ayOptions = ['2025–26', '2026–27', '2027–28'];

                const standardOptions = isSemester ? semOptions : (isQuarter ? quarterOptions : (isAcademicYear ? ayOptions : []));
                
                // Check if current value is standard or custom
                const isCustomValue = row.value && !standardOptions.includes(row.value);
                const dropdownInitial = isCustomValue ? 'custom' : (row.value || '');
                const textInitial = isCustomValue ? row.value : '';

                // Inline component to keep local select states isolated
                return (
                  <InfoRowEditorItem
                    key={row.id}
                    row={row}
                    idx={idx}
                    arr={arr}
                    standardOptions={standardOptions}
                    dropdownInitial={dropdownInitial}
                    textInitial={textInitial}
                    onMove={handleMoveInfoRow}
                    onDelete={handleDeleteInfoRow}
                    onVisibilityToggle={handleInfoRowToggleVisibility}
                    onRequiredToggle={handleInfoRowToggleRequired}
                    onValueChange={handleInfoRowChange}
                    onNameChange={(id, val) => handleInfoRowChange(id, 'name', val)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: FIELDS MANAGEMENT */}
        {activeTab === 'fields' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-850 dark:text-white">Activity Details (Table Rows)</h3>
              <span className="text-[10px] text-slate-400 font-semibold">{reportData.fields.length} Columns</span>
            </div>

            {/* Custom Field Adder */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="e.g. Name of Resource Person, Sponsor..."
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddField}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition flex items-center gap-1"
              >
                <Plus size={16} />
                <span>Add Row</span>
              </button>
            </div>

            {/* Fields List */}
            <div className="space-y-4">
              {[...reportData.fields].sort((a, b) => a.order - b.order).map((field, idx, arr) => (
                <div key={field.id} className="p-4 border border-slate-200 dark:border-slate-855 rounded-xl bg-white dark:bg-slate-955 space-y-3 shadow-sm hover:shadow transition">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        {field.heading}
                        {field.required && <span className="text-red-500 ml-1 font-bold">*</span>}
                      </span>
                      <label className="flex items-center gap-1 cursor-pointer select-none ml-3">
                        <input
                          type="checkbox"
                          checked={!!field.required}
                          onChange={() => handleToggleFieldRequired(field.id)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-slate-300"
                        />
                        <span className="text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400">Required</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveField(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveField(idx, 'down')}
                        disabled={idx === arr.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                      >
                        <ArrowDown size={14} />
                      </button>
                      {field.type === 'custom' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveField(field.id)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition ml-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Rich Text Editor for Field details */}
                  <div className={field.required && (!field.description || field.description.replace(/<[^>]*>/g, '').trim() === '') ? "border border-red-300 rounded-lg p-0.5 bg-red-550/5" : ""}>
                    <RichTextEditor
                      id={`rte_${field.id}`}
                      value={field.description}
                      onChange={(val) => handleFieldChange(field.id, val)}
                      placeholder={`Enter details for ${field.heading.toLowerCase()}...`}
                    />
                    {field.required && (!field.description || field.description.replace(/<[^>]*>/g, '').trim() === '') && (
                      <span className="text-[10px] text-red-500 font-semibold px-2 py-1 block">This field is required. Please enter a description.</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: PHOTOS GALLERY */}
        {activeTab === 'photos' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-850 dark:text-white mb-2">Upload Activity Photographs</h3>
              <p className="text-xs text-slate-400 mb-4">Upload PNG, JPG, or WEBP images. Images will be optimized and resized client-side to maintain system speed.</p>
              
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-350 hover:border-blue-500 rounded-xl cursor-pointer text-slate-400 hover:text-blue-500 bg-white dark:bg-slate-950 transition">
                <Upload size={24} />
                <span className="text-xs mt-2 font-semibold">Select Images to Append</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    files.forEach(file => {
                      const reader = new FileReader();
                      reader.onload = async (ev) => {
                        const base64 = ev.target?.result as string;
                        const compressed = await compressImage(base64);
                        handlePhotoUpload(compressed);
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {/* Photos List Grid */}
            <div className="space-y-4">
              {[...reportData.photos].sort((a, b) => a.order - b.order).map((photo, idx, arr) => (
                <div key={photo.id} className="p-3 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 rounded-xl flex gap-3 shadow-sm">
                  <div className="w-24 h-24 bg-slate-50 border border-slate-200 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                    <img src={photo.src} alt="Uploaded" className="max-h-full object-contain" />
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Photo Caption (Times New Roman)</label>
                      <input
                        type="text"
                        value={photo.caption}
                        onChange={(e) => handleUpdateCaption(photo.id, e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs font-serif"
                      />
                    </div>

                    <div className="flex justify-end gap-1.5 mt-2">
                      <button
                        type="button"
                        onClick={() => handleMovePhoto(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMovePhoto(idx, 'down')}
                        disabled={idx === arr.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: SIGNATURE SECTION */}
        {activeTab === 'signatures' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-850 dark:text-white">Institutional Signatures</h3>
              <span className="text-[10px] text-slate-450 font-semibold">{reportData.signatures.length} Blocks</span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newSignatureRole}
                onChange={(e) => setNewSignatureRole(e.target.value)}
                placeholder="e.g. Faculty Coordinator, HOD, Principal..."
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={handleAddSignatureRole}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition"
              >
                Add Box
              </button>
            </div>

            {/* Signature list */}
            <div className="space-y-4">
              {[...reportData.signatures].sort((a, b) => a.order - b.order).map((sig, idx, arr) => (
                <div key={sig.id} className="p-4 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 rounded-xl space-y-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{sig.designation}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveSignature(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveSignature(idx, 'down')}
                        disabled={idx === arr.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveSignature(sig.id)}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Authority Name</label>
                      <input
                        type="text"
                        value={sig.name}
                        onChange={(e) => handleSignatureDetailsChange(sig.id, 'name', e.target.value)}
                        placeholder="Dr. John Doe"
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">Change Designation</label>
                      <input
                        type="text"
                        value={sig.designation}
                        onChange={(e) => handleSignatureDetailsChange(sig.id, 'designation', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Signature Uploader vs Canvas Digital Sign pad */}
                  <div className="border border-slate-100 dark:border-slate-900 rounded-lg p-3 bg-slate-50 dark:bg-slate-950/50">
                    {sig.image ? (
                      <div className="flex items-center justify-between">
                        <div className="h-16 w-32 border border-slate-200 bg-white rounded overflow-hidden flex items-center justify-center p-1">
                          <img src={sig.image} alt="Signature" className="max-h-full object-contain mix-blend-multiply" />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSignatureDetailsChange(sig.id, 'image', '')}
                          className="flex items-center gap-1 px-2.5 py-1 bg-red-650 hover:bg-red-700 text-white rounded text-[10px] transition font-bold"
                        >
                          <Trash2 size={12} /> Remove Sign
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {/* Option A: Image Uploader */}
                        <label className="flex-1 flex flex-col items-center justify-center h-20 border border-dashed border-slate-300 hover:border-blue-500 rounded bg-white dark:bg-slate-900 cursor-pointer text-slate-400 hover:text-blue-500 transition">
                          <Upload size={16} />
                          <span className="text-[9px] mt-1 font-semibold">Upload Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, (base64) => handleUploadSignature(sig.id, base64))}
                            className="hidden"
                          />
                        </label>

                        {/* Option B: Digital Signature Sketchpad */}
                        <button
                          type="button"
                          onClick={() => openDrawingPad(sig.id)}
                          className="flex-1 flex flex-col items-center justify-center h-20 border border-dashed border-slate-305 hover:border-blue-550 hover:text-blue-550 rounded bg-white dark:bg-slate-900 text-slate-405 transition font-semibold"
                        >
                          <PenTool size={16} />
                          <span className="text-[9px] mt-1">Draw Digitally</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: DOCUMENT FOOTER */}
        {activeTab === 'footer' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-855 dark:text-white">Document Footer Details</h3>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={reportData.footer.visible !== false}
                  onChange={(e) => handleFooterChange('visible', e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-350"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">Show Footer in PDF</span>
              </label>
            </div>

            {reportData.footer.visible !== false ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Footer Text Note (e.g. Institutional Accreditation Code)</label>
                  <input
                    type="text"
                    value={reportData.footer.text}
                    onChange={(e) => handleFooterChange('text', e.target.value)}
                    placeholder="SJEC/IQAC/2026/AR-01"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Website URL</label>
                    <input
                      type="text"
                      value={reportData.footer.website}
                      onChange={(e) => handleFooterChange('website', e.target.value)}
                      placeholder="https://www.sjec.ac.in"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={reportData.footer.email}
                      onChange={(e) => handleFooterChange('email', e.target.value)}
                      placeholder="sjec@sjec.ac.in"
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-250 dark:border-slate-800 rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* QR Code Upload / Preset */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">QR Code Image</label>
                  {reportData.footer.qrCode ? (
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 border border-slate-200 bg-white p-1 rounded overflow-hidden flex items-center justify-center">
                        <img src={reportData.footer.qrCode} alt="QR Code" className="max-h-full object-contain" />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFooterChange('qrCode', '')}
                        className="px-2.5 py-1 bg-red-650 hover:bg-red-700 text-white rounded text-[10px] transition font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-slate-350 hover:border-blue-500 rounded bg-white dark:bg-slate-950 cursor-pointer text-slate-400 hover:text-blue-500 transition text-xs font-bold">
                      <Upload size={16} />
                      <span>Upload QR Code Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, (base64) => handleFooterChange('qrCode', base64))}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs text-slate-500 italic text-center border border-dashed border-slate-200 dark:border-slate-800">
                Footer is currently disabled. Check the "Show Footer in PDF" toggle above to configure and display the document footer.
              </div>
            )}
          </div>
        )}
      </div>

      {/* DRAWING PAD OVERLAY MODAL */}
      {drawingSigId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 w-full max-w-md shadow-2xl flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-white">Draw Signature</h3>
              <p className="text-xs text-slate-450 mt-0.5">Use your mouse or touch screen to draw your signature in the box.</p>
            </div>

            {/* Canvas Box */}
            <div className="border border-slate-300 dark:border-slate-700 bg-white rounded-lg overflow-hidden h-40">
              <canvas
                ref={canvasRef}
                width={380}
                height={160}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="w-full h-full cursor-crosshair"
              />
            </div>

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={clearDrawing}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-850 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition font-bold"
              >
                <RotateCcw size={14} /> Clear Canvas
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDrawingSigId(null)}
                  className="px-4 py-1.5 text-xs font-bold border border-slate-300 hover:bg-slate-100 rounded-lg dark:border-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveDrawing}
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  Apply Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

interface InfoRowEditorItemProps {
  row: any;
  idx: number;
  arr: any[];
  standardOptions: string[];
  dropdownInitial: string;
  textInitial: string;
  onMove: (idx: number, direction: 'up' | 'down') => void;
  onDelete: (id: string) => void;
  onVisibilityToggle: (id: string) => void;
  onRequiredToggle: (id: string) => void;
  onValueChange: (id: string, key: 'name' | 'value', val: string) => void;
  onNameChange: (id: string, val: string) => void;
}

const InfoRowEditorItem: React.FC<InfoRowEditorItemProps> = ({
  row,
  idx,
  arr,
  standardOptions,
  dropdownInitial,
  textInitial,
  onMove,
  onDelete,
  onVisibilityToggle,
  onRequiredToggle,
  onValueChange,
  onNameChange
}) => {
  const [selectVal, setSelectVal] = useState(dropdownInitial);
  const [customText, setCustomText] = useState(textInitial);

  // Sync state if initial values change
  useEffect(() => {
    setSelectVal(dropdownInitial);
    setCustomText(textInitial);
  }, [dropdownInitial, textInitial]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectVal(val);
    if (val !== 'custom') {
      onValueChange(row.id, 'value', val);
    } else {
      onValueChange(row.id, 'value', customText);
    }
  };

  const handleCustomTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomText(val);
    onValueChange(row.id, 'value', val);
  };

  return (
    <div className="p-3.5 border border-slate-200 dark:border-slate-850 rounded-xl bg-white dark:bg-slate-950 space-y-2.5 shadow-sm animate-fadeIn">
      {/* Header: drag reordering, flags */}
      <div className="flex items-center justify-between border-b dark:border-slate-800 pb-1.5 text-xs">
        <span className="font-bold text-slate-700 dark:text-slate-350">
          Row #{idx + 1} {row.required && <span className="text-red-500 font-bold">*</span>}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMove(idx, 'up')}
            disabled={idx === 0}
            className="p-0.5 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 rounded transition"
            title="Move Row Up"
          >
            <ArrowUp size={13} />
          </button>
          <button
            type="button"
            onClick={() => onMove(idx, 'down')}
            disabled={idx === arr.length - 1}
            className="p-0.5 text-slate-400 hover:text-slate-800 dark:hover:text-white disabled:opacity-30 rounded transition"
            title="Move Row Down"
          >
            <ArrowDown size={13} />
          </button>
          
          <label className="flex items-center gap-0.5 text-[10px] font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={row.visible}
              onChange={() => onVisibilityToggle(row.id)}
              className="rounded h-3 w-3 text-blue-650 focus:ring-0"
            />
            <span>Show</span>
          </label>
          
          <label className="flex items-center gap-0.5 text-[10px] font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={row.required}
              onChange={() => onRequiredToggle(row.id)}
              className="rounded h-3 w-3 text-red-600 focus:ring-0"
            />
            <span>Required</span>
          </label>

          <button
            type="button"
            onClick={() => onDelete(row.id)}
            className="p-0.5 text-red-500 hover:bg-red-55 dark:hover:bg-red-950/20 rounded transition"
            title="Delete Row"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">Field Name</label>
          <input
            type="text"
            value={row.name}
            onChange={(e) => onNameChange(row.id, e.target.value)}
            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-850 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 mb-0.5">Field Value</label>
          {standardOptions.length > 0 ? (
            <div className="space-y-1">
              <select
                value={selectVal}
                onChange={handleSelectChange}
                className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Select option --</option>
                {standardOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
                <option value="custom">Custom Value...</option>
              </select>
              {selectVal === 'custom' && (
                <input
                  type="text"
                  value={customText}
                  onChange={handleCustomTextChange}
                  placeholder="Enter custom value manually"
                  className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-blue-550 rounded text-xs text-slate-800 dark:text-white focus:outline-none"
                />
              )}
            </div>
          ) : (
            <input
              type="text"
              value={row.value || ''}
              onChange={(e) => onValueChange(row.id, 'value', e.target.value)}
              placeholder="Enter value"
              className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-800 dark:text-white"
            />
          )}
        </div>
      </div>
    </div>
  );
};
