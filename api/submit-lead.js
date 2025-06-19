const { Client } = require('@notionhq/client');

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Helper function to calculate lead score
function calculateLeadScore(leadData) {
  let score = 5; // Base score

  // Email presence
  if (leadData.email.includes('@gmail.com') || 
      leadData.email.includes('@outlook.com') || 
      leadData.email.includes('@yahoo.com')) {
    score += 2;
  } else {
    score += 3;
  }

  // Phone number provided
  if (leadData.phone) {
    score += 3;
  }

  // Multiple programs selected
  if (leadData.programs && leadData.programs.length > 1) {
    score += 2;
  }

  // NDIS number provided
  if (leadData.ndisNumber) {
    score += 4;
  }

  // Detailed goals
  if (leadData.goals && leadData.goals.length > 50) {
    score += 2;
  }

  // Emergency contact provided
  if (leadData.emergencyContact) {
    score += 1;
  }

  return Math.min(score, 10); // Cap at 10
}

// Validation function
function validateLeadData(data) {
  const errors = [];

  if (!data.name || data.name.length < 2) {
    errors.push('Name must be at least 2 characters');
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Valid email is required');
  }

  if (!data.programs || !Array.isArray(data.programs) || data.programs.length === 0) {
    errors.push('At least one program must be selected');
  }

  if (!data.goals || data.goals.length < 10) {
    errors.push('Goals must be at least 10 characters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ...corsHeaders });
  }

  // Set CORS headers
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const leadData = req.body;

    // Validate input data
    const validation = validateLeadData(leadData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Calculate lead score
    const leadScore = calculateLeadScore(leadData);

    // Create Notion page
    const response = await notion.pages.create({
      parent: {
        database_id: process.env.NOTION_LEADS_DB_ID,
      },
      properties: {
        'Lead Name': {
          title: [
            {
              text: {
                content: leadData.name,
              },
            },
          ],
        },
        'Email': {
          email: leadData.email,
        },
        'Phone': {
          phone_number: leadData.phone || '',
        },
        'Program Interest': {
          multi_select: leadData.programs.map(program => ({
            name: program,
          })),
        },
        'Message': {
          rich_text: [
            {
              text: {
                content: `Goals: ${leadData.goals}\n\n${leadData.message || ''}${leadData.additionalInfo ? `\n\nAdditional Info: ${leadData.additionalInfo}` : ''}`,
              },
            },
          ],
        },
        'Source': {
          select: {
            name: leadData.source || 'website',
          },
        },
        'Lead Score': {
          number: leadScore,
        },
        'Status': {
          select: {
            name: 'New',
          },
        },
        'Follow Up Date': {
          date: {
            start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
          },
        },
        'Converted to Participant': {
          checkbox: false,
        },
        'Created Date': {
          date: {
            start: new Date().toISOString().split('T')[0],
          },
        },
        'Notes': {
          rich_text: [
            {
              text: {
                content: 'New lead from website submission',
              },
            },
          ],
        },
        'Next Steps': {
          rich_text: [
            {
              text: {
                content: 'Initial contact within 24 hours',
              },
            },
          ],
        },
        'Days Since Contact': {
          number: 0,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Application submitted successfully! We\'ll contact you within 24 hours.',
      leadId: response.id,
      leadScore: leadScore,
    });

  } catch (error) {
    console.error('Error saving lead:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Something went wrong. Please try again or contact us directly.',
    });
  }
};