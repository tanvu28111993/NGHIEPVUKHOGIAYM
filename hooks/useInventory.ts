
import { useState, useEffect, useCallback, useRef } from 'react';
import { PaperRoll } from '../types';
import { api } from '../api';
import { storage } from '../storage';

export const useInventory = (onNotify: (msg: string, type: 'success' | 'error' | 'info') => void) => {
    const [foundItem, setFoundItem] = useState<PaperRoll | null>(null);
    const [searchError, setSearchError] = useState<boolean>(false);
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);
    const [dataCache, setDataCache] = useState<Map<string, PaperRoll>>(new Map());
    const isStorageReadyRef = useRef(false);

    // 1. Load Cache
    useEffect(() => {
        const initCache = async () => {
            try {
                const cachedData = await storage.getCache();
                if (cachedData.size > 0) {
                    setDataCache(cachedData);
                    console.log(`[Storage] Loaded ${cachedData.size} items from cache`);
                }
            } catch (e) {
                console.error("Failed to load cache", e);
            } finally {
                isStorageReadyRef.current = true;
            }
        };
        initCache();
    }, []);

    // 2. Persist Cache
    useEffect(() => {
        if (!isStorageReadyRef.current) return;
        storage.setCache(dataCache);
    }, [dataCache]);

    const updateCache = useCallback((item: PaperRoll) => {
        setDataCache(prev => {
            const newCache = new Map(prev);
            if (item.sku) newCache.set(item.sku.toLowerCase(), item);
            if (item.packageId) newCache.set(item.packageId.toLowerCase(), item);
            return newCache;
        });
    }, []);

    const search = useCallback(async (code: string) => {
        const normalizedCode = code.trim().toLowerCase();
        setFoundItem(null);
        setSearchError(false);

        // Cache First Strategy
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
                onNotify(`Không tìm thấy mã: ${code}`, 'error');
            }
        } catch (error: any) {
            setIsLoadingSearch(false);
            setSearchError(true);
            onNotify("Lỗi kết nối: " + error.message, 'error');
        }
    }, [dataCache, onNotify, updateCache]);

    const updateLocalItem = useCallback((field: keyof PaperRoll, value: string | number) => {
        setFoundItem(current => {
            if (!current) return null;
            const updatedItem = { ...current, [field]: value };
            updateCache(updatedItem);
            return updatedItem;
        });
    }, [updateCache]);

    const clearResult = useCallback(() => {
        setFoundItem(null);
        setSearchError(false);
    }, []);

    return {
        foundItem,
        setFoundItem, // Exposed for manual resets if needed
        searchError,
        setSearchError,
        isLoadingSearch,
        search,
        updateLocalItem,
        clearResult,
        updateCache
    };
};
