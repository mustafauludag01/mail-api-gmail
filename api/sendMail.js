import nodemailer from 'nodemailer';
import pdf from 'html-pdf';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { name, email, message, attachments = [] } = req.body;

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

    // 📄 PDF oluştur: HTML'den PDF'yi oluştur
    const pdfBuffer = await new Promise((resolve, reject) => {
      pdf.create(message, { format: 'A4', border: '20px' }).toBuffer((err, buffer) => {
        if (err) reject(err);
        else resolve(buffer);
      });
    });

    // ✂ Görsel attachment'ları (imzalar varsa)
    const imageAttachments = attachments
      .filter(att => att.content && att.filename)
      .map(att => ({
        filename: att.filename,
        content: att.content.replace(/^data:image\/[a-z]+;base64,/, ''),
        encoding: 'base64'
      }));

    // 📎 PDF'i de ekle
    imageAttachments.push({
      filename: 'refakat-form.pdf',
      content: pdfBuffer,
      contentType: 'application/pdf'
    });

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: `ISS Refakat Formu PDF: ${name}`,
      text: 'Ekli PDF dosyasında form ve imzalar bulunmaktadır.',
      attachments: imageAttachments
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      attachmentCount: imageAttachments.length,
      message: 'PDF ekli e-posta başarıyla gönderildi.'
    });
  } catch (err) {
    console.error('Mail gönderim hatası:', err);
    res.status(500).json({
      error: 'E-posta gönderimi başarısız.',
      details: err.message
    });
  }
}
