import React, { useState, useRef, useEffect } from 'react';
import { PaperRoll } from '../types';
import { formatDateTime } from '../utils';
import { BigActionButton, CardBox, InfoRow, StatCard } from './SharedComponents';

const EDIT_COLOR = '#FF8C00';

const STAT_FIELDS_CONFIG = [
    { key: 'gsm', label: 'Định Lượng', unit: 'GSM', icon: 'line_weight', full: true, editable: false, isInteger: true },
    { key: 'weight', label: 'Trọng Lượng', unit: 'KG', icon: 'weight', full: false, editable: true, isInteger: false },
    { key: 'quantity', label: 'Số Lượng', unit: 'Cuộn', icon: 'layers', full: false, editable: true, isInteger: true },
    { key: 'lengthCm', label: 'KHỔ GIẤY/LÔ', unit: 'CM', icon: 'straighten', full: false, editable: true, isInteger: false }, 
    { key: 'widthCm', label: 'Khổ Rộng', unit: 'CM', icon: 'aspect_ratio', full: false, editable: true, isInteger: false }, 
] as const;

interface LocationViewProps {
    foundItem: PaperRoll | null;
    searchError: boolean;
    isLoading: boolean;
    onSearch: (code: string) => void;
    onClearResult: () => void;
    onUpdateItem: (field: keyof PaperRoll, value: string | number) => void;
    onSaveUpdate: (overrideItem?: PaperRoll, targetSheet?: string) => void;
    onOpenScanner: () => void;
}

