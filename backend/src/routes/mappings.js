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
      search = ''
    } = req.query;
    
    // Get unique clean URLs from pageviews
    const { data: cleanUrls, total: totalClean } = await getUniqueCleanUrls(db, {
      limit: 10000, // Get all URLs first, then filter
      offset: 0,
      search
    });
    
    // Get all mappings (excluding excluded URLs)
    const mappingsQuery = `
      SELECT id, url, korean_name, created_at, updated_at 
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
        created_at: row.created_at,
        updated_at: row.updated_at
      });
    });
    
    // Get excluded URLs to filter out
    const excludedQuery = `SELECT url FROM url_mappings WHERE is_excluded = true`;
    const excludedResult = await db.query(excludedQuery);
    const excludedUrls = new Set(excludedResult.rows.map(row => row.url));
    
    // Merge URL data with mapping info, exclude excluded URLs
    const allUrls = cleanUrls
      .filter(urlData => !excludedUrls.has(urlData.url))
      .map(urlData => {
        const mapping = mappingsMap.get(urlData.url);
        return {
          url: decodeUrlForDisplay(urlData.url),  // Decode URL for display
          original_url: urlData.original_url,  // Keep original URL for actual access
          korean_name: mapping ? mapping.korean_name : null,
          mapping_id: mapping ? mapping.id : null,
          latest_timestamp: urlData.latest_timestamp,
          is_mapped: !!mapping
        };
      });
    
    // Apply pagination
    const paginatedData = allUrls.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    );
    
    res.json({
      data: paginatedData,
      total: allUrls.length,
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
// 2. GET /api/mappings
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
// 3. POST /api/mappings
// Create new URL mapping
// ============================================================================
router.post('/', async (req, res) => {
  try {
    const { url, korean_name } = req.body;
    
    // Validation: Check if fields are provided
    if (!url) {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'url is required' 
      });
    }
    
    if (!korean_name || korean_name.trim() === '') {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'Korean name is required and cannot be empty' 
      });
    }
    
    // Clean the URL
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
    
    // Insert new mapping
    const insertQuery = `
      INSERT INTO url_mappings (url, korean_name)
      VALUES ($1, $2)
      RETURNING id, url, korean_name, created_at, updated_at
    `;
    const insertResult = await db.query(insertQuery, [cleanedUrl, korean_name]);
    
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
// 4. PUT /api/mappings/:id
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
// 5. DELETE /api/mappings/:id
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

// ============================================================================
// 6. GET /api/mappings/lookup
// Lookup Korean name for a given URL, or get all mappings if no URL provided
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
// 6. GET /api/mappings/excluded
// Get list of excluded URLs
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
// 7. DELETE /api/mappings/excluded/:id
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
// 8. POST /api/mappings/exclude
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
    
    // Debug logging
    console.log('[EXCLUDE] Original URL:', url);
    console.log('[EXCLUDE] Cleaned URL:', cleanedUrl);
    
    // Check if URL already exists in mappings
    const existingMapping = await db.query('SELECT id, is_excluded FROM url_mappings WHERE url = $1', [cleanedUrl]);
    console.log('[EXCLUDE] Existing mapping found:', existingMapping.rows.length > 0);
    if (existingMapping.rows.length > 0) {
      console.log('[EXCLUDE] Is excluded:', existingMapping.rows[0].is_excluded);
    }
    
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

module.exports = router;

