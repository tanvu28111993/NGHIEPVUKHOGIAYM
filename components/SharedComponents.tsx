
import React, { useRef, useEffect } from 'react';
import { PaperRoll } from '../types';
import { formatVNNumber } from '../utils';

const EDIT_COLOR = '#FF8C00';

// --- InfoRow ---
interface InfoRowProps {
    label: string;
    value: string | number;
    copyable?: boolean;
}

export const InfoRow: React.FC<InfoRowProps> = React.memo(({ label, value, copyable }) => (
    <div className="flex justify-between items-start py-3.5 border-b border-white/5 last:border-0 group">
        <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider flex items-center shrink-0 mr-3 mt-0.5">
            {label}
        </span>
        <span 
            className={`font-medium text-[14px] text-right flex-1 break-words text-gray-200 leading-snug ${copyable ? 'active:text-brand cursor-copy' : ''}`}
            onClick={() => {
                if (copyable && value && navigator.clipboard) {
                    navigator.clipboard.writeText(String(value));
                    if (navigator.vibrate) navigator.vibrate(10);
                }
            }}
        >
            {value || '-'}
        </span>
    </div>
));

// --- EditableRow (NEW) ---
interface EditableRowProps {
    fieldKey: keyof PaperRoll;
    label: string;
    value: string | number;
    isEditingThis: boolean;
    tempValue: string | number;
    onStartEditing: (field: keyof PaperRoll, value: string | number, e?: React.MouseEvent) => void;
    onSave: () => void;
    onValueChange: (val: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    inputType?: 'text' | 'date';
}

export const EditableRow: React.FC<EditableRowProps> = ({ 
    fieldKey, label, value, isEditingThis, tempValue, onStartEditing, onSave, onValueChange, onKeyDown,
    inputType = 'text'
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingThis && inputRef.current) {
            inputRef.current.focus();
            if (inputType === 'text') {
                 // Only select text for text inputs, date inputs handle selection differently
                 // setTimeout(() => inputRef.current?.select(), 50); 
            } else if (inputType === 'date') {
                 // For date inputs, we might want to trigger the picker immediately (browser dependent)
                 try {
                     // @ts-ignore
                     if(inputRef.current.showPicker) inputRef.current.showPicker();
                 } catch(e) {}
            }
        }
    }, [isEditingThis, inputType]);

    // Convert DD/MM/YYYY to YYYY-MM-DD for input[type="date"]
    const dateInputValue = React.useMemo(() => {
        if (inputType !== 'date' || !tempValue) return '';
        const strVal = String(tempValue).split(' ')[0]; // Strip time if present in temp
        const parts = strVal.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return '';
    }, [tempValue, inputType]);

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const yyyymmdd = e.target.value;
        if (!yyyymmdd) {
            onValueChange('');
            return;
        }
        const [y, m, d] = yyyymmdd.split('-');
        onValueChange(`${d}/${m}/${y}`);
    };

    // Strip time for display (DD/MM/YYYY HH:mm -> DD/MM/YYYY)
    const displayValue = React.useMemo(() => {
        if (!value) return '-';
        if (inputType === 'date') {
            return String(value).split(' ')[0];
        }
        return value;
    }, [value, inputType]);

    return (
        <div 
            className={`flex justify-between items-center py-3.5 border-b border-white/5 last:border-0 group transition-colors ${!isEditingThis ? 'active:bg-white/5 cursor-pointer hover:bg-white/[0.02]' : 'bg-white/5'}`}
            onClick={(e) => {
                if (!isEditingThis) {
                    onStartEditing(fieldKey, value, e);
                }
            }}
        >
            <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider flex items-center shrink-0 mr-3" style={{ color: isEditingThis ? EDIT_COLOR : undefined }}>
                {label}
                {!isEditingThis && <span className="material-symbols-outlined text-[14px] ml-1.5 opacity-50">edit</span>}
            </span>
            
            <div className="flex-1 text-right relative">
                {isEditingThis ? (
                    inputType === 'date' ? (
                        <input
                            ref={inputRef}
                            type="date"
                            value={dateInputValue}
                            onChange={handleDateChange}
                            onBlur={onSave}
                            onKeyDown={onKeyDown}
                            className="w-full bg-transparent text-right outline-none p-0 m-0 text-white font-bold text-[14px] caret-[#FF8C00] font-mono color-scheme-dark"
                            style={{ colorScheme: 'dark' }} 
                        />
                    ) : (
                        <input
                            ref={inputRef}
                            type="text"
                            value={tempValue}
                            onChange={(e) => onValueChange(e.target.value)}
                            onBlur={onSave}
                            onKeyDown={onKeyDown}
                            className="w-full bg-transparent text-right outline-none p-0 m-0 text-white font-bold text-[14px] caret-[#FF8C00] font-mono"
                            placeholder="Nhập giá trị..."
                        />
                    )
                ) : (
                    <span className="font-medium text-[14px] text-gray-200 leading-snug">
                        {displayValue}
                    </span>
                )}
            </div>
        </div>
    );
};

// --- CardBox ---
interface CardBoxProps {
    title: string;
    children: React.ReactNode;
    icon?: string;
    color?: string;
    action?: React.ReactNode;
    className?: string;
}

export const CardBox: React.FC<CardBoxProps> = ({ title, children, icon, color = 'text-white', action, className = '' }) => (
    <div className={`bg-[#1e1e1e] border border-white/5 rounded-[1.25rem] p-5 mb-4 shadow-lg ${className}`}>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
            <h3 className={`font-extrabold text-[12px] flex items-center uppercase tracking-widest opacity-80 ${color}`}>
                {icon && <span className="material-symbols-outlined text-lg mr-2 opacity-80">{icon}</span>}
                {title}
            </h3>
            {action}
        </div>
        <div className="w-full">
            {children}
        </div>
    </div>
);

