
const API_URL = 'https://script.google.com/macros/s/AKfycbz4FZN7-14xHtYFgkomoIggAaV5XQpGBvJvxgT2GuC65EYD1dGJ5VyaPCTm5gTx5wqK/exec';

const sendRequest = async (payload: any) => {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error("API Request Failed:", error);
        throw error;
    }
};

export const api = {
    /**
     * Đăng nhập nhân viên
     */
    login: (username: string, password: string) => {
        return sendRequest({
            action: 'login',
            username: username,
            password: password
        });
    },

    /**
     * Tra cứu thông tin cuộn giấy theo SKU
     */
    search: (sku: string) => {
        return sendRequest({
            action: 'search',
            sku: sku
        });
    },

    /**
     * Đồng bộ dữ liệu (Lưu kho, Xuất kho, Nhập lại)
     */
    saveBatch: (data: any[], sheetName: string) => {
        return sendRequest({
            action: 'saveBatch',
            data: data,
            sheetName: sheetName
        });
    }
};
