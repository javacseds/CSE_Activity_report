import React, { useRef, useEffect } from 'react';
import { 
  Bold, Italic, Underline, List, ListOrdered, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify, 
  ChevronLeft, ChevronRight, Undo, Redo
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  id?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  value, 
  onChange, 
  placeholder = 'Enter description here...',
  id 
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Focus and insert text if empty initial state
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const executeCommand = (command: string, argument: string = '') => {
    document.execCommand(command, false, argument);
    handleEditorChange();
  };

  const handleEditorChange = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // Clean HTML text pasted from Word or PDFs
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clipboardData = e.clipboardData;
    const htmlData = clipboardData.getData('text/html');
    const plainText = clipboardData.getData('text/plain');

    let cleanedHTML = '';

    if (htmlData) {
      // Create a sandbox element to clean the HTML structure
      const div = document.createElement('div');
      div.innerHTML = htmlData;

      // Clean inline styles but preserve semantic structure
      const cleanElement = (el: HTMLElement) => {
        // Remove style and class attributes to avoid breaking formatting
        el.removeAttribute('style');
        el.removeAttribute('class');
        
        // Remove Word XML nodes
        if (el.tagName.startsWith('O:') || el.tagName.startsWith('W:')) {
          el.outerHTML = el.innerHTML;
          return;
        }

        // Apply cleaning to children
        const children = Array.from(el.children) as HTMLElement[];
        children.forEach(cleanElement);
      };

      Array.from(div.children).forEach((child) => {
        if (child instanceof HTMLElement) {
          cleanElement(child);
        }
      });

      cleanedHTML = div.innerHTML;
    } else {
      // Fallback for plain text: wrap paragraphs correctly
      cleanedHTML = plainText
        .split('\n')
        .map(para => para.trim() ? `<p>${para.trim()}</p>` : '')
        .join('');
    }

    // Sanitize and normalize extra spaces
    cleanedHTML = cleanedHTML
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Insert the sanitized markup at cursor
    document.execCommand('insertHTML', false, cleanedHTML);
    handleEditorChange();
  };

  return (
    <div className="w-full border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col bg-white dark:bg-slate-900 transition-colors duration-150">
      {/* Formatting Toolbar (no-print so it hides on browser print) */}
      <div className="no-print flex flex-wrap gap-1 p-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 items-center select-none text-slate-700 dark:text-slate-300">
        <button
          type="button"
          onClick={() => executeCommand('bold')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('italic')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Italic"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('underline')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Underline"
        >
          <Underline size={16} />
        </button>

        <div className="w-[1px] h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => executeCommand('insertUnorderedList')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('insertOrderedList')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>

        <div className="w-[1px] h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => executeCommand('justifyLeft')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Align Left"
        >
          <AlignLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('justifyCenter')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Align Center"
        >
          <AlignCenter size={16} />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('justifyRight')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Align Right"
        >
          <AlignRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('justifyFull')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Justify"
        >
          <AlignJustify size={16} />
        </button>

        <div className="w-[1px] h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => executeCommand('outdent')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Decrease Indent"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('indent')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Increase Indent"
        >
          <ChevronRight size={16} />
        </button>

        <div className="w-[1px] h-5 bg-slate-300 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => executeCommand('undo')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Undo"
        >
          <Undo size={16} />
        </button>
        <button
          type="button"
          onClick={() => executeCommand('redo')}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          title="Redo"
        >
          <Redo size={16} />
        </button>
      </div>

      {/* Editor Editable Canvas */}
      <div
        id={id}
        ref={editorRef}
        contentEditable
        onBlur={handleEditorChange}
        onInput={handleEditorChange}
        onPaste={handlePaste}
        className="editor-canvas p-4 min-h-[160px] max-h-[400px] overflow-y-auto focus:outline-none text-slate-800 dark:text-slate-100 font-serif text-[12pt] leading-relaxed select-text"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
        data-placeholder={placeholder}
      />
    </div>
  );
};
