import nodemailer from 'nodemailer';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method is allowed' });
  }

  const { name, email, message, attachments = [] } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email ve message alanları zorunludur' });
  }

  try {
    // Puppeteer ile PDF üret
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
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

    // Nodemailer ile mail gönderimi
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    const emailAttachments = [
      {
        filename: 'refakat-form.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf'
      },
      ...attachments.map(att => ({
        filename: att.filename,
        content: att.content.replace(/^data:image\/[a-z]+;base64,/, ''),
        encoding: 'base64'
      }))
    ];

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: `ISS Refakat Formu PDF: ${name}`,
      text: 'Ekli PDF dosyasında refakat formu ve varsa imzalar yer almaktadır.',
      attachments: emailAttachments
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      success: true,
      message: 'PDF başarıyla üretildi ve e-posta ile gönderildi.',
      attachmentCount: emailAttachments.length
    });
  } catch (err) {
    console.error('Mail gönderim hatası:', err);
    res.status(500).json({
      error: 'E-posta gönderimi başarısız.',
      details: err.message
    });
  }
}
