
import React, { useState, useCallback, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import NotificationSystem from './components/NotificationSystem';
import { PaperRoll, ViewState, User, Notification, ReImportItem } from './types';
import { storage } from './storage';
import { useSync } from './hooks/useSync';
import { useInventory } from './hooks/useInventory';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const RE_IMPORT_TARGET_SHEET = 'SKUN';
const EXPORT_TARGET_SHEET = 'SKUX';

const App: React.FC = () => {
    const [view, setView] = useState<ViewState>('LOGIN');
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isAppReady, setIsAppReady] = useState(false);

    // --- NOTIFICATION SYSTEM ---
    const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now().toString();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => setNotifications(c => c.filter(n => n.id !== id)), 3000);
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // --- CUSTOM HOOKS ---
    const { 
        queue: offlineQueue, 
        sessionTotal, 
        isSyncing, 
        addToQueue, 
        forceSync 
    } = useSync(showNotification);

    const {
        foundItem,
        setFoundItem,
        searchError,
        setSearchError,
        isLoadingSearch,
        search,
        updateLocalItem,
        clearResult,
        updateCache
    } = useInventory(showNotification);

    // --- SESSION & INIT ---
    const handleLogout = useCallback((reason?: string) => {
        setView('LOGIN');
        setCurrentUser(null);
        clearResult();
        storage.removeUser();
        showNotification(reason || 'Đã đăng xuất thành công', 'info');
    }, [clearResult, showNotification]);

    useEffect(() => {
        // Init User
        const initUser = async () => {
            const user = await storage.getUser();
            if (user) {
                setCurrentUser(user);
                setView('DASHBOARD');
                console.log("[App] Auto-login successful");
            }
            setIsAppReady(true);
        };
        initUser();
    }, []);

    // Inactivity Timer
    useEffect(() => {
        if (!currentUser || view !== 'DASHBOARD') return;
        let timeoutId: ReturnType<typeof setTimeout>;
        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => handleLogout('Phiên làm việc hết hạn (30 phút)'), INACTIVITY_LIMIT_MS);
        };
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        events.forEach(e => window.addEventListener(e, resetTimer));
        resetTimer();
        return () => events.forEach(e => window.removeEventListener(e, resetTimer));
    }, [currentUser, view, handleLogout]);

    // --- HANDLERS ---
    const handleLogin = (username: string) => {
        const newUser: User = { id: `user-${Date.now()}`, name: username, role: 'staff' };
        setCurrentUser(newUser);
        storage.setUser(newUser);
        showNotification(`Xin chào, ${username}!`, 'success');
        setView('DASHBOARD');
    };

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
        
        updateCache(finalData); // Update cache immediately for UI responsiveness
        if (!overrideItem) {
             clearResult();
             showNotification(`Đã lưu ${finalData.sku} (Vào hàng đợi)`, 'success');
        }
        
        if (navigator.vibrate) navigator.vibrate(100);
        
        // Add to Sync Queue
        addToQueue(finalData, targetSheet);

    }, [foundItem, currentUser, showNotification, updateCache, clearResult, addToQueue]);

    // Re-Import Handler
    const handleSaveReImport = useCallback((items: ReImportItem[]) => {
        if (!currentUser || items.length === 0) return;
        
        const payload = items.map(item => ({
            sku: item.sku,
            weight: item.weight,
            quantity: item.quantity
        }));

        addToQueue(payload, RE_IMPORT_TARGET_SHEET);
        
        showNotification(`Đã lưu gói ${items.length} dòng (Vào hàng đợi)`, 'success');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }, [currentUser, showNotification, addToQueue]);

    // Export Handler
    const handleSaveExport = useCallback((items: ReImportItem[]) => {
        if (!currentUser || items.length === 0) return;

        const payload = items.map(item => ({
            sku: item.sku,
            quantity: item.quantity
        }));

        addToQueue(payload, EXPORT_TARGET_SHEET);
        
        showNotification(`Đã lưu gói ${items.length} dòng (Vào hàng đợi)`, 'success');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    }, [currentUser, showNotification, addToQueue]);

    return (
        <div className="min-h-[100dvh] w-full relative bg-[#0a0a0a] overflow-hidden">
            <NotificationSystem 
                notifications={notifications} 
                onRemove={removeNotification} 
            />
            
            {!isAppReady ? (
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
                            onSearch={search}
                            onLogout={() => handleLogout()}
                            onClearResult={clearResult}
                            onUpdateItem={updateLocalItem}
                            onSaveUpdate={handleSaveUpdate}
                            onSaveReImport={handleSaveReImport}
                            onSaveExport={handleSaveExport}
                            onNotify={showNotification}
                            queueLength={offlineQueue.length}
                            sessionTotal={sessionTotal}
                            isSyncing={isSyncing}
                            onSync={forceSync}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default App;
