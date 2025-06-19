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

// Validation function
function validateContactData(data) {
  const errors = [];

  if (!data.name || data.name.length < 2) {
    errors.push('Name must be at least 2 characters');
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Valid email is required');
  }

  if (!data.message || data.message.length < 10) {
    errors.push('Message must be at least 10 characters');
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
    const contactData = req.body;

    // Validate input data
    const validation = validateContactData(contactData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Convert contact to lead format for Notion
    const leadData = {
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone || '',
      programs: ['General Inquiry'],
      goals: `Contact inquiry: ${contactData.subject || 'General'}`,
      message: contactData.message,
      source: 'website_contact',
    };

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
          phone_number: leadData.phone,
        },
        'Program Interest': {
          multi_select: [
            {
              name: 'General Inquiry',
            },
          ],
        },
        'Message': {
          rich_text: [
            {
              text: {
                content: `Contact Form Submission\n\nSubject: ${contactData.subject || 'General Inquiry'}\n\nMessage: ${contactData.message}`,
              },
            },
          ],
        },
        'Source': {
          select: {
            name: 'website_contact',
          },
        },
        'Lead Score': {
          number: 6, // Default score for contact form
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
                content: 'Contact form submission from website',
              },
            },
          ],
        },
        'Next Steps': {
          rich_text: [
            {
              text: {
                content: 'Respond to inquiry within 24 hours',
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
      message: 'Message sent successfully! We\'ll respond within 24 hours.',
      leadId: response.id,
    });

  } catch (error) {
    console.error('Error saving contact:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Something went wrong. Please try again or contact us directly.',
    });
  }
};