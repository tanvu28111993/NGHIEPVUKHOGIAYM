import React, { useState } from 'react';
import { PaperRoll, User, ReImportItem } from '../types';
import Scanner from './Scanner';
import LocationView from './LocationView';
import ReImportView from './ReImportView';
import ExportView from './ExportView';

interface DashboardProps {
    user: User;
    foundItem: PaperRoll | null;
    searchError: boolean;
    isLoading: boolean;
    onSearch: (code: string) => void;
    onLogout: () => void;
    onClearResult: () => void;
    onUpdateItem: (field: keyof PaperRoll, value: string | number) => void;
    onSaveUpdate: (overrideItem?: PaperRoll, targetSheet?: string) => void;
    onSaveReImport?: (items: ReImportItem[]) => void;
    onSaveExport?: (items: ReImportItem[]) => void;
    onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
    queueLength: number;
    sessionTotal: number;
    isSyncing: boolean;
    onSync: () => void;
}

type PageView = 'LOCATION' | 'EXPORT' | 'RE_IMPORT';

const Dashboard: React.FC<DashboardProps> = React.memo(({ 
    user, foundItem, searchError, isLoading,
    onSearch, onLogout, onClearResult, onUpdateItem, onSaveUpdate, onSaveReImport, onSaveExport, onNotify, 
    queueLength, sessionTotal, isSyncing, onSync
}) => {
    // UI State
    const [showScanner, setShowScanner] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentView, setCurrentView] = useState<PageView>('LOCATION');
    
    // Re-Import State
    const [reImportItems, setReImportItems] = useState<ReImportItem[]>([]);

    // Export State (NEW)
    const [exportItems, setExportItems] = useState<ReImportItem[]>([]);

    // Calculate Sync Progress
    const itemsDone = sessionTotal > 0 ? (sessionTotal - queueLength) : 0;
    const progressPercentage = sessionTotal > 0 ? Math.min(100, Math.max(0, (itemsDone / sessionTotal) * 100)) : 0;

    // --- NAVIGATION HANDLERS ---
    const handleViewChange = (view: PageView) => {
        setCurrentView(view);
        setIsMenuOpen(false);
        onClearResult(); 
    };

    const getHeaderTitle = () => {
        switch (currentView) {
            case 'LOCATION': return 'Tra Cứu Vị Trí';
            case 'EXPORT': return 'Xuất Kho';
            case 'RE_IMPORT': return 'Nhập Lại Kho';
            default: return 'Nghiệp Vụ Kho Giấy';
        }
    };

    const getHeaderIcon = () => {
        switch (currentView) {
            case 'LOCATION': return 'manage_search';
            case 'EXPORT': return 'output';
            case 'RE_IMPORT': return 'directory_sync';
            default: return 'warehouse';
        }
    };

    // --- RE-IMPORT LOGIC ---
    const addReImportItem = (sku: string) => {
        if (!sku.trim()) return;
        const newItem: ReImportItem = {
            id: `ri-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sku: sku.trim(),
            weight: '', 
            quantity: 1 
        };
        setReImportItems(prev => [newItem, ...prev]);
        if (navigator.vibrate) navigator.vibrate(50);
    };

    const updateReImportItem = (id: string, field: keyof ReImportItem, value: string | number) => {
        setReImportItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };
    
    const removeReImportItem = (id: string) => {
        setReImportItems(prev => prev.filter(i => i.id !== id));
    };

    const handleSaveReImportSession = () => {
        if (reImportItems.length === 0) return;
        if (onSaveReImport) {
            onSaveReImport(reImportItems);
        }
        setReImportItems([]);
        if (navigator.vibrate) navigator.vibrate([50, 50]);
    };

    // --- EXPORT LOGIC (Copied from Re-Import but separate state) ---
    const addExportItem = (sku: string) => {
        if (!sku.trim()) return;
        const newItem: ReImportItem = {
            id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            sku: sku.trim(),
            weight: '', 
            quantity: 1 
        };
        setExportItems(prev => [newItem, ...prev]);
        if (navigator.vibrate) navigator.vibrate(50);
    };

    const updateExportItem = (id: string, field: keyof ReImportItem, value: string | number) => {
        setExportItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };
    
    const removeExportItem = (id: string) => {
        setExportItems(prev => prev.filter(i => i.id !== id));
    };

    const handleSaveExportSession = () => {
        if (exportItems.length === 0) return;
        if (onSaveExport) {
            onSaveExport(exportItems);
        }
        setExportItems([]);
        if (navigator.vibrate) navigator.vibrate([50, 50]);
    };

    // --- SCANNER HANDLER ---
    const handleScanSuccess = (decodedText: string) => {
        setShowScanner(false);
        if (decodedText) {
             if (currentView === 'RE_IMPORT') {
                 addReImportItem(decodedText);
             } else if (currentView === 'EXPORT') {
                 addExportItem(decodedText);
             } else {
                 onSearch(decodedText);
             }
        }
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-[#0a0a0a] text-white relative overflow-hidden">
            
            {showScanner && (
                <Scanner 
                    onScanSuccess={handleScanSuccess} 
                    onClose={() => setShowScanner(false)}
                    onError={(msg) => onNotify(msg, 'error')}
                />
            )}

            {/* --- SIDEBAR DRAWER --- */}
            <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsMenuOpen(false)}
            ></div>

            <div className={`fixed top-0 bottom-0 left-0 w-[85%] max-w-[320px] bg-[#121212] z-[70] shadow-[10px_0_40px_rgba(0,0,0,0.8)] transform transition-transform duration-300 ease-out border-r border-white/10 flex flex-col ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-8 border-b border-white/5 flex flex-col items-center pt-safe-top bg-gradient-to-b from-[#1a1a1a] to-[#121212]">
                    <div className="w-24 h-24 mb-4 bg-white/5 rounded-full p-5 border border-white/5 shadow-inner">
                        <img src="https://i.postimg.cc/8zF3c24h/image.png" alt="Logo" className="w-full h-full object-contain drop-shadow-lg" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-wide text-white">Kho Giấy App</h2>
                    <div className="flex items-center gap-2 mt-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wide">{user.name}</p>
                    </div>
                </div>

                <div className="flex-1 p-5 space-y-3 overflow-y-auto">
                    {[
                        { id: 'LOCATION', icon: 'manage_search', label: 'Tra Cứu', sub: 'Tìm & Cập nhật vị trí' },
                        { id: 'EXPORT', icon: 'output', label: 'Xuất Kho', sub: 'Xuất hàng sản xuất' },
                        { id: 'RE_IMPORT', icon: 'directory_sync', label: 'Nhập Lại Kho', sub: 'Nhập hàng trả về' }
                    ].map((item) => (
                        <button 
                            key={item.id}
                            onClick={() => handleViewChange(item.id as PageView)}
                            className={`w-full flex items-center gap-5 px-6 py-5 rounded-2xl transition-all duration-300 border ${currentView === item.id ? 'bg-gradient-to-r from-brand to-brand/80 border-transparent text-white shadow-xl shadow-brand/20' : 'bg-transparent border-transparent text-gray-500 hover:bg-white/5 hover:text-white'}`}
                        >
                            <span className="material-symbols-outlined text-3xl">{item.icon}</span>
                            <div className="flex flex-col items-start">
                                <span className="text-base font-black tracking-wider uppercase">{item.label}</span>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${currentView === item.id ? 'text-white/80' : 'text-gray-600'}`}>{item.sub}</span>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="p-5 border-t border-white/5 pb-safe-bottom">
                     <button 
                        onClick={onLogout} 
                        className="relative w-full flex items-center justify-center gap-3 px-6 py-5 rounded-2xl bg-gradient-to-br from-[#ff4d4d] to-[#b30000] text-white shadow-[0_8px_25px_-5px_rgba(220,38,38,0.5)] border-t border-white/20 hover:shadow-[0_12px_30px_-5px_rgba(220,38,38,0.7)] active:scale-[0.96] transition-all duration-300 group overflow-hidden"
                     >
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 animate-[scan_3s_infinite_linear] opacity-20"></div>
                        <span className="material-symbols-outlined font-bold text-2xl group-hover:-translate-x-1 transition-transform relative z-10 drop-shadow-sm">logout</span>
                        <span className="font-black text-sm uppercase tracking-[0.2em] relative z-10 drop-shadow-sm">Đăng Xuất</span>
                    </button>
                </div>
            </div>

            {/* --- MAIN HEADER --- */}
            <header className="bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex justify-between items-center sticky top-0 z-50 pt-safe-top">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <button 
                        onClick={() => setIsMenuOpen(true)}
                        className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 active:scale-95 transition-all p-2 -ml-1 shadow-sm cursor-pointer hover:bg-white/10 group shrink-0"
                    >
                         <img src="https://i.postimg.cc/8zF3c24h/image.png" alt="Menu" className="w-full h-full object-contain group-hover:opacity-80 transition-opacity" />
                    </button>

                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="material-symbols-outlined text-brand text-[18px] animate-pulse shrink-0">{getHeaderIcon()}</span>
                        <h2 className="font-black text-[15px] leading-none uppercase tracking-wide text-gray-200 truncate">{getHeaderTitle()}</h2>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0 ml-2">
                    <div className="flex items-center gap-2 bg-white/5 pr-3 pl-2 py-1 rounded-full border border-white/5 w-fit max-w-[120px]">
                            <span className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider truncate">{user.name}</span>
                    </div>

                    <button 
                        onClick={onSync}
                        disabled={queueLength === 0}
                        className={`
                            relative overflow-hidden flex items-center gap-2 px-3 h-10 rounded-xl border transition-all duration-300 shrink-0
                            ${queueLength > 0 
                                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 cursor-pointer hover:bg-yellow-500/20 active:scale-95' 
                                : 'bg-green-500/10 border-green-500/20 text-green-500 cursor-default'}
                        `}
                    >
                        {queueLength > 0 && sessionTotal > 0 && (
                            <div 
                                className="absolute left-0 top-0 bottom-0 bg-yellow-500/10 transition-all duration-500 ease-out z-0"
                                style={{ width: `${progressPercentage}%` }}
                            ></div>
                        )}

                        <div className="relative z-10 flex items-center gap-2">
                            {isSyncing ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span className="material-symbols-outlined text-xl">
                                    {queueLength > 0 ? 'cloud_upload' : 'cloud_done'}
                                </span>
                            )}
                            
                            {queueLength > 0 ? (
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-[9px] font-bold uppercase opacity-80 mb-0.5">Đồng bộ</span>
                                    <span className="text-[11px] font-black tracking-wider">
                                        {itemsDone}/{sessionTotal}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-[11px] font-bold hidden sm:inline-block">Đã xong</span>
                            )}
                        </div>
                    </button>
                </div>
            </header>

            {/* --- MAIN CONTENT AREA --- */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-32 scroll-smooth">
                {currentView === 'LOCATION' && (
                    <LocationView 
                        foundItem={foundItem}
                        searchError={searchError}
                        isLoading={isLoading}
                        onSearch={onSearch}
                        onClearResult={onClearResult}
                        onUpdateItem={onUpdateItem}
                        onSaveUpdate={onSaveUpdate}
                        onOpenScanner={() => setShowScanner(true)}
                    />
                )}

                {currentView === 'EXPORT' && (
                     <ExportView 
                        items={exportItems}
                        onAddItem={addExportItem}
                        onRemoveItem={removeExportItem}
                        onUpdateItem={updateExportItem}
                        onSaveSession={handleSaveExportSession}
                        onOpenScanner={() => setShowScanner(true)}
                    />
                )}

                {currentView === 'RE_IMPORT' && (
                    <ReImportView 
                        items={reImportItems}
                        onAddItem={addReImportItem}
                        onRemoveItem={removeReImportItem}
                        onUpdateItem={updateReImportItem}
                        onSaveSession={handleSaveReImportSession}
                        onOpenScanner={() => setShowScanner(true)}
                    />
                )}
            </div>
        </div>
    );
});

export default Dashboard;