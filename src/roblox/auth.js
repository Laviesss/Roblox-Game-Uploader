const axios = require('axios');

class RobloxAuth {
    static async login(username, password, captchaToken = null, captchaId = null) {
        const payload = {
            ctype: 'Username',
            cvalue: username,
            password: password
        };

        if (captchaToken && captchaId) {
            payload.captchaToken = captchaToken;
            payload.captchaId = captchaId;
            payload.captchaProvider = 'PROVIDER_Funcaptcha';
        }

        try {
            const response = await axios.post('https://auth.roblox.com/v2/login', payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const cookieHeader = response.headers['set-cookie'];
            const cookie = cookieHeader?.find(c => c.startsWith('.ROBLOSECURITY='))?.split(';')[0]?.split('=')[1];
            return { success: true, cookie, user: response.data.user };
        } catch (error) {
            if (error.response?.status === 403) {
                const csrfToken = error.response.headers['x-csrf-token'];
                if (csrfToken && !payload.captchaToken) {
                    try {
                        const retryResponse = await axios.post('https://auth.roblox.com/v2/login', payload, {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRF-TOKEN': csrfToken
                            }
                        });
                        const cookieHeader = retryResponse.headers['set-cookie'];
                        const cookie = cookieHeader?.find(c => c.startsWith('.ROBLOSECURITY='))?.split(';')[0]?.split('=')[1];
                        return { success: true, cookie, user: retryResponse.data.user };
                    } catch (retryError) {
                        if (retryError.response?.data?.errors?.[0]?.code === 0 && retryError.response?.data?.errors?.[0]?.fieldData) {
                            return {
                                success: false,
                                captchaRequired: true,
                                captchaData: JSON.parse(retryError.response.data.errors[0].fieldData),
                                csrfToken
                            };
                        }
                        throw retryError;
                    }
                }
            }
            return { success: false, error: error.response?.data?.errors?.[0]?.message || error.message };
        }
    }
}

module.exports = RobloxAuth;
