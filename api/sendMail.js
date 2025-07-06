import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { name, email, message } = req.body;

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

    // 📄 HTML → PDF (puppeteer)
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(message, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm'
      }
    });

    await browser.close();

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: `ISS Refakat Formu PDF: ${name}`,
      text: 'Ekli PDF dosyasında refakat formu ve imzalar yer almaktadır.',
      attachments: [
        {
          filename: 'refakat-form.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'PDF başarıyla üretildi ve sadece ek olarak gönderildi.'
    });
  } catch (err) {
    console.error('Mail gönderim hatası:', err);
    res.status(500).json({
      error: 'E-posta gönderimi başarısız.',
      details: err.message
    });
  }
}
