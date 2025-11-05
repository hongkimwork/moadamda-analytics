const axios = require('axios');
const querystring = require('querystring');
const db = require('./database');
require('dotenv').config();

/**
 * Cafe24 API Client
 * 
 * Handles OAuth authentication and API calls to Cafe24
 * Automatically manages token refresh (based on moadamda-access-log implementation)
 */
class Cafe24Client {
  constructor() {
    this.shopId = process.env.CAFE24_SHOP_ID || 'moadamda';
    this.clientId = process.env.CAFE24_CLIENT_ID;
    this.clientSecret = process.env.CAFE24_CLIENT_SECRET;
    this.redirectUri = process.env.CAFE24_REDIRECT_URI;

    // Cafe24 API base URLs
    this.authBaseUrl = `https://${this.shopId}.cafe24api.com`;
    this.apiBaseUrl = `https://${this.shopId}.cafe24api.com/api/v2`;
  }

  /**
   * Get valid access token from DB
   * Automatically refreshes if expired
   * 
   * @returns {Promise<string>} - Valid access token
   */
  async getToken() {
    try {
      const result = await db.query(
        'SELECT * FROM cafe24_token ORDER BY idx DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        throw new Error('No Cafe24 token found in database. Please authorize at https://marketingzon.com/cafe24/auth');
      }

      const token = result.rows[0];
      const now = new Date();
      const expireDate = new Date(token.expire_date);

      // Check if token is expired
      if (expireDate < now) {
        console.log('[Cafe24 Client] Access token expired, auto-refreshing...');
        return await this.refreshAndSaveToken(token.refresh_token);
      } else {
        const minutesLeft = Math.floor((expireDate - now) / 1000 / 60);
        console.log(`[Cafe24 Client] Using valid token (expires in ${minutesLeft} minutes)`);
        return token.access_token;
      }
    } catch (error) {
      console.error('[Cafe24 Client] Failed to get token:', error.message);
      throw error;
    }
  }

  /**
   * Refresh access token and save to DB
   * 
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<string>} - New access token
   */
  async refreshAndSaveToken(refreshToken) {
    try {
      const data = querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });

      const response = await axios.post(
        `${this.authBaseUrl}/api/v2/oauth/token`,
        data,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token, refresh_token, expires_at } = response.data;
      
      // Parse expire date
      const expireDate = new Date(expires_at);

      // Save to DB
      await db.query(
        `INSERT INTO cafe24_token (access_token, refresh_token, issued_date, expire_date)
         VALUES ($1, $2, NOW(), $3)`,
        [access_token, refresh_token, expireDate]
      );

      console.log('[Cafe24 Client] Token refreshed and saved to DB');
      console.log('[Cafe24 Client] New token expires at:', expireDate.toISOString());

      return access_token;
    } catch (error) {
      console.error('[Cafe24 Client] Token refresh failed:', error.response?.data || error.message);
      throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Save initial token to DB (called from OAuth callback)
   * 
   * @param {Object} tokenData - Token data from OAuth response
   */
  async saveTokenToDB(tokenData) {
    try {
      const { access_token, refresh_token, expires_at } = tokenData;
      const expireDate = new Date(expires_at);

      await db.query(
        `INSERT INTO cafe24_token (access_token, refresh_token, issued_date, expire_date)
         VALUES ($1, $2, NOW(), $3)`,
        [access_token, refresh_token, expireDate]
      );

      console.log('[Cafe24 Client] Initial token saved to DB');
      console.log('[Cafe24 Client] Token expires at:', expireDate.toISOString());
    } catch (error) {
      console.error('[Cafe24 Client] Failed to save token to DB:', error.message);
      throw error;
    }
  }

  /**
   * Generate OAuth authorization URL
   * User needs to visit this URL to authorize the app
   */
  getAuthorizationUrl() {
    const scope = [
      'mall.read_order',        // 주문 조회
      'mall.read_product',      // 상품 조회
      'mall.read_customer'      // 고객 조회
    ].join(',');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scope,
      state: 'random_state_' + Date.now() // CSRF protection
    });

    return `${this.authBaseUrl}/api/v2/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * 
   * @param {string} code - Authorization code from Cafe24
   * @returns {Promise<{access_token, refresh_token, expires_in, expires_at}>}
   */
  async getAccessToken(code) {
    try {
      const data = querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri
      });

      const response = await axios.post(
        `${this.authBaseUrl}/api/v2/oauth/token`,
        data,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log('[Cafe24 Client] Token response:', JSON.stringify(response.data, null, 2));

      const tokenData = response.data;
      
      // Save to DB
      await this.saveTokenToDB(tokenData);

      return tokenData;
    } catch (error) {
      console.error('[Cafe24 Client] Token exchange failed:', error.response?.data || error.message);
      throw new Error(`Failed to get access token: ${error.response?.data?.error_description || error.message}`);
    }
  }


  /**
   * Get orders from Cafe24
   * 
   * @param {Object} options - Query options
   * @param {string} options.start_date - Start date (YYYY-MM-DD)
   * @param {string} options.end_date - End date (YYYY-MM-DD)
   * @param {number} options.limit - Number of orders to fetch (default: 100, max: 100)
   * @param {number} options.offset - Offset for pagination (default: 0)
   * @returns {Promise<Array>} - Array of orders
   */
  async getOrders(options = {}) {
    const {
      start_date,
      end_date,
      limit = 100,
      offset = 0
    } = options;

    try {
      // Get valid token (automatically refreshes if expired)
      const accessToken = await this.getToken();

      const params = new URLSearchParams({
        limit: Math.min(limit, 100), // Max 100 per request
        offset: offset
      });

      if (start_date) params.append('start_date', start_date);
      if (end_date) params.append('end_date', end_date);

      const response = await axios.get(
        `${this.apiBaseUrl}/admin/orders?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Cafe24-Api-Version': '2025-09-01'
          }
        }
      );

      return response.data.orders || [];
    } catch (error) {
      console.error('[Cafe24 Client] Failed to get orders:', error.response?.data || error.message);
      throw new Error(`Failed to get orders: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get order detail including additional options (visitor_id)
   * 
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} - Order detail
   */
  async getOrderDetail(orderId) {
    try {
      // Get valid token (automatically refreshes if expired)
      const accessToken = await this.getToken();

      const response = await axios.get(
        `${this.apiBaseUrl}/admin/orders/${orderId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Cafe24-Api-Version': '2025-09-01'
          }
        }
      );

      return response.data.order || null;
    } catch (error) {
      console.error('[Cafe24 Client] Failed to get order detail:', error.response?.data || error.message);
      throw new Error(`Failed to get order detail: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Extract visitor_id from order additional options
   * 
   * @param {Object} order - Order object from Cafe24 API
   * @returns {string|null} - visitor_id or null if not found
   */
  extractVisitorId(order) {
    try {
      // Check if order has items
      if (!order.items || order.items.length === 0) {
        return null;
      }

      // Check each item's additional options
      for (const item of order.items) {
        if (item.additional_option_values && Array.isArray(item.additional_option_values)) {
          for (const option of item.additional_option_values) {
            // Look for ma_visitor_id
            if (option.name === 'ma_visitor_id' || option.key === 'ma_visitor_id') {
              return option.value || option.text;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[Cafe24 Client] Error extracting visitor_id:', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new Cafe24Client();

