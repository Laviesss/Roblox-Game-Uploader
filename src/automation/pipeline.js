const RobloxAPI = require('../roblox/api');
const AuthManager = require('../auth/manager');

class AutomationPipeline {
    static async createAndPublish(userId, fileBuffer, options = {}) {
        const cookie = await AuthManager.getCookie(userId);
        if (!cookie) throw new Error('User not authenticated');

        const api = new RobloxAPI(userId, cookie);

        const universe = await api.createUniverse(options.templatePlaceId, options.groupId);
        await api.uploadPlace(universe.universeId, universe.rootPlaceId, fileBuffer);

        return {
            universeId: universe.universeId,
            placeId: universe.rootPlaceId
        };
    }

    static async updateAndPublish(userId, universeId, placeId, fileBuffer) {
        const cookie = await AuthManager.getCookie(userId);
        if (!cookie) throw new Error('User not authenticated');

        const api = new RobloxAPI(userId, cookie);
        await api.uploadPlace(universeId, placeId, fileBuffer);

        return { universeId, placeId };
    }
}

module.exports = AutomationPipeline;
