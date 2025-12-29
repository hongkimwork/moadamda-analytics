/**
 * URL Cleaner Utility
 * Remove tracking parameters from URLs while keeping page identification parameters
 */

/**
 * List of tracking parameters to remove
 */
const TRACKING_PARAMS = [
  // UTM parameters
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  
  // Facebook
  'fbclid',
  'fb_action_ids',
  'fb_action_types',
  'fb_source',
  'fb_ref',
  
  // Google
  'gclid',
  'gclsrc',
  'dclid',
  
  // Naver
  'n_media',
  'n_query',
  'n_rank',
  'n_ad_group',
  'n_ad',
  'n_keyword_id',
  'n_keyword',
  'n_campaign_type',
  'n_contract',
  'n_ad_group_type',
  
  // Cafe24 / Shopping mall internal tracking
  'icid',        // Internal click ID
  'brid',        // Bridge ID
  'ifdotrk_campaign',
  'ifdotrk_slot',
  'ifdotrk_material',
  'ifdotrk_rest',
  
  // Naver tracking
  'NaPm',        // Naver performance max
  
  // TikTok
  'ttclid',      // TikTok click ID
  
  // Page variation parameters (not essential for page identity)
  'category',
  'display',
  'cate_no',
  'display_group',
  'order',
  'board_no',
  'category_no',
  
  // Session/temporary parameters
  'order_id',           // Each order has unique ID
  'returnUrl',          // Login redirect
  'noMember',
  'noMemberOrder',
  'toMoveLoginCheckModule',
  '__popupPage',
  'authType',
  'realNameEncrypt',
  'sex',
  'ch_ref',
  'basket_type',
  'delvtype',
  'bPrdOptLayer',
  'bIsUseRegularDelivery',
  'cafe_mkt',
  'page',              // Pagination
  'sort_method',       // Sorting
  'list_type',         // List view type
  
  // Other tracking parameters
  'ref',
  'referrer',
  'source',
  'campaign',
  '_ga',
  'mc_cid',
  'mc_eid'
];

/**
 * Clean URL by removing tracking parameters
 * @param {string} url - Original URL
 * @returns {string} - Cleaned URL
 */
function cleanUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }

  try {
    const urlObj = new URL(url);
    
    // ===== 0. Remove www subdomain (unify web domain) =====
    // www.moadamda.com → moadamda.com
    // Keep m.moadamda.com as-is (mobile)
    if (urlObj.hostname.startsWith('www.')) {
      urlObj.hostname = urlObj.hostname.replace(/^www\./, '');
    }
    
    // Build clean origin once (hostname already updated to remove www)
    const cleanOrigin = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? ':' + urlObj.port : ''}`;
    
    // ===== 1. Normalize product pages with product_no parameter =====
    // Convert detail.html?product_no=146 or image_zoom.html?product_no=146
    // to a standardized /product/[id]/ format
    if (urlObj.searchParams.has('product_no')) {
      const productNo = urlObj.searchParams.get('product_no');
      return `${cleanOrigin}/product/${productNo}/`;
    }
    
    // ===== 2. Normalize article pages: map to list pages =====
    // Individual articles should map to their list pages
    // /article/리뷰/4/12622/ → /review/list.html
    // /article/이벤트/8/79/ → /event/listIng.html
    if (urlObj.pathname.includes('/article/')) {
      // Check if it's a review or event based on the category
      const articleCategoryMatch = urlObj.pathname.match(/\/article\/([^/]+)\//);
      if (articleCategoryMatch) {
        const category = decodeURIComponent(articleCategoryMatch[1]);
        if (category.includes('리뷰') || category === '리뷰') {
          return `${cleanOrigin}/review/list.html`;
        }
        if (category.includes('이벤트') || category === '이벤트') {
          return `${cleanOrigin}/event/listIng.html`;
        }
      }
      // Default: map to event list (most articles are events)
      return `${cleanOrigin}/event/listIng.html`;
    }
    
    // ===== 2.3. Normalize review detail pages: map to list page =====
    // /review/read.html?no=XXX → /review/list.html
    if (urlObj.pathname.includes('/review/read.html')) {
      return `${cleanOrigin}/review/list.html`;
    }
    
    // ===== 2.5. Normalize surl (short URLs) =====
    // /surl/P/146/ → /product/146/ (Product detail page)
    // /surl/O/146/ → /order/direct (Order/checkout page - not product specific)
    const surlMatch = urlObj.pathname.match(/\/surl\/([a-zA-Z])\/(\d+)\/?/i);
    if (surlMatch) {
      const type = surlMatch[1].toUpperCase();
      const id = surlMatch[2];
      
      if (type === 'P') {
        // Product page
        return `${cleanOrigin}/product/${id}/`;
      } else if (type === 'O') {
        // Order/checkout page - these are session-specific, should be treated as unique URLs
        // Keep as-is but clean parameters
        return `${cleanOrigin}/surl/o/${id}/`;
      }
      // Other types: keep as-is
      return `${cleanOrigin}/surl/${type.toLowerCase()}/${id}/`;
    }
    
    // ===== 2.7. Normalize product pages: extract product ID from pathname =====
    // Convert /product/상품명/146/ to /product/146/
    // This consolidates all product URL variations into one canonical form
    // Use [\s\S] to match any character including Korean characters
    // BUGFIX: First remove /category/N/display/N/ pattern before extracting product ID
    // Without this, /product/상품명/136/category/80/display/1/ would extract "1" instead of "136"
    let productPathname = urlObj.pathname;
    productPathname = productPathname.replace(/\/category\/\d+\/display\/\d+\/?$/, '/');
    productPathname = productPathname.replace(/\/category\/\d+\/?$/, '/');
    
    const productPathMatch = productPathname.match(/\/product\/[\s\S]+?\/(\d+)\/?$/);
    if (productPathMatch) {
      const productId = productPathMatch[1];
      return `${cleanOrigin}/product/${productId}/`;
    }
    
    // ===== 3. Clean pathname =====
    let cleanedPathname = urlObj.pathname;
    
    // Remove /category/숫자/display/숫자/ pattern
    cleanedPathname = cleanedPathname.replace(/\/category\/\d+\/display\/\d+\/?$/, '/');
    
    // Remove /category/숫자/ pattern at the end
    cleanedPathname = cleanedPathname.replace(/\/category\/\d+\/?$/, '/');
    
    // Remove /categoryno/숫자/ pattern
    cleanedPathname = cleanedPathname.replace(/\/categoryno\/\d+\/?$/, '/');
    
    // Normalize case for /surl/ paths: /surl/P/ -> /surl/p/
    cleanedPathname = cleanedPathname.replace(/\/surl\/[A-Z]\//g, match => match.toLowerCase());
    
    // Normalize trailing slashes: keep trailing slash for directories, remove for files
    if (cleanedPathname.length > 1 && !cleanedPathname.includes('.html')) {
      if (!cleanedPathname.endsWith('/')) {
        cleanedPathname += '/';
      }
    }
    
    // ===== 3. Keep ONLY essential query parameters =====
    // UPDATED: Remove all query parameters for page mapping
    // Previously: ['article_no', 'no'] - caused duplicate URL entries in page mapping
    // Now: [] - all query params removed to consolidate page types
    // Original URLs are preserved in pageviews table for detailed analysis
    const essentialParams = [];
    const newSearchParams = new URLSearchParams();
    
    essentialParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        newSearchParams.set(param, urlObj.searchParams.get(param));
      }
    });
    
    // ===== 4. Build cleaned URL =====
    // Use cleanOrigin (already built above) to avoid re-encoding
    let cleanedUrl = cleanOrigin + cleanedPathname;
    
    // Add back essential parameters only
    const paramsString = newSearchParams.toString();
    if (paramsString) {
      cleanedUrl += '?' + paramsString;
    }
    
    // ===== 5. Fragment is automatically ignored by URL object =====
    // (urlObj doesn't include hash in toString())
    
    return cleanedUrl;
  } catch (error) {
    // If URL parsing fails, return original URL
    console.error('URL parsing error:', error.message);
    return url;
  }
}

/**
 * Extract clean URLs from pageviews table
 * @param {object} db - Database connection
 * @param {object} options - Query options (limit, offset, search)
 * @returns {Promise<Array>} - Array of clean URLs with visit counts
 */
async function getUniqueCleanUrls(db, options = {}) {
  const { limit = 50, offset = 0, search = '' } = options;
  
  let whereClause = '';
  let queryParams = [];
  let paramIndex = 1;
  
  // Search filter
  if (search) {
    whereClause = `WHERE page_url ILIKE $${paramIndex}`;
    queryParams.push(`%${search}%`);
    paramIndex++;
  }
  
  // Query to get URLs grouped by frequency and recency
  const query = `
    SELECT page_url
    FROM pageviews
    ${whereClause}
    GROUP BY page_url
    ORDER BY MAX(timestamp) DESC
    LIMIT 10000
  `;
  
  const result = await db.query(query, queryParams);
  
  // Clean URLs and count occurrences
  const urlMap = new Map();
  
  result.rows.forEach(row => {
    const cleanedUrl = cleanUrl(row.page_url);
    if (!urlMap.has(cleanedUrl)) {
      urlMap.set(cleanedUrl, {
        url: cleanedUrl,
        original_url: row.page_url,
        original_urls: [],
        latest_timestamp: null
      });
    }
    
    const urlData = urlMap.get(cleanedUrl);
    urlData.original_urls.push(row.page_url);
    
    // Update original_url with better candidate
    // Priority: 1) Full-path product URL, 2) Non-www, 3) Current
    const currentOriginal = urlData.original_url;
    const newCandidate = row.page_url;
    
    // Check if new candidate is better
    const currentIsFullPath = currentOriginal.includes('/product/') && 
                              currentOriginal.match(/\/product\/[^/]+\/\d+\//);
    const candidateIsFullPath = newCandidate.includes('/product/') && 
                                newCandidate.match(/\/product\/[^/]+\/\d+\//);
    
    const currentHasWww = currentOriginal.includes('://www.');
    const candidateHasWww = newCandidate.includes('://www.');
    
    // Prefer full-path product URLs
    if (!currentIsFullPath && candidateIsFullPath) {
      urlData.original_url = newCandidate;
    }
    // If both or neither are full-path, prefer non-www
    else if (currentIsFullPath === candidateIsFullPath && currentHasWww && !candidateHasWww) {
      urlData.original_url = newCandidate;
    }
  });
  
  // Convert to array and get timestamps
  const cleanUrls = Array.from(urlMap.values());
  
  // Get latest timestamp for each clean URL
  for (const urlData of cleanUrls) {
    const timestampQuery = `
      SELECT MAX(timestamp) as latest_timestamp
      FROM pageviews
      WHERE page_url = ANY($1::text[])
    `;
    const timestampResult = await db.query(timestampQuery, [urlData.original_urls]);
    urlData.latest_timestamp = timestampResult.rows[0].latest_timestamp;
  }
  
  // Sort by latest timestamp (most recent first)
  cleanUrls.sort((a, b) => new Date(b.latest_timestamp) - new Date(a.latest_timestamp));
  
  return {
    data: cleanUrls.slice(offset, offset + limit),
    total: cleanUrls.length
  };
}

module.exports = {
  cleanUrl,
  getUniqueCleanUrls,
  TRACKING_PARAMS
};

