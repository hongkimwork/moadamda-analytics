/**
 * Page URL Mapping API Router
 * CRUD operations for URL to Korean name mappings
 */

const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const { cleanUrl, getUniqueCleanUrls } = require('../utils/urlCleaner');

/**
 * Decode URL for display (한글 등)
 * @param {string} url - URL to decode
 * @returns {string} - Decoded URL
 */
function decodeUrlForDisplay(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  try {
    return decodeURIComponent(url);
  } catch (e) {
    // If decoding fails, return original URL
    return url;
  }
}

// ============================================================================
// 1. GET /api/mappings/all
// Get list of all URLs (mapped + unmapped, excluding excluded)
// ============================================================================
router.get('/all', async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0,
      search = '',
      status = 'all'  // 'all', 'completed', 'uncompleted'
    } = req.query;
    
    // Get unique clean URLs from pageviews (don't filter here, filter later with korean_name)
    const { data: cleanUrls, total: totalClean } = await getUniqueCleanUrls(db, {
      limit: 10000, // Get all URLs first, then filter
      offset: 0,
      search: '' // Don't filter at DB level, filter after merging with mapping data
    });
    
    // Get all mappings (excluding excluded URLs)
    const mappingsQuery = `
      SELECT id, url, korean_name, source_type, url_conditions, created_at, updated_at 
      FROM url_mappings 
      WHERE is_excluded = false
    `;
    const mappingsResult = await db.query(mappingsQuery);
    
    // Create a map of URL -> mapping info
    const mappingsMap = new Map();
    mappingsResult.rows.forEach(row => {
      mappingsMap.set(row.url, {
        id: row.id,
        korean_name: row.korean_name,
        source_type: row.source_type || 'auto',
        url_conditions: row.url_conditions,
        created_at: row.created_at,
        updated_at: row.updated_at
      });
    });
    
    // Get excluded URLs to filter out
    const excludedQuery = `SELECT url FROM url_mappings WHERE is_excluded = true`;
    const excludedResult = await db.query(excludedQuery);
    const excludedUrls = new Set(excludedResult.rows.map(row => row.url));
    
    // Merge URL data with mapping info, exclude excluded URLs
    let allUrls = cleanUrls
      .filter(urlData => !excludedUrls.has(urlData.url))
      .map(urlData => {
        const mapping = mappingsMap.get(urlData.url);
        return {
          url: decodeUrlForDisplay(urlData.url),  // Decode URL for display
          original_url: urlData.original_url,  // Keep original URL for actual access
          korean_name: mapping ? mapping.korean_name : null,
          mapping_id: mapping ? mapping.id : null,
          source_type: mapping ? mapping.source_type : 'auto',
          url_conditions: mapping ? mapping.url_conditions : null,
          latest_timestamp: urlData.latest_timestamp,
          is_mapped: !!mapping
        };
      });
    
    // Apply search filter (search in URL or korean_name)
    if (search) {
      const searchLower = search.toLowerCase();
      allUrls = allUrls.filter(item => {
        const urlMatch = item.url.toLowerCase().includes(searchLower);
        const koreanNameMatch = item.korean_name && item.korean_name.toLowerCase().includes(searchLower);
        return urlMatch || koreanNameMatch;
      });
    }
    
    // Calculate statistics BEFORE filtering (for full statistics)
    const totalBeforeFilter = allUrls.length;
    const completedCount = allUrls.filter(item => item.is_mapped).length;
    const uncompletedCount = allUrls.filter(item => !item.is_mapped).length;
    
    // Apply status filter (BEFORE pagination)
    if (status === 'completed') {
      allUrls = allUrls.filter(item => item.is_mapped === true);
    } else if (status === 'uncompleted') {
      allUrls = allUrls.filter(item => item.is_mapped === false);
    }
    // If status === 'all', no filtering needed
    
    // Sort: unmapped URLs first (is_mapped: false), then mapped URLs (is_mapped: true)
    allUrls.sort((a, b) => {
      // If both are mapped or both are unmapped, keep original order
      if (a.is_mapped === b.is_mapped) {
        return 0;
      }
      // Unmapped (false) comes before mapped (true)
      return a.is_mapped ? 1 : -1;
    });
    
    // Apply pagination (AFTER filtering and sorting)
    const paginatedData = allUrls.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );
    
    res.json({
      data: paginatedData,
      total: allUrls.length,
      mappedTotal: completedCount,
      unmappedTotal: uncompletedCount,
      statistics: {
        total: totalBeforeFilter,
        completed: completedCount,
        uncompleted: uncompletedCount
      },
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('All URLs query error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch all URLs',
      message: error.message 
    });
  }
});

