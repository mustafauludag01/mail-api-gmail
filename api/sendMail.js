import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { name, email, subject, message, attachments = [] } = req.body;
  
  // DEBUG: Gelen verileri logla
  console.log('=== API DEBUG START ===');
  console.log('Attachment sayısı:', attachments.length);
  
  attachments.forEach((att, index) => {
    console.log(`Attachment ${index + 1}:`);
    console.log('- Filename:', att.filename);
    console.log('- ContentType:', att.contentType);
    console.log('- Content length:', att.content?.length || 0);
    console.log('- Content prefix:', att.content?.substring(0, 50) || 'N/A');
  });
  
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'name, email, subject ve message alanları zorunludur' });
  }

  try {
    // Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Gelen attachment'leri Nodemailer formatına çevir
    const mailAttachments = attachments.map((att, index) => {
      let content = att.content;
      
      // DEBUG: İşlem öncesi
      console.log(`Processing attachment ${index + 1}:`);
      console.log('- Original content length:', content?.length || 0);
      console.log('- Starts with data?', content?.startsWith('data:'));
      
      // Eğer data URI ise prefix'i kaldır (hem virgüllü hem virgülsüz)
      if (content.startsWith('data:')) {
        content = content.replace(/^data:[^,]*,?/, '');
        console.log('- After removing prefix length:', content.length);
      }
      
      return {
        filename: att.filename,
        content: content,
        encoding: 'base64',
        contentType: att.contentType
      };
    });

    console.log('Final mailAttachments count:', mailAttachments.length);
    console.log('=== API DEBUG END ===');

    // Mail seçenekleri
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: subject,
      html: message,
      attachments: mailAttachments
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: 'E-posta başarıyla gönderildi.',
      attachmentCount: mailAttachments.length
    });
  } catch (err) {
    console.error('Mail gönderim hatası:', err);
    return res.status(500).json({
      error: 'E-posta gönderimi başarısız.',
      details: err.message
    });
  }
}