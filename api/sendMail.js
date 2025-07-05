import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS headers ekle - EN BAŞTA
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Preflight request (OPTIONS) için
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { name, email, message, attachments = [] } = req.body;

  // Temel validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email ve message alanları zorunludur' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // Attachment'ları hazırla ve validate et
    const mailAttachments = attachments
      .filter(attachment => attachment.content && attachment.filename && attachment.cid)
      .map(attachment => ({
        filename: attachment.filename,
        content: attachment.content.replace(/^data:image\/[a-z]+;base64,/, ''), // Base64 prefix'i temizle
        encoding: 'base64',
        cid: attachment.cid // Content-ID için
      }));

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: `ISS Yeni Refakat Formu : ${name}`,
      html: message,
      attachments: mailAttachments
    };

    console.log(`Mail gönderiliyor: ${email}, Attachment sayısı: ${mailAttachments.length}`);
    
    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      success: true, 
      attachmentCount: mailAttachments.length,
      message: 'E-posta başarıyla gönderildi'
    });
  } catch (err) {
    console.error('Mail gönderim hatası:', err);
    res.status(500).json({ 
      error: 'E-posta gönderimi başarısız.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}