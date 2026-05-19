'use client';

import { Button } from '@/components/ui/button';
import { Loader, Upload, FileText, Trash2, RefreshCw } from 'lucide-react';

interface ReanalyzePanelProps {
  files:         File[];
  loading:       boolean;
  inputRef:      React.RefObject<HTMLInputElement | null>;
  onFilesChange: (files: File[]) => void;
  onReanalyze:   () => void;
}

export function ReanalyzePanel({ files, loading, inputRef, onFilesChange, onReanalyze }: ReanalyzePanelProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload additional supporting documents (medical records, invoices, ID proof, official letters)
        then re-run the AI analysis to improve your score.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          if (!e.target.files) return;
          const added = Array.from(e.target.files).slice(0, 5 - files.length);
          onFilesChange([...files, ...added]);
          // reset so same file can be re-selected
          e.target.value = '';
        }}
      />

      {files.length < 5 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-24 border-2 border-dashed border-muted rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
        >
          <Upload className="w-5 h-5" />
          <span className="text-sm">Click to add documents (PDF, image — max 5 files)</span>
        </button>
      )}

      {files.map((file, i) => (
        <div key={i} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground shrink-0">({(file.size / 1024).toFixed(0)} KB)</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFilesChange(files.filter((_, j) => j !== i))}
          >
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      ))}

      <Button
        onClick={onReanalyze}
        disabled={loading || files.length === 0}
        className="w-full gap-2"
      >
        {loading
          ? <><Loader className="w-4 h-4 animate-spin" /> Re-analyzing…</>
          : <><RefreshCw className="w-4 h-4" /> Re-analyze with New Documents</>}
      </Button>
    </div>
  );
}
