
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { storage } from '../storage';

interface QueueItem {
    id: string;
    data: any;
    timestamp: number;
    retryCount: number;
    targetSheet?: string;
}

const BATCH_SIZE = 5;
const DEFAULT_TARGET_SHEET = 'KHO';

export const useSync = (onNotify: (msg: string, type: 'success' | 'error' | 'info') => void) => {
    const [offlineQueue, setOfflineQueue] = useState<QueueItem[]>([]);
    const [sessionTotal, setSessionTotal] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncIntervalMs, setSyncIntervalMs] = useState(10000);
    const isSyncingRef = useRef(false);
    const isStorageReadyRef = useRef(false);

    // 1. Load Queue from Storage
    useEffect(() => {
        const initQueue = async () => {
            try {
                const queue = await storage.getQueue();
                setOfflineQueue(queue);
                if (queue.length > 0) {
                    setSessionTotal(queue.length);
                }
            } catch (e) {
                console.error("Failed to load queue", e);
            } finally {
                isStorageReadyRef.current = true;
            }
        };
        initQueue();
    }, []);

    // 2. Persist Queue to Storage
    useEffect(() => {
        if (!isStorageReadyRef.current) return;
        storage.setQueue(offlineQueue);
        
        if (offlineQueue.length === 0) {
            setSessionTotal(0);
            setIsSyncing(false);
        }
    }, [offlineQueue]);

    // 3. Prevent Tab Close if Queue not empty
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

    // 4. Sync Worker Logic
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
            .filter(item => (item.targetSheet || DEFAULT_TARGET_SHEET) === currentTargetSheet)
            .slice(0, BATCH_SIZE);

        const payload = batch.flatMap(b => Array.isArray(b.data) ? b.data : [b.data]);
        const processedIds = new Set(batch.map(b => b.id));

        console.log(`[SyncWorker] Sending batch of ${batch.length} items to '${currentTargetSheet}'...`);

        try {
            const result = await api.saveBatch(payload, currentTargetSheet);

            if (result && result.success) {
                setOfflineQueue(prev => prev.filter(item => !processedIds.has(item.id)));
                onNotify(`Đã cập nhật ${payload.length} dòng vào '${currentTargetSheet}'`, 'success');
                setSyncIntervalMs(1000);
            } else {
                throw new Error(result.message || "Unknown API error");
            }
        } catch (error) {
            console.error(`[SyncWorker] Batch failed`, error);
            setSyncIntervalMs(prev => Math.min(prev * 2, 300000)); // Exponential backoff
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [offlineQueue, onNotify]);

    // 5. Trigger Loop
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (offlineQueue.length > 0) {
            timeoutId = setTimeout(processSyncQueue, syncIntervalMs);
        } else {
            if (syncIntervalMs !== 10000) setSyncIntervalMs(10000);
        }
        return () => clearTimeout(timeoutId);
    }, [offlineQueue, syncIntervalMs, processSyncQueue]);

    // 6. Online Listener
    useEffect(() => {
        const handleOnline = () => {
            if (offlineQueue.length > 0) setSyncIntervalMs(100);
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [offlineQueue.length]);

    // Public Methods
    const addToQueue = useCallback((data: any, targetSheet: string = DEFAULT_TARGET_SHEET) => {
        const newItem: QueueItem = {
            id: `q-${Date.now()}-${Math.random()}`,
            data,
            timestamp: Date.now(),
            retryCount: 0,
            targetSheet
        };
        setOfflineQueue(prev => [...prev, newItem]);
        setSessionTotal(prev => prev + 1);
    }, []);

    const forceSync = useCallback(() => {
        if (!navigator.onLine) {
            onNotify('Không có kết nối mạng!', 'error');
            return;
        }
        if (offlineQueue.length === 0) {
            onNotify('Tất cả dữ liệu đã được đồng bộ', 'success');
            return;
        }
        onNotify('Đang đồng bộ dữ liệu...', 'info');
        setSyncIntervalMs(100);
    }, [offlineQueue.length, onNotify]);

    return {
        queue: offlineQueue,
        sessionTotal,
        isSyncing,
        addToQueue,
        forceSync
    };
};