// --- StatCard ---
interface StatCardProps {
    fieldKey?: keyof PaperRoll;
    label: string;
    value: string | number;
    unit?: string;
    icon?: string;
    isEditable?: boolean;
    fullWidth?: boolean;
    isInteger?: boolean;
    isEditingThis: boolean;
    tempValue: string | number;
    onStartEditing: (field: keyof PaperRoll, value: string | number, e?: React.MouseEvent) => void;
    onSave: () => void;
    onValueChange: (val: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const StatCard: React.FC<StatCardProps> = React.memo(({ 
    fieldKey, label, value, unit, icon, isEditable = false, fullWidth = false, isInteger = false,
    isEditingThis, tempValue, onStartEditing, onSave, onValueChange, onKeyDown,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingThis && inputRef.current) {
            inputRef.current.focus();
            setTimeout(() => inputRef.current?.select(), 50);
        }
    }, [isEditingThis]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        if (isInteger) {
             if (/^\d*$/.test(val)) onValueChange(val);
        } else {
             val = val.replace(/\./g, ',');
             if (/^\d*,?\d*$/.test(val)) onValueChange(val);
        }
    };

    const textStyleClass = "font-black tracking-tight leading-none text-[1.6rem]";

    return (
        <div className={`
            relative overflow-hidden rounded-xl p-3.5 flex flex-col justify-between shadow-md transition-all min-h-[90px]
            ${fullWidth ? 'col-span-2 bg-[#252525] border-l-[3px]' : 'bg-[#252525] border border-white/5'}
            ${isEditable && !isEditingThis ? 'active:scale-[0.98] cursor-pointer hover:bg-[#2a2a2a]' : ''}
            ${isEditingThis ? 'ring-2 ring-[#FF8C00] bg-neutral-800 z-10' : ''}
        `}
        style={{ borderColor: fullWidth ? EDIT_COLOR : undefined }}
        onClick={(e) => {
            if (isEditable && fieldKey && !isEditingThis) {
                onStartEditing(fieldKey, value, e);
            }
        }}
        >
            <div className="flex justify-between items-start z-10 mb-1">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest flex items-center">
                    {icon && <span className={`material-symbols-outlined text-[16px] mr-1.5 ${isEditable ? '' : 'text-gray-500'}`} style={{ color: isEditable ? EDIT_COLOR : undefined }}>{icon}</span>}
                    {label}
                </span>
            </div>

            <div className="flex items-baseline justify-end w-full z-10 min-h-[36px]">
                {isEditingThis ? (
                     <input
                        ref={inputRef}
                        type="text"
                        inputMode={isInteger ? "numeric" : "decimal"}
                        pattern={isInteger ? "[0-9]*" : undefined}
                        value={tempValue}
                        onChange={handleInputChange}
                        onBlur={onSave}
                        onKeyDown={onKeyDown}
                        className={`w-full bg-transparent text-right outline-none p-0 m-0 text-white caret-[#FF8C00] h-full ${textStyleClass}`}
                    />
                ) : (
                    <>
                        <span className={`${textStyleClass} ${isEditable ? '' : 'text-white'}`}
                            style={{ 
                                color: isEditable ? EDIT_COLOR : undefined,
                            }}>
                            {formatVNNumber(value, isInteger)}
                        </span>
                        {unit && <span className="text-[10px] text-gray-500 font-bold ml-1 uppercase transform -translate-y-1">{unit}</span>}
                    </>
                )}
            </div>
            {isEditable && !isEditingThis && (
                <div className="absolute inset-0 bg-transparent" />
            )}
        </div>
    );
});

// --- BigActionButton ---
interface BigActionButtonProps {
    onClick: () => void;
    icon: string;
    label: string;
    subLabel?: string;
    colorClass?: string;
}

export const BigActionButton: React.FC<BigActionButtonProps> = ({ onClick, icon, label, subLabel, colorClass = "text-gray-400 group-hover:text-brand" }) => (
    <div className="mb-10 w-full px-6 flex justify-center z-10 animate-[fadeIn_0.4s_ease-out]">
        <div 
            onClick={onClick}
            className="relative w-full aspect-square max-w-[280px] cursor-pointer group select-none active:scale-95 transition-transform duration-100"
        >
            <div className="absolute inset-0 bg-[#121212] rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/5 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-30"></div>
            </div>
            <div className="absolute inset-3 bg-gradient-to-br from-[#2a2a2a] to-[#151515] rounded-[2.5rem] shadow-[0_10px_20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col items-center justify-center border-t border-white/10 border-b border-black/80">
                <div className="w-28 h-28 rounded-full bg-[#0a0a0a] shadow-[inset_0_5px_15px_rgba(0,0,0,1)] flex items-center justify-center border border-white/5 relative group-hover:border-brand/30 transition-colors">
                    <span className={`material-symbols-outlined text-[4rem] transition-colors duration-300 drop-shadow-lg ${colorClass}`}>
                        {icon}
                    </span>
                </div>
                <div className="mt-6 flex flex-col items-center gap-1.5">
                    <span className="text-[14px] font-black text-gray-300 tracking-[0.25em] uppercase group-hover:text-white transition-colors">
                        {label}
                    </span>
                    {subLabel && (
                        <span className="text-[10px] font-bold text-gray-600 tracking-wider uppercase">
                            {subLabel}
                        </span>
                    )}
                    <div className="h-0.5 w-10 bg-brand rounded-full opacity-50 group-hover:opacity-100 group-hover:w-16 transition-all duration-300 mt-2"></div>
                </div>
            </div>
        </div>
    </div>
);
