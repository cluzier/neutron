import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Upload, Search, ChevronRight, ChevronDown, Folder, Archive, RotateCcw, Terminal } from 'lucide-react';

// FileTree component
function FileTree({ structure, onOpenFolder }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(structure.children || []);
  const [isLoading, setIsLoading] = useState(false);

  if (!structure) return null;

  const loadChildren = async () => {
    if (!expanded && structure.hasChildren && (!children || children.length === 0)) {
      setIsLoading(true);
      try {
        const contents = await window.electron.invoke('load-directory', structure.path);
        setChildren(contents);
      } catch (error) {
        console.error('Error loading directory contents:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleExpanded = async (e) => {
    e.stopPropagation();
    if (!expanded && structure.hasChildren) {
      await loadChildren();
    }
    setExpanded(!expanded);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onOpenFolder(structure.path);
  };

  return (
    <div className="pl-4">
      <div 
        className="flex items-center gap-2 py-1 hover:bg-primary/5 rounded cursor-pointer group"
        onClick={handleClick}
      >
        {structure.type === 'directory' && (
          <button
            onClick={toggleExpanded}
            className="p-1 hover:bg-primary/10 rounded"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{structure.name}</span>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 h-6 w-6"
          onClick={handleClick}
        >
          <Search className="h-3 w-3" />
        </Button>
      </div>
      {structure.type === 'directory' && expanded && (
        <div className="border-l">
          {children.map((child, index) => (
            <FileTree
              key={child.path + index}
              structure={child}
              onOpenFolder={onOpenFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function App() {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [appIcon, setAppIcon] = useState(null);
  const [extractionState, setExtractionState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const dropZoneRef = useRef(null);
  const logsEndRef = useRef(null);
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef(null);

  // Theme handling
  useEffect(() => {
    // Get initial theme
    window.electron.getTheme().then(isDark => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });

    // Listen for theme changes
    const cleanup = window.electron.onThemeChange(isDark => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });

    return cleanup;
  }, []);

  useEffect(() => {
    // Simulate initial load
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Load app icon when result changes
    if (result?.isElectronApp && result.appIconPath) {
      window.electron.invoke('get-app-icon', result.appIconPath)
        .then(iconDataUrl => {
          setAppIcon(iconDataUrl);
        })
        .catch(console.error);
    } else {
      setAppIcon(null);
    }
  }, [result]);

  // Add log handler
  useEffect(() => {
    const handleLog = (_, message) => {
      setLogs(prev => [...prev, message]);
    };

    window.electron.onLog(handleLog);
    return () => window.electron.removeLogListener(handleLog);
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (logsEndRef.current && showLogs) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLogs]);

  const handleAppSelection = async () => {
    setIsAnalyzing(true);
    try {
      const result = await window.electron.selectApp();
      setResult(result);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileDrop = async (filePath) => {
    setIsAnalyzing(true);
    try {
      const result = await window.electron.handleDrop(filePath);
      setResult(result);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOpenFolder = async (folderPath) => {
    await window.electron.openFolder(folderPath);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
      const file = files[0];
      if (file.path && file.path.endsWith('.app')) {
        handleFileDrop(file.path);
      } else {
        setResult({
          isElectronApp: false,
          message: 'Please drop an application (.app) file.'
        });
      }
    }
  };

  const handleExtractAsar = async (asarPath) => {
    try {
      const result = await window.electron.extractAsar(asarPath);
      if (result.success) {
        setExtractionState({
          isExtracted: true,
          extractedPath: result.extractedPath,
          originalPath: result.originalPath
        });
      } else {
        console.error('Failed to extract:', result.error);
      }
    } catch (error) {
      console.error('Error during extraction:', error);
    }
  };

  const handleRestoreAsar = async () => {
    if (!extractionState?.originalPath) return;

    try {
      const result = await window.electron.restoreAsar(extractionState.originalPath);
      if (result.success) {
        setExtractionState(null);
      } else {
        console.error('Failed to restore:', result.error);
      }
    } catch (error) {
      console.error('Error during restoration:', error);
    }
  };

  const handleTitleBarClick = () => {
    clickCountRef.current += 1;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1000);
    if (clickCountRef.current === 5) {
      clickCountRef.current = 0;
      if (window?.electron?.openDevTools) {
        window.electron.openDevTools();
      } else if (window?.require) {
        // fallback for Electron context
        const { remote } = window.require('electron');
        remote.getCurrentWindow().webContents.openDevTools();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8 animate-fade-in">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-[250px]" />
            <Skeleton className="h-4 w-[300px]" />
          </div>
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-foreground flex flex-col">
      {/* Custom draggable title bar */}
      <div className="w-full h-10 flex items-center px-8 pt-8 select-none" style={{ WebkitAppRegion: 'drag' }} onClick={handleTitleBarClick}>
        <span className="font-semibold text-lg">Neutron</span>
      </div>
      <div className="flex items-center justify-center" style={{ WebkitAppRegion: 'no-drag' }}>
        <div className="max-w-[1200px] w-full mx-auto p-8">
          <div className="space-y-2 mb-8">
            <p className="text-muted-foreground">
              Drop an application or click to select one to analyze it's Electron structure.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-8">
              <div
                ref={dropZoneRef}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`border-2 border-dashed rounded-lg p-8 text-center space-y-4 transition-colors ${
                  isAnalyzing ? 'border-primary bg-primary/5' : 'hover:border-primary'
                }`}
              >
                <div className="mx-auto w-12 h-12 text-muted-foreground">
                  <Upload className={`w-full h-full ${isAnalyzing ? 'animate-bounce' : ''}`} />
                </div>
                <p className="text-muted-foreground">
                  {isAnalyzing ? 'Analyzing application...' : 'Drag and drop your application here, or'}
                </p>
                <Button 
                  onClick={handleAppSelection} 
                  variant="outline"
                  disabled={isAnalyzing}
                >
                  Select Application
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="w-full flex items-center gap-2 p-3 bg-muted hover:bg-muted/80 transition-colors text-sm font-medium"
                >
                  <Terminal className="w-4 h-4" />
                  Analysis Logs
                  {showLogs ? (
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </button>
                {showLogs && (
                  <div className="max-h-[300px] overflow-auto bg-zinc-950 p-4 font-mono text-xs text-white">
                    {logs.map((log, i) => (
                      <div key={i} className="whitespace-pre-wrap">
                        {log}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </div>

            {result && (
              <div className={`p-6 rounded-lg border h-fit ${
                result.isElectronApp 
                  ? 'bg-blue-50 border-blue-200 dark:bg-primary/10 dark:border-primary' 
                  : 'bg-red-50 border-red-200 dark:bg-destructive/10 dark:border-destructive'
              }`}>
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  {result.isElectronApp ? (
                    <>
                      {appIcon ? (
                        <img src={appIcon} alt={`${result.appName} icon`} className="w-6 h-6 object-contain" />
                      ) : (
                        <span>🎉</span>
                      )}
                      <span>{result.appName} is an Electron application</span>
                    </>
                  ) : (
                    <>❌ {result.message}</>
                  )}
                </h3>
                {result.isElectronApp && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">
                        {result.unpackedPath ? 'This application uses an unpacked asar archive located at:' : 'The app.asar file is located at:'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 block p-2 bg-white dark:bg-muted rounded text-sm break-all border border-border">
                        {result.unpackedPath || result.asarPath}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenFolder(result.unpackedPath || result.asarPath)}
                        className="shrink-0"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Extraction controls */}
                    {result.asarPath && !result.unpackedPath && (
                      <div className="mt-4 space-y-4">
                        <div className="flex items-center gap-2">
                          {!extractionState?.isExtracted ? (
                            <Button
                              onClick={() => handleExtractAsar(result.asarPath)}
                              variant="secondary"
                              className="w-full sm:w-auto"
                            >
                              <Archive className="w-4 h-4 mr-2" />
                              Extract app.asar for Development
                            </Button>
                          ) : (
                            <>
                              <div className="flex-1">
                                <p className="text-sm text-muted-foreground mb-2">
                                  App extracted to:
                                </p>
                                <code className="block p-2 bg-white dark:bg-muted rounded text-sm break-all border border-border">
                                  {extractionState.extractedPath}
                                </code>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenFolder(extractionState.extractedPath)}
                                className="shrink-0"
                              >
                                <Search className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                        {extractionState?.isExtracted && (
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={handleRestoreAsar}
                              variant="outline"
                              className="w-full sm:w-auto"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Restore Original app.asar
                            </Button>
                            <p className="text-sm text-muted-foreground">
                              Original file backed up at: <code className="px-1 py-0.5 bg-white dark:bg-muted rounded border border-border">{extractionState.originalPath}</code>
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {result.structure && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium mb-2">Application Structure</h4>
                        <div className="border rounded-lg p-4 bg-white dark:bg-card">
                          <FileTree 
                            structure={result.structure} 
                            onOpenFolder={handleOpenFolder}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 