// ============================================================================
// 2. GET /api/mappings/original-urls
// Get original URLs for a cleaned URL (before URL cleaning)
// NOTE: Must be defined BEFORE dynamic routes like /:id
// ============================================================================
router.get('/original-urls', async (req, res) => {
  try {
    const { cleaned_url } = req.query;
    
    // Validation: Check if cleaned_url is provided
    if (!cleaned_url) {
      return res.status(400).json({ 
        error: 'Missing required parameter',
        message: 'cleaned_url is required' 
      });
    }

    // Get all unique page_url from pageviews
    const pageviewsQuery = `
      SELECT 
        page_url,
        COUNT(*) as visit_count,
        MAX(timestamp) as latest_visit,
        MIN(timestamp) as first_visit
      FROM pageviews
      GROUP BY page_url
      ORDER BY visit_count DESC
    `;
    
    const pageviewsResult = await db.query(pageviewsQuery);

    // Filter URLs that clean to the requested cleaned_url
    const matchingUrls = [];
    let totalVisits = 0;
    
    for (const row of pageviewsResult.rows) {
      const cleaned = cleanUrl(row.page_url);
      if (cleaned === cleaned_url) {
        matchingUrls.push({
          url: row.page_url,
          visit_count: parseInt(row.visit_count),
          latest_visit: row.latest_visit,
          first_visit: row.first_visit
        });
        totalVisits += parseInt(row.visit_count);
      }
    }

    // Sort by visit count (already sorted from query, but ensure)
    matchingUrls.sort((a, b) => b.visit_count - a.visit_count);
    
    // Limit to top 100 to avoid performance issues
    const limitedUrls = matchingUrls.slice(0, 100);
    
    res.json({
      cleaned_url: cleaned_url,
      original_urls: limitedUrls,
      total_original_urls: matchingUrls.length,
      total_visits: totalVisits,
      showing: limitedUrls.length
    });
  } catch (error) {
    console.error('Original URLs query error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch original URLs',
      message: error.message 
    });
  }
});

// ============================================================================
// 3. GET /api/mappings/lookup
// Lookup Korean name for a given URL, or get all mappings if no URL provided
// NOTE: Must be defined BEFORE dynamic routes like /:id
// ============================================================================
router.get('/lookup', async (req, res) => {
  try {
    const { url } = req.query;
    
    // If no URL parameter, return all mappings as a simple map
    if (!url) {
      const result = await db.query(
        'SELECT url, korean_name FROM url_mappings WHERE is_excluded = false'
      );
      
      const mappings = {};
      result.rows.forEach(row => {
        mappings[row.url] = row.korean_name;
      });
      
      return res.json(mappings);
    }
    
    // Single URL lookup (existing functionality)
    const cleanedUrl = cleanUrl(url);
    
    // Lookup mapping
    const lookupQuery = `
      SELECT id, url, korean_name, created_at, updated_at
      FROM url_mappings
      WHERE url = $1
    `;
    const lookupResult = await db.query(lookupQuery, [cleanedUrl]);
    
    if (lookupResult.rows.length === 0) {
      return res.json({
        found: false,
        url: cleanedUrl,
        korean_name: null
      });
    }
    
    res.json({
      found: true,
      data: lookupResult.rows[0]
    });
  } catch (error) {
    console.error('Lookup error:', error);
    res.status(500).json({ 
      error: 'Failed to lookup mapping',
      message: error.message 
    });
  }
});

