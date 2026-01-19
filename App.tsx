
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import NotificationSystem from './components/NotificationSystem';
import { PaperRoll, ViewState, User, Notification, ReImportItem } from './types';
import { storage } from './storage';
import { api } from './api';

interface QueueItem {
    id: string;
    data: any; // Data là object tùy biến, không bắt buộc đủ các trường của ReImportItem
    timestamp: number;
    retryCount: number;
    targetSheet?: string;
}

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const BATCH_SIZE = 5; 
const DEFAULT_TARGET_SHEET = 'KHO';
const RE_IMPORT_TARGET_SHEET = 'SKUN';
const EXPORT_TARGET_SHEET = 'SKUX';

const App: React.FC = () => {
    const [view, setView] = useState<ViewState>('LOGIN');
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);
    
    // User State
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    
    // Search State
    const [foundItem, setFoundItem] = useState<PaperRoll | null>(null);
    const [searchError, setSearchError] = useState<boolean>(false);
    
    // DATA CACHING LAYER
    const [dataCache, setDataCache] = useState<Map<string, PaperRoll>>(new Map());

    // OFFLINE QUEUE
    const [offlineQueue, setOfflineQueue] = useState<QueueItem[]>([]);
    
    // SYNC PROGRESS STATE
    const [sessionTotal, setSessionTotal] = useState(0); 
    const [isSyncing, setIsSyncing] = useState(false); 

    // Storage Ready Flag
    const [isStorageReady, setIsStorageReady] = useState(false);

    // Notification State
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // --- SYNC LOGIC STATE ---
    const [syncIntervalMs, setSyncIntervalMs] = useState(10000); 
    const isSyncingRef = useRef(false);

    const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now().toString();
        const newNotification = { id, message, type };
        
        setNotifications(prev => [...prev, newNotification]);
        setTimeout(() => {
            setNotifications(current => current.filter(n => n.id !== id));
        }, 3000); 
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // Manual Logout Handler
    const handleLogout = useCallback((reason?: string) => {
        setView('LOGIN');
        setCurrentUser(null);
        setFoundItem(null);
        setSearchError(false);
        storage.removeUser();
        showNotification(reason || 'Đã đăng xuất thành công', 'info');
    }, [showNotification]);

    // 0. SESSION INACTIVITY TIMER
    useEffect(() => {
        if (!currentUser || view !== 'DASHBOARD') return;

        let timeoutId: ReturnType<typeof setTimeout>;

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                handleLogout('Phiên làm việc hết hạn (30 phút)');
            }, INACTIVITY_LIMIT_MS);
        };

        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        resetTimer();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [currentUser, view, handleLogout]);

    // 0.5 DATA SAFETY
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (offlineQueue.length > 0) {
                const msg = "Dữ liệu chưa được đồng bộ hết! Bạn có chắc chắn muốn thoát?";
                e.preventDefault();
                e.returnValue = msg;
                return msg;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [offlineQueue.length]);

    // 1. INIT
    useEffect(() => {
        const initData = async () => {
            try {
                const user = await storage.getUser();
                if (user) {
                    setCurrentUser(user);
                    setView('DASHBOARD');
                    console.log("[Storage] Auto-login successful");
                }

                const cachedData = await storage.getCache();
                if (cachedData.size > 0) {
                    setDataCache(cachedData);
                    console.log(`[Storage] Loaded ${cachedData.size} items`);
                }

                const queue = await storage.getQueue();
                setOfflineQueue(queue);
                if (queue.length > 0) {
                    setSessionTotal(queue.length);
                }

            } catch (e) {
                console.error("Failed to initialize storage", e);
            } finally {
                setIsStorageReady(true);
            }
        };

        initData();
    }, []);

    // 2. PERSISTENCE
    useEffect(() => {
        if (!isStorageReady) return;
        storage.setCache(dataCache);
    }, [dataCache, isStorageReady]);

    useEffect(() => {
        if (!isStorageReady) return;
        storage.setQueue(offlineQueue);
    }, [offlineQueue, isStorageReady]);

    useEffect(() => {
        if (offlineQueue.length === 0) {
            setSessionTotal(0);
            setIsSyncing(false);
        }
    }, [offlineQueue.length]);

    // 4. SMART SYNC WORKER (Using FETCH API)
    const processSyncQueue = useCallback(async () => {
        if (offlineQueue.length === 0 || isSyncingRef.current || !navigator.onLine) {
            return;
        }

        isSyncingRef.current = true;
        setIsSyncing(true);
        
        const firstItem = offlineQueue[0];
        const currentTargetSheet = firstItem.targetSheet || DEFAULT_TARGET_SHEET;

        // Group items by target sheet
        const batch = offlineQueue
            .filter(item => 
                (item.targetSheet || DEFAULT_TARGET_SHEET) === currentTargetSheet
            )
            .slice(0, BATCH_SIZE);
        
        // Flatten payload (data trong queueItem đã được xử lý sạch sẽ ở các hàm handleSave)
        const payload = batch.flatMap(b => Array.isArray(b.data) ? b.data : [b.data]);
        const processedIds = new Set(batch.map(b => b.id));
        
        console.log(`[SyncWorker] Sending batch of ${batch.length} items to '${currentTargetSheet}'...`);

        try {
            const result = await api.saveBatch(payload, currentTargetSheet);
            
            if (result && result.success) {
                // Success
                setOfflineQueue(prev => prev.filter(item => !processedIds.has(item.id)));
                showNotification(`Đã cập nhật ${payload.length} dòng vào '${currentTargetSheet}'`, 'success');
                setSyncIntervalMs(1000); 
            } else {
                throw new Error(result.message || "Unknown API error");
            }

        } catch (error) {
            console.error(`[SyncWorker] Batch failed`, error);
            setSyncIntervalMs(prev => Math.min(prev * 2, 300000));
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }

    }, [offlineQueue, syncIntervalMs, showNotification]);

    // Trigger Sync Loop
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (offlineQueue.length > 0) {
            timeoutId = setTimeout(() => {
                processSyncQueue();
            }, syncIntervalMs);
        } else {
            if (syncIntervalMs !== 10000) setSyncIntervalMs(10000);
        }
        return () => clearTimeout(timeoutId);
    }, [offlineQueue, syncIntervalMs, processSyncQueue]);

    useEffect(() => {
        const handleOnline = () => {
            if (offlineQueue.length > 0) {
                setSyncIntervalMs(100); 
            }
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [offlineQueue.length]);

    const handleManualSync = useCallback(() => {
        if (!navigator.onLine) {
            showNotification('Không có kết nối mạng!', 'error');
            return;
        }
        if (offlineQueue.length === 0) {
            showNotification('Tất cả dữ liệu đã được đồng bộ', 'success');
            return;
        }
        showNotification('Đang đồng bộ dữ liệu...', 'info');
        setSyncIntervalMs(100);
    }, [offlineQueue, showNotification]);

    const handleLogin = (username: string) => {
        const newUser: User = {
            id: `user-${Date.now()}`,
            name: username,
            role: 'staff'
        };
        setCurrentUser(newUser);
        storage.setUser(newUser); 
        showNotification(`Xin chào, ${username}!`, 'success');
        setView('DASHBOARD');
    };

    const updateCache = useCallback((item: PaperRoll) => {
        setDataCache(prev => {
            const newCache = new Map(prev);
            if (item.sku) newCache.set(item.sku.toLowerCase(), item);
            if (item.packageId) newCache.set(item.packageId.toLowerCase(), item);
            return newCache;
        });
    }, []);

    // API SEARCH HANDLER
    const handleSearch = useCallback(async (code: string) => {
        const normalizedCode = code.trim().toLowerCase();
        setFoundItem(null);
        setSearchError(false);

        // Check Cache First
        if (dataCache.has(normalizedCode)) {
            const cachedResult = dataCache.get(normalizedCode);
            if (cachedResult) {
                console.log("Serving from Cache:", normalizedCode);
                setFoundItem(cachedResult);
                if (navigator.vibrate) navigator.vibrate(50);
                return;
            }
        }

        setIsLoadingSearch(true);

        try {
            const result = await api.search(code);
            
            setIsLoadingSearch(false);

            if (result.success && result.found && result.data) {
                setFoundItem(result.data);
                updateCache(result.data); 
                if (navigator.vibrate) navigator.vibrate(50);
            } else {
                setSearchError(true);
                showNotification(`Không tìm thấy mã: ${code}`, 'error');
            }

        } catch (error: any) {
            setIsLoadingSearch(false);
            setSearchError(true);
            showNotification("Lỗi kết nối: " + error.message, 'error');
        }

    }, [showNotification, dataCache, updateCache]);

    const handleUpdateItem = useCallback((field: keyof PaperRoll, value: string | number) => {
        setFoundItem(current => {
            if (!current) return null;
            const updatedItem = { ...current, [field]: value };
            updateCache(updatedItem); 
            return updatedItem;
        });
    }, [updateCache]);

    const handleClearResult = useCallback(() => {
        setFoundItem(null);
        setSearchError(false);
    }, []);

    const handleSaveUpdate = useCallback((overrideItem?: PaperRoll, targetSheet?: string) => {
        const itemToSave = overrideItem || foundItem;
        if (!itemToSave || !currentUser) return;
        
        const now = new Date();
        const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        const finalData: PaperRoll = { 
            ...itemToSave, 
            importer: currentUser.name,
            updatedAt: formattedTime
        };
        
        updateCache(finalData);
        if (!overrideItem) {
             setFoundItem(null); 
             setSearchError(false);
        }
        
        if (!overrideItem) {
            showNotification(`Đã lưu ${finalData.sku} (Vào hàng đợi)`, 'success');
        }
        if (navigator.vibrate) navigator.vibrate(100);

        const queueItem: QueueItem = {
            id: `q-${Date.now()}-${Math.random()}`,
            data: finalData,
            timestamp: Date.now(),
            retryCount: 0,
            targetSheet: targetSheet || DEFAULT_TARGET_SHEET
        };

        setOfflineQueue(prev => [...prev, queueItem]);
        setSessionTotal(prev => prev + 1);

    }, [foundItem, currentUser, showNotification, updateCache]);

    // --- LOGIC NHẬP LẠI KHO (RE-IMPORT) ---
    // Yêu cầu: Gửi chính xác { sku, weight, quantity } - KHÔNG gửi importer hay updatedAt
    const handleSaveReImport = useCallback((items: ReImportItem[]) => {
        if (!currentUser || items.length === 0) return;
        
        // Tạo payload tối giản
        const payload = items.map(item => ({
            sku: item.sku,
            weight: item.weight,
            quantity: item.quantity
        }));

        const queueItem: QueueItem = {
            id: `q-ri-${Date.now()}`,
            data: payload,
            timestamp: Date.now(),
            retryCount: 0,
            targetSheet: RE_IMPORT_TARGET_SHEET
        };

        setOfflineQueue(prev => [...prev, queueItem]);
        setSessionTotal(prev => prev + 1);
        
        showNotification(`Đã lưu gói ${items.length} dòng (Vào hàng đợi)`, 'success');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    }, [currentUser, showNotification]);

    // --- LOGIC XUẤT KHO (EXPORT) ---
    // Yêu cầu: Gửi chính xác { sku, quantity } - KHÔNG gửi importer hay updatedAt
    const handleSaveExport = useCallback((items: ReImportItem[]) => {
        if (!currentUser || items.length === 0) return;

        // Tạo payload tối giản
        const payload = items.map(item => ({
            sku: item.sku,
            quantity: item.quantity
        }));

        const queueItem: QueueItem = {
            id: `q-ex-${Date.now()}`,
            data: payload,
            timestamp: Date.now(),
            retryCount: 0,
            targetSheet: EXPORT_TARGET_SHEET
        };

        setOfflineQueue(prev => [...prev, queueItem]);
        setSessionTotal(prev => prev + 1);
        
        showNotification(`Đã lưu gói ${items.length} dòng (Vào hàng đợi)`, 'success');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }, [currentUser, showNotification]);

    return (
        <div className="min-h-[100dvh] w-full relative bg-[#0a0a0a] overflow-hidden">
            <NotificationSystem 
                notifications={notifications} 
                onRemove={removeNotification} 
            />
            
            {!isStorageReady ? (
                 <div className="flex items-center justify-center h-full">
                     <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                 </div>
            ) : (
                <>
                    {view === 'LOGIN' && (
                        <Login 
                            onLogin={handleLogin} 
                            onError={(msg) => showNotification(msg, 'error')}
                        />
                    )}

                    {view === 'DASHBOARD' && currentUser && (
                        <Dashboard 
                            user={currentUser}
                            foundItem={foundItem}
                            searchError={searchError}
                            isLoading={isLoadingSearch}
                            onSearch={handleSearch}
                            onLogout={() => handleLogout()}
                            onClearResult={handleClearResult}
                            onUpdateItem={handleUpdateItem}
                            onSaveUpdate={handleSaveUpdate}
                            onSaveReImport={handleSaveReImport}
                            onSaveExport={handleSaveExport}
                            onNotify={showNotification}
                            queueLength={offlineQueue.length}
                            sessionTotal={sessionTotal}
                            isSyncing={isSyncing}
                            onSync={handleManualSync}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default App;