const LocationView: React.FC<LocationViewProps> = ({
    foundItem, searchError, isLoading, onSearch, onClearResult, onUpdateItem, onSaveUpdate, onOpenScanner
}) => {
    const [manualCode, setManualCode] = useState('');
    const [editingField, setEditingField] = useState<keyof PaperRoll | null>(null);
    const [tempValue, setTempValue] = useState<string | number>('');
    const locationInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingField === 'location' && locationInputRef.current) {
            locationInputRef.current.focus();
            setTimeout(() => locationInputRef.current?.select(), 50);
        }
    }, [editingField]);

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const code = manualCode.trim();
        if (code) {
            if (navigator.vibrate) navigator.vibrate(20);
            onSearch(code);
            setManualCode('');
        }
    };

    const startEditing = (field: keyof PaperRoll, value: string | number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setEditingField(field);
        let strVal = value === null || value === undefined ? '' : String(value);
        const isIntField = ['quantity', 'gsm'].includes(field); 
        if (!isIntField) {
            strVal = strVal.replace(/\./g, ',');
        }
        setTempValue(strVal);
        if (navigator.vibrate) navigator.vibrate(10);
    };

    const saveEditing = () => {
        if (editingField && foundItem) {
            let finalValue: string | number = tempValue;
            const isNumericField = ['weight', 'quantity', 'lengthCm', 'widthCm', 'gsm'].includes(editingField);
            
            if (isNumericField && typeof tempValue === 'string') {
                const normalizeVal = tempValue.replace(/,/g, '.');
                const parsed = parseFloat(normalizeVal);
                finalValue = isNaN(parsed) ? tempValue : parsed;
            }
            
            if (finalValue != foundItem[editingField]) {
                 onUpdateItem(editingField, finalValue);
            }
            setEditingField(null);
        }
    };

    const handleSafeSaveUpdate = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
        if (editingField) saveEditing();
        onSaveUpdate();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur();
    };

    return (
        <div onClick={() => editingField && saveEditing()}>
            {/* 1. Default / Search View */}
            {!foundItem && !searchError && !isLoading && (
                <div className="flex flex-col h-full justify-center items-center pt-24 animate-[fadeIn_0.4s_ease-out]">
                    <BigActionButton 
                        onClick={onOpenScanner}
                        icon="qr_code_scanner"
                        label="Quét Mã SKU"
                        subLabel="Tìm & Cập nhật vị trí"
                        colorClass="text-gray-400 group-hover:text-brand"
                    />
                    <form onSubmit={handleManualSubmit} className="w-full max-w-sm px-4 relative z-20" onClick={(e) => e.stopPropagation()}>
                        <div className="relative group">
                            <input
                                type="text" 
                                inputMode="text"
                                enterKeyHint="search"
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value)}
                                placeholder="Nhập mã SKU thủ công..."
                                className="w-full bg-[#1e1e1e] border border-white/10 text-white text-[16px] font-semibold rounded-2xl pl-6 pr-14 py-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all placeholder-gray-500 shadow-xl"
                            />
                            <button type="submit" className="absolute right-2 top-2 bottom-2 aspect-square bg-brand hover:bg-red-600 text-white rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-lg">
                                <span className="material-symbols-outlined text-xl">search</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* 2. Loading State */}
            {isLoading && (
                <div className="flex flex-col items-center justify-center pt-32 animate-fadeIn">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-[#2a2a2a] rounded-full"></div>
                        <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                    </div>
                    <p className="text-gray-400 font-bold text-xs mt-6 animate-pulse uppercase tracking-widest">Đang truy xuất dữ liệu...</p>
                </div>
            )}

            {/* 3. Result: Found */}
            {foundItem && !isLoading && (
                <div className="animate-[fadeInUp_0.4s_ease-out] pb-4">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={(e) => {e.stopPropagation(); onClearResult();}} className="h-11 px-5 rounded-2xl bg-[#1e1e1e] text-gray-300 text-[13px] font-bold uppercase tracking-wider flex items-center hover:bg-[#2a2a2a] transition-colors active:scale-95 border border-white/5 shadow-md">
                            <span className="material-symbols-outlined mr-1.5 text-lg">arrow_back</span>
                            Quay lại
                        </button>
                    </div>
                    
                    {/* Main SKU Card */}
                    <div className="bg-[#1e1e1e] border border-white/10 rounded-[1.75rem] p-6 shadow-2xl relative overflow-hidden mb-5">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-brand/5 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none"></div>
                        <div className="flex flex-row justify-between items-start mb-4 relative z-10 gap-2">
                            <div className="flex-1 min-w-0 pr-2">
                                <span className="block text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Mã SKU</span>
                                <h1 className="text-[1.75rem] font-black text-brand tracking-tight leading-none break-all font-mono">
                                    {foundItem.sku}
                                </h1>
                            </div>
                            <button
                                onClick={handleSafeSaveUpdate}
                                className="relative flex-shrink-0 flex flex-col items-center justify-center w-[6.75rem] h-[6.75rem] rounded-[1.75rem] text-white bg-gradient-to-br from-green-500 via-emerald-600 to-green-700 shadow-[0_10px_30px_-5px_rgba(16,185,129,0.6)] border border-white/20 active:scale-[0.96] transition-all duration-300 z-20 cursor-pointer group overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 animate-[scan_3s_infinite_linear] opacity-30"></div>
                                <span className="material-symbols-outlined text-[3.5rem] mb-1 drop-shadow-xl group-hover:scale-110 group-active:scale-95 transition-transform duration-300 relative z-10">check_circle</span>
                                <span className="text-[13px] font-black uppercase tracking-widest drop-shadow-md relative z-10">Lưu</span>
                            </button>
                        </div>

                        <p className="text-gray-200 text-[16px] font-bold leading-tight relative z-10 mb-6 pb-4 border-b border-white/5">{foundItem.type}</p>
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-end mb-1">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">Vị trí lưu kho</span>
                            </div>
                            <div 
                                className={`flex items-baseline transition-all rounded-lg min-h-[3rem] ${editingField === 'location' ? 'bg-[#2a2a2a] p-2 -ml-2 ring-1 ring-[#FF8C00]' : 'cursor-pointer active:opacity-70 p-1 -ml-1 border border-transparent'}`}
                                onClick={(e) => { if (editingField !== 'location') startEditing('location', foundItem.location, e); }}
                            >
                                {editingField === 'location' ? (
                                    <input
                                        ref={locationInputRef}
                                        type="text"
                                        value={tempValue}
                                        onChange={(e) => setTempValue(e.target.value)}
                                        onBlur={saveEditing}
                                        onKeyDown={handleKeyDown}
                                        className="w-full bg-transparent text-right outline-none p-0 m-0 font-black text-[2rem] text-white caret-[#FF8C00] text-[16px]"
                                    />
                                ) : (
                                    <span className="text-[2rem] font-black tracking-tight text-right w-full block leading-none truncate" style={{ color: EDIT_COLOR }}>{foundItem.location}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <CardBox title="Thông số kỹ thuật" icon="analytics">
                        <div className="grid grid-cols-2 gap-2.5">
                            {STAT_FIELDS_CONFIG.map((field) => (
                                <StatCard 
                                    key={field.key}
                                    fieldKey={field.key}
                                    label={field.label} 
                                    value={foundItem[field.key as keyof PaperRoll] as string | number} 
                                    unit={field.unit} 
                                    icon={field.icon} 
                                    fullWidth={field.full}
                                    isEditable={field.editable}
                                    isInteger={field.isInteger}
                                    isEditingThis={editingField === field.key}
                                    tempValue={tempValue}
                                    onStartEditing={startEditing}
                                    onSave={saveEditing}
                                    onValueChange={(val) => setTempValue(val)}
                                    onKeyDown={handleKeyDown}
                                />
                            ))}
                        </div>
                    </CardBox>

                    <CardBox title="Thông tin vận hành" icon="inventory_2">
                        <InfoRow label="Kiện Giấy" value={foundItem.packageId} copyable={true} />
                        <InfoRow label="Mục Đích" value={foundItem.purpose} />
                        <InfoRow label="Vật Tư Chờ Xuất" value={foundItem.pendingOut} />
                    </CardBox>

                    <CardBox title="Nguồn gốc & Đơn hàng" icon="local_shipping">
                        <InfoRow label="Nhà Cung Cấp" value={foundItem.supplier} />
                        <InfoRow label="Nhà Sản Xuất" value={foundItem.manufacturer} />
                        <InfoRow label="Đơn Hàng / KH" value={foundItem.customerOrder} />
                        <InfoRow label="Mã Vật Tư" value={foundItem.materialCode} copyable={true} />
                    </CardBox>

                    <CardBox title="Thời gian & Nhân sự" icon="history">
                        <InfoRow label="Ngày Nhập" value={foundItem.importDate} />
                        <InfoRow label="Ngày SX" value={foundItem.prodDate} />
                        <InfoRow label="Người Nhập" value={foundItem.importer} />
                        <InfoRow label="Cập nhật cuối" value={formatDateTime(foundItem.updatedAt)} />
                    </CardBox>
                </div>
            )}

            {/* 4. Result: Not Found */}
            {searchError && !isLoading && (
                <div className="flex flex-col items-center justify-center pt-20 animate-[fadeIn_0.3s_ease-out]">
                    <div className="w-24 h-24 bg-[#1e1e1e] rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_40px_rgba(220,38,38,0.1)]">
                        <span className="material-symbols-outlined text-5xl text-brand">search_off</span>
                    </div>
                    <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Không tìm thấy!</h3>
                    <p className="text-gray-400 text-center mb-10 px-10 text-[14px] leading-relaxed">
                        Mã SKU này không có trong hệ thống.<br/>Vui lòng kiểm tra lại.
                    </p>
                    <div className="flex gap-4 w-full max-w-xs px-4">
                        <button onClick={(e) => {e.stopPropagation(); onClearResult();}} className="flex-1 bg-[#2a2a2a] hover:bg-[#333] text-white py-4 rounded-xl font-bold transition-all active:scale-95 border border-white/10 text-sm flex items-center justify-center">
                            <span className="material-symbols-outlined mr-2 text-xl">refresh</span>
                            Thử lại
                        </button>
                        <button onClick={onOpenScanner} className="flex-1 bg-brand hover:bg-red-600 text-white py-4 rounded-xl font-bold transition-all active:scale-95 shadow-lg text-sm flex items-center justify-center">
                            <span className="material-symbols-outlined mr-2 text-xl">qr_code_scanner</span>
                            Quét
                        </button>
                    </div>
                </div>
            )}

             {/* FAB */}
             {!isLoading && (
                 <button
                    onClick={onOpenScanner}
                    className="fixed bottom-8 right-6 w-16 h-16 bg-brand rounded-full shadow-[0_4px_20px_rgba(218,41,28,0.5)] flex items-center justify-center text-white z-40 active:scale-90 transition-transform animate-slideInRight border border-white/20 hover:brightness-110"
                >
                    <span className="material-symbols-outlined text-[2rem]">qr_code_scanner</span>
                </button>
            )}
        </div>
    );
};

export default LocationView;