// ============================================================================
// 4. GET /api/mappings/excluded
// Get list of excluded URLs
// NOTE: Must be defined BEFORE dynamic routes like /:id
// ============================================================================
router.get('/excluded', async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0,
      search = ''
    } = req.query;
    
    let whereClause = 'WHERE is_excluded = true';
    let queryParams = [];
    let paramIndex = 1;
    
    // Search filter
    if (search) {
      whereClause += ` AND url ILIKE $${paramIndex}`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM url_mappings ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated data
    queryParams.push(parseInt(limit));
    queryParams.push(parseInt(offset));
    
    const dataQuery = `
      SELECT id, url, created_at, updated_at
      FROM url_mappings
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const dataResult = await db.query(dataQuery, queryParams);
    
    // Decode URLs for display
    const decodedData = dataResult.rows.map(row => ({
      ...row,
      url: decodeUrlForDisplay(row.url)
    }));
    
    res.json({
      data: decodedData,
      total: total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Excluded URLs query error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch excluded URLs',
      message: error.message 
    });
  }
});

// ============================================================================
// 5. DELETE /api/mappings/excluded/:id
// Remove URL from excluded list (restore to unmapped)
// ============================================================================
router.delete('/excluded/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if excluded URL exists
    const checkQuery = 'SELECT id, is_excluded FROM url_mappings WHERE id = $1';
    const checkResult = await db.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Not found', 
        message: 'Excluded URL not found' 
      });
    }
    
    if (!checkResult.rows[0].is_excluded) {
      return res.status(400).json({ 
        error: 'Invalid operation', 
        message: 'This URL is not excluded' 
      });
    }
    
    // Delete the excluded URL entry
    await db.query('DELETE FROM url_mappings WHERE id = $1', [id]);
    
    res.json({ 
      success: true, 
      message: 'Excluded URL removed successfully' 
    });
  } catch (error) {
    console.error('Error removing excluded URL:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// ============================================================================
// 6. POST /api/mappings/exclude
// Exclude a URL (delete mapping info and mark as excluded)
// ============================================================================
router.post('/exclude', async (req, res) => {
  try {
    const { url } = req.body;
    
    // Validation: Check if URL is provided
    if (!url) {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'url is required' 
      });
    }
    
    // Clean the URL
    const cleanedUrl = cleanUrl(url);

    // Check if URL already exists in mappings
    const existingMapping = await db.query('SELECT id, is_excluded FROM url_mappings WHERE url = $1', [cleanedUrl]);
    
    if (existingMapping.rows.length > 0) {
      // URL already exists in mappings table
      if (existingMapping.rows[0].is_excluded) {
        return res.status(409).json({ 
          error: 'Already excluded', 
          message: 'This URL is already excluded' 
        });
      } else {
        // URL is mapped - update to excluded (delete korean_name)
        const result = await db.query(
          'UPDATE url_mappings SET korean_name = NULL, is_excluded = true, updated_at = NOW() WHERE id = $1 RETURNING *',
          [existingMapping.rows[0].id]
        );
        
        return res.json({ 
          success: true, 
          data: result.rows[0],
          message: 'Mapping deleted and URL excluded successfully'
        });
      }
    }
    
    // URL doesn't exist in mappings - insert as excluded
    const result = await db.query(
      'INSERT INTO url_mappings (url, korean_name, is_excluded) VALUES ($1, NULL, true) RETURNING *',
      [cleanedUrl]
    );
    
    res.status(201).json({ 
      success: true, 
      data: result.rows[0],
      message: 'URL excluded successfully'
    });
  } catch (error) {
    console.error('Error excluding URL:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// ============================================================================
// 7. GET /api/mappings (base route)
// Get list of mapped URLs
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { 
      limit = 50, 
      offset = 0,
      search = ''
    } = req.query;
    
    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;
    
    // Search filter (search in both URL and Korean name)
    if (search) {
      whereClause = `WHERE url ILIKE $${paramIndex} OR korean_name ILIKE $${paramIndex}`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }
    
    // Count query
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM url_mappings 
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, queryParams.slice(0, paramIndex - 1));
    
    // Data query
    const dataQuery = `
      SELECT 
        id,
        url,
        korean_name,
        created_at,
        updated_at
      FROM url_mappings
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    queryParams.push(limit, offset);
    const dataResult = await db.query(dataQuery, queryParams);
    
    res.json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Mappings query error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch mappings',
      message: error.message 
    });
  }
});

