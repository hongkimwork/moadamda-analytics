const axios = require('axios');
const querystring = require('querystring');
require('dotenv').config();

/**
 * Cafe24 API Client
 * 
 * Handles OAuth authentication and API calls to Cafe24
 */
class Cafe24Client {
  constructor() {
    this.shopId = process.env.CAFE24_SHOP_ID || 'moadamda';
    this.clientId = process.env.CAFE24_CLIENT_ID;
    this.clientSecret = process.env.CAFE24_CLIENT_SECRET;
    this.redirectUri = process.env.CAFE24_REDIRECT_URI;
    this.accessToken = process.env.CAFE24_ACCESS_TOKEN;
    this.refreshToken = process.env.CAFE24_REFRESH_TOKEN;

    // Cafe24 API base URLs
    this.authBaseUrl = `https://${this.shopId}.cafe24api.com`;
    this.apiBaseUrl = `https://${this.shopId}.cafe24api.com/api/v2`;
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

      const { access_token, refresh_token, expires_in } = response.data;
      
      // Cafe24 may not return expires_in, default to 2 hours (7200 seconds)
      const expiresInSeconds = expires_in || 7200;
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      console.log('[Cafe24 Client] Token expires in:', expiresInSeconds, 'seconds');

      return {
        access_token,
        refresh_token,
        expires_in: expiresInSeconds,
        expires_at: expiresAt.toISOString()
      };
    } catch (error) {
      console.error('[Cafe24 Client] Token exchange failed:', error.response?.data || error.message);
      throw new Error(`Failed to get access token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   * 
   * @returns {Promise<{access_token, refresh_token, expires_in, expires_at}>}
   */
  async refreshAccessToken() {
    try {
      const data = querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
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

      console.log('[Cafe24 Client] Refresh token response:', JSON.stringify(response.data, null, 2));

      const { access_token, refresh_token, expires_in } = response.data;
      
      // Cafe24 may not return expires_in, default to 2 hours (7200 seconds)
      const expiresInSeconds = expires_in || 7200;
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

      // Update instance tokens
      this.accessToken = access_token;
      if (refresh_token) {
        this.refreshToken = refresh_token;
      }

      console.log('[Cafe24 Client] Access token refreshed successfully');
      console.log('[Cafe24 Client] New tokens received, expires in', expiresInSeconds, 'seconds');

      return {
        access_token,
        refresh_token: refresh_token || this.refreshToken,
        expires_in: expiresInSeconds,
        expires_at: expiresAt.toISOString()
      };
    } catch (error) {
      console.error('[Cafe24 Client] Token refresh failed:', error.response?.data || error.message);
      throw new Error(`Failed to refresh token: ${error.response?.data?.error_description || error.message}`);
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
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authorize the app first.');
    }

    const {
      start_date,
      end_date,
      limit = 100,
      offset = 0
    } = options;

    try {
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
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'X-Cafe24-Api-Version': '2025-09-01'
          }
        }
      );

      return response.data.orders || [];
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('[Cafe24 Client] Access token expired, refreshing...');
        await this.refreshAccessToken();
        // Retry after refresh
        return this.getOrders(options);
      }

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
    if (!this.accessToken) {
      throw new Error('Access token not set. Please authorize the app first.');
    }

    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/admin/orders/${orderId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'X-Cafe24-Api-Version': '2025-09-01'
          }
        }
      );

      return response.data.order || null;
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('[Cafe24 Client] Access token expired, refreshing...');
        await this.refreshAccessToken();
        // Retry after refresh
        return this.getOrderDetail(orderId);
      }

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

