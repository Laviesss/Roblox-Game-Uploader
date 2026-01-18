import axios from 'axios';

export async function robloxRequest(method, url, cookie, data = {}, headers = {}) {
  let csrfToken = await getCsrfToken(cookie);

  const makeRequest = (token) => axios({
    method,
    url,
    data,
    headers: {
      'Cookie': `.ROBLOSECURITY=${cookie}`,
      'X-CSRF-TOKEN': token,
      ...headers
    }
  });

  try {
    return await makeRequest(csrfToken);
  } catch (error) {
    if (error.response?.status === 403) {
      const newToken = error.response.headers['x-csrf-token'];
      if (newToken) {
        return await makeRequest(newToken);
      }
    }
    throw error;
  }
}

export async function createUniverse(cookie, name, description = '') {
  const response = await robloxRequest('post', 'https://apis.roblox.com/universes/v1/universes/create', cookie, {
    name, description, templatePlaceId: 95206881
  }, { 'Content-Type': 'application/json' });

  // After creation, we might need to fetch the root place ID if it's not in the response
  const universeId = response.data.universeId;
  const placesResponse = await axios.get(`https://develop.roblox.com/v1/universes/${universeId}/places?isRootPlace=true`, {
    headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
  });

  return {
    universeId,
    rootPlaceId: placesResponse.data.data[0]?.id
  };
}

export async function uploadPlace(cookie, universeId, placeId, fileBuffer) {
  const response = await robloxRequest('post', `https://publish.roblox.com/v1/places/${placeId}/versions?versionType=Published`, cookie, fileBuffer, {
    'Content-Type': 'application/octet-stream'
  });
  return response.data;
}

export async function getCsrfToken(cookie) {
  try {
    await axios.post('https://auth.roblox.com/v2/logout', {}, { headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` } });
  } catch (error) {
    const token = error.response?.headers['x-csrf-token'];
    if (token) return token;
    throw new Error('Failed to fetch CSRF token');
  }
}

export async function validateCookie(cookie) {
  const response = await axios.get('https://users.roblox.com/v1/users/authenticated', {
    headers: { 'Cookie': `.ROBLOSECURITY=${cookie}` }
  });
  return response.data;
}
