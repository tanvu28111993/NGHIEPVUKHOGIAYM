import React, { useState } from 'react';
import { ReImportItem } from '../types';

interface ReImportViewProps {
    items: ReImportItem[];
    onAddItem: (sku: string) => void;
    onRemoveItem: (id: string) => void;
    onUpdateItem: (id: string, field: keyof ReImportItem, value: string | number) => void;
    onSaveSession: () => void;
    onOpenScanner: () => void;
}

const ReImportView: React.FC<ReImportViewProps> = ({ items, onAddItem, onRemoveItem, onUpdateItem, onSaveSession, onOpenScanner }) => {
    const [reImportInput, setReImportInput] = useState('');

    const handleInputSubmit = () => {
        if (reImportInput.trim()) {
            onAddItem(reImportInput);
            setReImportInput('');
        }
    };

    const totalReImportQty = items.length;

    return (
        <div className="flex flex-col h-full animate-[fadeIn_0.4s_ease-out]">
            {/* INPUT TAY */}
            <div className="mb-4 relative z-10 flex gap-3 items-stretch h-[3.5rem]">
                <div className="relative group flex-1">
                    <input
                        type="text" 
                        value={reImportInput}
                        onChange={(e) => setReImportInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
                        placeholder="Quét hoặc nhập mã & Enter..."
                        className="w-full h-full bg-[#1e1e1e] border border-white/10 text-white text-[16px] font-semibold rounded-2xl pl-12 pr-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all placeholder-gray-500 shadow-lg"
                    />
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-gray-400">qr_code_scanner</span>
                    </div>
                </div>
            </div>

            {/* LIST ITEMS TABLE */}
            <div className="flex-1 overflow-y-auto pb-safe-bottom">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center opacity-30 mt-10">
                            <span className="material-symbols-outlined text-6xl mb-2">history_edu</span>
                            <p className="text-sm font-bold uppercase tracking-widest">Danh sách trống</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl overflow-hidden shadow-lg">
                            {/* TOTAL SUMMARY HEADER */}
                            <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                    Danh sách chờ: {items.length} dòng
                                </span>
                                <div className="flex items-center gap-2 bg-brand/10 px-2 py-1 rounded-md border border-brand/20">
                                    <span className="material-symbols-outlined text-[14px] text-brand">layers</span>
                                    <span className="text-[12px] font-bold text-gray-300 uppercase">Tổng SL:</span>
                                    <span className="text-[14px] font-black text-brand">{totalReImportQty}</span>
                                </div>
                            </div>

                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10 text-xs uppercase text-gray-500 font-bold tracking-wider">
                                        <th className="py-3 pl-3 w-auto">SKU</th>
                                        <th className="py-3 px-1 text-center w-[24%]">TL (KG)</th>
                                        <th className="py-3 px-1 text-center w-[26%]">SL</th>
                                        <th className="py-3 pr-2 w-[10%]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {items.map((item) => (
                                        <tr key={item.id} className="group hover:bg-white/5 transition-colors">
                                            {/* SKU Cell */}
                                            <td className="py-4 pl-3 pr-1 align-middle">
                                                <div className="text-[#FF8C00] font-black font-mono text-base break-all leading-tight">
                                                    {item.sku}
                                                </div>
                                            </td>
                                            
                                            {/* Weight Input Cell */}
                                            <td className="p-1 align-middle">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={item.weight}
                                                    onChange={(e) => {
                                                        let val = e.target.value;
                                                        
                                                        // 0. Hỗ trợ nhập dấu chấm '.' thành dấu phẩy ',' (để nhập số thập phân)
                                                        // Chỉ thay thế nếu chuỗi kết thúc bằng dấu chấm và chưa có dấu phẩy nào
                                                        if (val.endsWith('.') && !val.includes(',')) {
                                                            val = val.slice(0, -1) + ',';
                                                        }

                                                        // 1. Cho phép rỗng
                                                        if (val === '') {
                                                            onUpdateItem(item.id, 'weight', '');
                                                            return;
                                                        }

                                                        // 2. Tách phần nguyên và thập phân (dấu phẩy)
                                                        const parts = val.split(',');
                                                        
                                                        // Chỉ cho phép tối đa 1 dấu phẩy
                                                        if (parts.length > 2) return;

                                                        // 3. Xử lý phần nguyên: Xóa dấu chấm cũ, kiểm tra số, định dạng lại
                                                        const rawInteger = parts[0].replace(/\./g, '');
                                                        if (!/^\d*$/.test(rawInteger)) return; // Không phải số -> bỏ qua

                                                        // Định dạng thêm dấu chấm
                                                        const formattedInteger = rawInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                                                        
                                                        let finalVal = formattedInteger;

                                                        // 4. Ghép lại phần thập phân (nếu có)
                                                        if (val.includes(',')) {
                                                            finalVal += ',';
                                                            if (parts[1]) {
                                                                // Phần thập phân không được có dấu chấm
                                                                const rawDecimal = parts[1].replace(/\./g, '');
                                                                if (!/^\d*$/.test(rawDecimal)) return;
                                                                finalVal += rawDecimal;
                                                            }
                                                        }

                                                        onUpdateItem(item.id, 'weight', finalVal);
                                                    }}
                                                    placeholder="0,0"
                                                    className="w-full bg-[#2a2a2a] text-white text-center font-bold text-lg rounded-lg py-3 border border-white/10 focus:border-brand focus:outline-none placeholder-gray-600"
                                                />
                                            </td>

                                            {/* Quantity Input Cell */}
                                            <td className="p-1 align-middle">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={item.quantity}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        // 1. Xóa dấu chấm để lấy số thô
                                                        const rawVal = val.replace(/\./g, '');
                                                        
                                                        // 2. Kiểm tra chỉ chứa số
                                                        if (/^\d*$/.test(rawVal)) {
                                                            // 3. Định dạng lại thêm dấu chấm hàng nghìn
                                                            const formatted = rawVal.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                                                            onUpdateItem(item.id, 'quantity', formatted);
                                                        }
                                                    }}
                                                    className="w-full bg-[#2a2a2a] text-white text-center font-bold text-lg rounded-lg py-3 border border-white/10 focus:border-brand focus:outline-none"
                                                />
                                            </td>

                                            {/* Delete Action Cell */}
                                            <td className="py-4 pr-2 align-middle text-right">
                                                <button 
                                                    onClick={() => onRemoveItem(item.id)}
                                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 text-red-500 hover:text-red-400 flex items-center justify-center transition-all active:scale-90 ml-auto"
                                                    title="Xóa dòng"
                                                >
                                                    <span className="material-symbols-outlined text-lg font-bold">close</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="text-center pb-4 opacity-40">
                            <p className="text-[10px] uppercase tracking-widest font-bold">Vui lòng kiểm tra kỹ trước khi lưu</p>
                        </div>
                    </div>
                )}
            </div>

            {/* FABs */}
            <button
                onClick={onOpenScanner}
                className="fixed bottom-8 right-6 w-16 h-16 bg-brand rounded-full shadow-[0_4px_20px_rgba(218,41,28,0.5)] flex items-center justify-center text-white z-40 active:scale-90 transition-transform animate-slideInRight border border-white/20 hover:brightness-110"
            >
                <span className="material-symbols-outlined text-[2rem]">qr_code_scanner</span>
            </button>

            <button
                onClick={onSaveSession}
                disabled={items.length === 0}
                className={`fixed bottom-8 left-6 h-16 px-6 rounded-full flex items-center justify-center text-white z-40 active:scale-90 transition-transform animate-slideInRight border border-white/20 hover:brightness-110 gap-2 shadow-[0_4px_20px_rgba(255,140,0,0.5)]
                    ${items.length > 0 
                        ? 'bg-[#FF8C00]' 
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed border-gray-700 shadow-none'}
                `}
            >
                <span className="material-symbols-outlined text-[24px]">directory_sync</span>
                <span className="font-black text-[14px] uppercase tracking-wider">
                    NHẬP ({items.length})
                </span>
            </button>
        </div>
    );
};

export default ReImportView;