// ============================================================================
// 8. POST /api/mappings
// Create new URL mapping (simple or complex with url_conditions)
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { url, korean_name, source_type = 'auto', url_conditions = null } = req.body;
    
    // Validation: Check if fields are provided
    if (!url && !url_conditions) {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'Either url or url_conditions is required' 
      });
    }
    
    if (!korean_name || korean_name.trim() === '') {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'Korean name is required and cannot be empty' 
      });
    }
    
    // Validate source_type
    if (source_type !== 'auto' && source_type !== 'manual') {
      return res.status(400).json({ 
        error: 'Invalid source_type',
        message: 'source_type must be "auto" or "manual"' 
      });
    }
    
    // Handle complex URL conditions (Phase 1: URL OR operation)
    if (url_conditions) {
      // Validate url_conditions structure
      if (!url_conditions.operator || !url_conditions.groups || !Array.isArray(url_conditions.groups)) {
        return res.status(400).json({ 
          error: 'Invalid url_conditions',
          message: 'url_conditions must have operator and groups array' 
        });
      }
      
      if (url_conditions.groups.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid url_conditions',
          message: 'url_conditions.groups cannot be empty' 
        });
      }
      
      // Use the first group's base_url as the primary URL for indexing
      const primaryUrl = url_conditions.groups[0].base_url;
      const cleanedUrl = cleanUrl(primaryUrl);
      
      // Check if URL already exists
      const checkQuery = `SELECT id FROM url_mappings WHERE url = $1`;
      const checkResult = await db.query(checkQuery, [cleanedUrl]);
      
      if (checkResult.rows.length > 0) {
        return res.status(409).json({ 
          error: 'Duplicate URL',
          message: 'This URL is already mapped' 
        });
      }
      
      // Insert new complex mapping
      const insertQuery = `
        INSERT INTO url_mappings (url, korean_name, source_type, url_conditions)
        VALUES ($1, $2, $3, $4)
        RETURNING id, url, korean_name, source_type, url_conditions, created_at, updated_at
      `;
      const insertResult = await db.query(insertQuery, [
        cleanedUrl, 
        korean_name, 
        source_type,
        JSON.stringify(url_conditions)
      ]);
      
      return res.status(201).json({
        success: true,
        data: insertResult.rows[0]
      });
    }
    
    // Handle simple URL mapping (backward compatibility)
    const cleanedUrl = cleanUrl(url);
    
    // Check if URL already exists
    const checkQuery = `SELECT id FROM url_mappings WHERE url = $1`;
    const checkResult = await db.query(checkQuery, [cleanedUrl]);
    
    if (checkResult.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Duplicate URL',
        message: 'This URL is already mapped' 
      });
    }
    
    // Insert new simple mapping
    const insertQuery = `
      INSERT INTO url_mappings (url, korean_name, source_type, url_conditions)
      VALUES ($1, $2, $3, NULL)
      RETURNING id, url, korean_name, source_type, url_conditions, created_at, updated_at
    `;
    const insertResult = await db.query(insertQuery, [cleanedUrl, korean_name, source_type]);
    
    res.status(201).json({
      success: true,
      data: insertResult.rows[0]
    });
  } catch (error) {
    console.error('Mapping creation error:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({ 
        error: 'Duplicate URL',
        message: 'This URL is already mapped' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create mapping',
      message: error.message 
    });
  }
});

// ============================================================================
// 9. PUT /api/mappings/:id
// Update existing URL mapping
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { korean_name } = req.body;
    
    // Validation: Check if korean_name is provided and not empty
    if (!korean_name || korean_name.trim() === '') {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'Korean name is required and cannot be empty' 
      });
    }
    
    // Check if mapping exists
    const checkQuery = `SELECT id FROM url_mappings WHERE id = $1`;
    const checkResult = await db.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Mapping not found' 
      });
    }
    
    // Update mapping
    const updateQuery = `
      UPDATE url_mappings
      SET korean_name = $1
      WHERE id = $2
      RETURNING id, url, korean_name, created_at, updated_at
    `;
    const updateResult = await db.query(updateQuery, [korean_name, id]);
    
    res.json({
      success: true,
      data: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Mapping update error:', error);
    res.status(500).json({ 
      error: 'Failed to update mapping',
      message: error.message 
    });
  }
});

// ============================================================================
// 10. DELETE /api/mappings/:id
// Delete URL mapping
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if mapping exists
    const checkQuery = `SELECT id, url, korean_name FROM url_mappings WHERE id = $1`;
    const checkResult = await db.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Mapping not found' 
      });
    }
    
    // Delete mapping
    const deleteQuery = `DELETE FROM url_mappings WHERE id = $1`;
    await db.query(deleteQuery, [id]);
    
    res.json({
      success: true,
      message: 'Mapping deleted successfully',
      deleted: checkResult.rows[0]
    });
  } catch (error) {
    console.error('Mapping deletion error:', error);
    res.status(500).json({ 
      error: 'Failed to delete mapping',
      message: error.message 
    });
  }
});

module.exports = router;

