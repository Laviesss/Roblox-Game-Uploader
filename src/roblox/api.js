const axios = require('axios');
const Logger = require('../utils/logger');

class RobloxAPI {
    constructor(userId, cookie = null, apiKey = null) {
        this.userId = userId;
        this.cookie = cookie;
        this.apiKey = apiKey;
        this.csrfToken = null;
    }

    async getCsrfToken() {
        if (!this.cookie) return null;
        try {
            await axios.post('https://auth.roblox.com/v2/logout', {}, {
                headers: {
                    'Cookie': `.ROBLOSECURITY=${this.cookie}`
                }
            });
        } catch (error) {
            this.csrfToken = error.response?.headers['x-csrf-token'];
            return this.csrfToken;
        }
    }

    async request(options, retries = 3, backoff = 1000) {
        if (this.cookie) {
            options.headers = options.headers || {};
            options.headers['Cookie'] = `.ROBLOSECURITY=${this.cookie}`;
            if (!['GET', 'HEAD', 'OPTIONS'].includes(options.method?.toUpperCase())) {
                if (!this.csrfToken) await this.getCsrfToken();
                options.headers['X-CSRF-TOKEN'] = this.csrfToken;
            }
        } else if (this.apiKey) {
            options.headers = options.headers || {};
            options.headers['x-api-key'] = this.apiKey;
        }

        try {
            return await axios(options);
        } catch (error) {
            if (error.response?.status === 403 && error.response?.headers['x-csrf-token']) {
                this.csrfToken = error.response.headers['x-csrf-token'];
                options.headers['X-CSRF-TOKEN'] = this.csrfToken;
                return await axios(options);
            }

            if (error.response?.status === 429 && retries > 0) {
                await Logger.log(this.userId, 'API_REQUEST', 'RATE_LIMITED', `Retrying in ${backoff}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                return this.request(options, retries - 1, backoff * 2);
            }

            throw error;
        }
    }

    async createUniverse(templatePlaceId = 95206881, groupId = null) {
        const url = `https://apis.roblox.com/universes/v1/universes/create${groupId ? `?groupId=${groupId}` : ''}`;
        try {
            const response = await this.request({
                method: 'POST',
                url: url,
                data: {
                    templatePlaceId: templatePlaceId
                }
            });
            await Logger.log(this.userId, 'CREATE_UNIVERSE', 'SUCCESS', `Created universe ${response.data.universeId}`);
            return response.data;
        } catch (error) {
            await Logger.log(this.userId, 'CREATE_UNIVERSE', 'FAILED', error.message);
            throw error;
        }
    }

    async uploadPlace(universeId, placeId, fileBuffer, versionType = 'Published') {
        const url = `https://apis.roblox.com/universes/v1/${universeId}/places/${placeId}/versions?versionType=${versionType}`;
        try {
            const response = await this.request({
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                data: fileBuffer
            });
            await Logger.log(this.userId, 'UPLOAD_PLACE', 'SUCCESS', `Uploaded to ${universeId}/${placeId}`);
            return response.data;
        } catch (error) {
            await Logger.log(this.userId, 'UPLOAD_PLACE', 'FAILED', error.message);
            throw error;
        }
    }
}

module.exports = RobloxAPI;
